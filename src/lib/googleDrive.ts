export class GoogleDriveStorage {
    async listFiles(accessToken: string, folderId?: string): Promise<any[]> {
        try {
            let q = "trashed=false";
            if (folderId) q += ` and '${folderId}' in parents`;
            const query = encodeURIComponent(q);
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,mimeType)&orderBy=createdTime desc&pageSize=1000`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!response.ok) throw new Error(`List failed: ${response.statusText}`);
            const data = await response.json();
            return data.files || [];
        } catch (e) {
            console.error('listFiles Error:', e);
            return [];
        }
    }

    async getFileIdByName(name: string, accessToken: string): Promise<string | null> {
        try {
            const query = encodeURIComponent(`name='${name}' and trashed=false`);
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }
            return null;
        } catch (e) {
            console.error('getFileIdByName Error:', e);
            return null;
        }
    }

    async downloadFile(fileId: string, accessToken: string): Promise<Blob | null> {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

            return await response.blob();
        } catch (e) {
            console.error('downloadFile Error:', e);
            return null;
        }
    }

    async getFileUrl(fileId: string, accessToken: string): Promise<string | null> {
      const blob = await this.downloadFile(fileId, accessToken);
      if (blob) return URL.createObjectURL(blob);
      return null;
    }

    async saveFile(name: string, blob: Blob, accessToken: string): Promise<string | null> {
        try {
            const metadata = {
                name: name,
                mimeType: blob.type,
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: form,
            });

            if (response.status === 401) {
                console.error("[Drive] Access token expired or invalid.");
                return null;
            }

            if (!response.ok) {
                throw new Error(`Google Drive upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Saved to Google Drive:', data);
            return data.id || "success";
        } catch (e) {
            console.error('Save to Google Drive Error:', e);
            return null;
        }
    }

    async deleteFile(fileId: string, accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return response.ok;
        } catch (e) {
            console.error('deleteFile Error:', e);
            return false;
        }
    }

    async getStorageQuota(accessToken: string): Promise<{ used: number, limit: number }> {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/about?fields=storageQuota`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!response.ok) throw new Error(`Quota fetch failed: ${response.statusText}`);
            const data = await response.json();
            return {
                used: parseInt(data.storageQuota.usage || "0"),
                limit: parseInt(data.storageQuota.limit || "0")
            };
        } catch (e) {
            console.error('getStorageQuota Error:', e);
            return { used: 0, limit: 15 * 1024 * 1024 * 1024 }; // Fallback to 15GB if fetch fails
        }
    }

    async ensureFolder(folderName: string, accessToken: string): Promise<string | null> {
        const existingId = await this.getFileIdByName(folderName, accessToken);
        if (existingId) return existingId;

        try {
            const metadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            };
            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(metadata),
            });
            const data = await response.json();
            return data.id;
        } catch (e) {
            console.error('ensureFolder Error:', e);
            return null;
        }
    }

    async enforceQuota(accessToken: string, maxSizeBytes = 10 * 1024 * 1024 * 1024): Promise<void> {
        try {
            const files = await this.listFiles(accessToken);
            let totalSize = files.reduce((acc, f) => acc + parseInt(f.size || "0"), 0);
            
            if (totalSize > maxSizeBytes) {
                console.log(`[Drive] Quota exceeded (${Math.round(totalSize/1024/1024)}MB). Purging oldest files...`);
                // Sort by creation time (ascending = oldest first)
                const sorted = [...files].sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
                
                let deletedSize = 0;
                const targetPurgeSize = 1024 * 1024 * 1024; // Purge 1GB

                for (const file of sorted) {
                    if (deletedSize >= targetPurgeSize) break;
                    const success = await this.deleteFile(file.id, accessToken);
                    if (success) {
                        deletedSize += parseInt(file.size || "0");
                        console.log(`[Drive] Purged: ${file.name}`);
                    }
                }
            }
        } catch (e) {
            console.error('enforceQuota Error:', e);
        }
    }
}

export const googleDrive = new GoogleDriveStorage();
