export class GoogleDriveStorage {
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

    async saveFile(name: string, blob: Blob, accessToken: string): Promise<boolean> {
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

            if (!response.ok) {
                throw new Error(`Google Drive upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Saved to Google Drive:', data);
            return true;
        } catch (e) {
            console.error('Save to Google Drive Error:', e);
            return false;
        }
    }
}

export const googleDrive = new GoogleDriveStorage();
