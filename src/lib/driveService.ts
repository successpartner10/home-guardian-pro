export const DRIVE_FOLDER_ID = "1wnxHFaXI43BA7_5Lc32Fhq8r64XV038O";
export const DRIVE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export interface DriveFile {
    id: string;
    name: string;
    size: string;
    createdTime: string;
    thumbnailLink?: string;
}

export class DriveService {
    private accessToken: string | null = null;

    setToken(token: string) {
        this.accessToken = token;
    }

    clearToken() {
        this.accessToken = null;
    }

    isReady() {
        return !!this.accessToken;
    }

    private async fetchApi(path: string, options: RequestInit = {}) {
        if (!this.accessToken) {
            throw new Error("Google Drive access token is not set.");
        }

        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${this.accessToken}`);

        const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Drive API Error:", errorText);
            throw new Error(`Drive API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * List files in the designated folder ordered by creation time
     */
    async listFiles(): Promise<DriveFile[]> {
        const query = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and trashed=false`);
        const fields = encodeURIComponent("files(id, name, size, createdTime, thumbnailLink)");

        try {
            const data = await this.fetchApi(`/files?q=${query}&fields=${fields}&orderBy=createdTime asc`);
            return data.files || [];
        } catch (e) {
            console.error("Failed to list internal files", e);
            return [];
        }
    }

    /**
     * Delete specific files
     */
    async deleteFiles(fileIds: string[]) {
        if (!this.accessToken) return;

        // We can use a batch request, or run them sequentially. For simplicity and reliability, 
        // run sequentially with Promise.all
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
     * Delete all files in the folder (Bulk Delete)
     */
    async deleteAllFiles() {
        const files = await this.listFiles();
        const ids = files.map(f => f.id);
        await this.deleteFiles(ids);
    }

    /**
     * Check total size and delete oldest files if > 10GB limit
     */
    async enforceStorageLimit() {
        console.log("Checking storage limit...");
        const files = await this.listFiles();

        let totalSize = 0;
        const filesToDelete: string[] = [];

        // Calculate total size
        for (const file of files) {
            totalSize += parseInt(file.size || "0", 10);
        }

        console.log(`Current Drive Folder Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        // If over limit, start deleting the oldest files (files are sorted ascending by createdTime)
        if (totalSize > DRIVE_STORAGE_LIMIT_BYTES) {
            console.log("Storage limit exceeded. Trimming oldest files...");
            for (const file of files) {
                if (totalSize <= DRIVE_STORAGE_LIMIT_BYTES) break;

                const size = parseInt(file.size || "0", 10);
                filesToDelete.push(file.id);
                totalSize -= size;
            }

            console.log(`Deleting ${filesToDelete.length} files to free up space.`);
            await this.deleteFiles(filesToDelete);
        }
    }

    /**
     * Upload a Blob to the Drive folder using simple upload format
     */
    async uploadFile(blob: Blob, filename: string): Promise<any> {
        if (!this.accessToken) throw new Error("No token");

        const metadata = {
            name: filename,
            parents: [DRIVE_FOLDER_ID]
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

        // After upload, enforce the limit in the background
        this.enforceStorageLimit().catch(console.error);

        return data;
    }
}

// Export singleton instance
export const driveService = new DriveService();
