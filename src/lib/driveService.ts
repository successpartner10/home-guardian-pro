import { supabase } from "@/integrations/supabase/client";

export const DRIVE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export interface DriveFile {
    id: string;
    name: string;
    size?: string;
    createdTime: string;
    thumbnailLink?: string;
    mimeType?: string;
}

export class DriveService {
    private accessToken: string | null = null;

    setToken(token: string) {
        this.accessToken = token;
    }

    clearToken() {
        this.accessToken = null;
    }

    async isReady() {
        const token = await this.getToken();
        return !!token;
    }

    private async getToken(): Promise<string | null> {
        if (this.accessToken) return this.accessToken;

        // Try to get provider token from session (Google SSO)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.provider_token) {
            this.accessToken = session.provider_token;
            return this.accessToken;
        }
        return null;
    }

    private async fetchApi(path: string, options: RequestInit = {}) {
        const token = await this.getToken();
        if (!token) {
            throw new Error("Google Drive access token is not set.");
        }

        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${token}`);

        const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Drive API Error:", errorText);
            throw new Error(`Drive API Error: ${response.status} ${response.statusText}`);
        }

        if (response.status === 204) return null;
        return response.json();
    }

    /**
     * List folders in the user's drive
     */
    async listFolders(): Promise<DriveFile[]> {
        const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false`);
        const fields = encodeURIComponent("files(id, name, createdTime)");
        const data = await this.fetchApi(`/files?q=${query}&fields=${fields}&orderBy=name`);
        return data.files || [];
    }

    /**
     * Create a new folder
     */
    async createFolder(name: string): Promise<string> {
        const response = await this.fetchApi("/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                mimeType: "application/vnd.google-apps.folder",
            }),
        });
        return response.id;
    }

    /**
     * List files in a specific folder
     */
    async listFiles(folderId: string): Promise<DriveFile[]> {
        const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const fields = encodeURIComponent("files(id, name, size, createdTime, thumbnailLink)");

        try {
            const data = await this.fetchApi(`/files?q=${query}&fields=${fields}&orderBy=createdTime asc`);
            return data.files || [];
        } catch (e) {
            console.error("Failed to list files", e);
            return [];
        }
    }

    /**
     * Delete specific files
     */
    async deleteFiles(fileIds: string[]) {
        if (!this.accessToken) return;
        await Promise.allSettled(
            fileIds.map(id =>
                fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${this.accessToken}` },
                })
            )
        );
    }

    /**
     * Check total size and delete oldest files if > 10GB limit
     */
    async enforceStorageLimit(folderId: string) {
        console.log("Checking storage limit...");
        const files = await this.listFiles(folderId);

        let totalSize = 0;
        const filesToDelete: string[] = [];

        for (const file of files) {
            totalSize += parseInt(file.size || "0", 10);
        }

        console.log(`Current Drive Folder Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        if (totalSize > DRIVE_STORAGE_LIMIT_BYTES) {
            console.log("Storage limit exceeded. Trimming oldest files...");
            for (const file of files) {
                if (totalSize <= DRIVE_STORAGE_LIMIT_BYTES) break;
                const size = parseInt(file.size || "0", 10);
                filesToDelete.push(file.id);
                totalSize -= size;
            }
            await this.deleteFiles(filesToDelete);
        }
    }

    /**
     * Upload a Blob to a specific Drive folder
     */
    async uploadFile(blob: Blob, filename: string, folderId: string): Promise<any> {
        if (!this.accessToken) throw new Error("No token");

        const metadata = {
            name: filename,
            parents: [folderId]
        };

        const formData = new FormData();
        formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        formData.append("file", blob);

        const response = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                },
                body: formData,
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.enforceStorageLimit(folderId).catch(console.error);
        return data;
    }
}

// Export singleton instance
export const driveService = new DriveService();
