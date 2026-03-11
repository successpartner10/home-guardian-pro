import { get, set, del } from 'idb-keyval';

export const LOCAL_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const DIR_HANDLE_KEY = 'hguard-storage-dir-handle';

export interface LocalFile {
    id: string; // Using name as ID for local files
    name: string;
    size: number;
    createdTime: number;
    handle: FileSystemFileHandle;
}

export class LocalFileSystem {
    private dirHandle: FileSystemDirectoryHandle | null = null;

    async init(): Promise<boolean> {
        try {
            const handle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
            if (handle) {
                // Automatically ask for permission if we have the handle but not the rights
                if (await this.verifyPermission(handle, { mode: 'readwrite' })) {
                    this.dirHandle = handle;
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error("Failed to init local file system:", e);
            return false;
        }
    }

    isReady(): boolean {
        return this.dirHandle !== null;
    }

    async selectDirectory(): Promise<boolean> {
        try {
            if (!('showDirectoryPicker' in window)) {
                throw new Error('File System Access API not supported in this browser.');
            }

            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });

            this.dirHandle = handle;
            await set(DIR_HANDLE_KEY, handle);
            return true;
        } catch (e) {
            console.error("Failed to select directory:", e);
            return false;
        }
    }

    async clearDirectory() {
        this.dirHandle = null;
        await del(DIR_HANDLE_KEY);
    }

    private async verifyPermission(fileHandle: any, options: any) {
        // @ts-ignore
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        // @ts-ignore
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    async listFiles(): Promise<LocalFile[]> {
        if (!this.dirHandle) return [];

        // Ensure we still have permission (e.g., after a browser restart)
        if (!(await this.verifyPermission(this.dirHandle, { mode: 'readwrite' }))) {
            return [];
        }

        const files: LocalFile[] = [];
        try {
            // @ts-ignore - TS doesn't always know async iterators on handles
            for await (const entry of this.dirHandle.values()) {
                if (entry.kind === 'file') {
                    const fileHandle = entry as FileSystemFileHandle;
                    const file = await fileHandle.getFile();
                    files.push({
                        id: file.name,
                        name: file.name,
                        size: file.size,
                        createdTime: file.lastModified,
                        handle: fileHandle
                    });
                }
            }
            // Sort oldest first (for easy deletion logic later)
            return files.sort((a, b) => a.createdTime - b.createdTime);
        } catch (e) {
            console.error("Failed to list files:", e);
            return [];
        }
    }

    async saveFile(name: string, blob: Blob): Promise<boolean> {
        if (!this.dirHandle) return false;

        try {
            // Enforce limits before saving
            await this.enforceStorageLimit();

            const fileHandle = await this.dirHandle.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (e) {
            console.error("Failed to save local file:", e);
            return false;
        }
    }

    async deleteFiles(fileNames: string[]): Promise<void> {
        if (!this.dirHandle) return;

        for (const name of fileNames) {
            try {
                await this.dirHandle.removeEntry(name);
            } catch (e) {
                console.error(`Failed to delete file ${name}:`, e);
            }
        }
    }

    async enforceStorageLimit() {
        if (!this.dirHandle) return;

        try {
            const files = await this.listFiles();
            let totalSize = files.reduce((sum, file) => sum + file.size, 0);

            if (totalSize > LOCAL_STORAGE_LIMIT_BYTES) {
                console.log("Local storage limit exceeded. Trimming oldest files...");
                const filesToDelete: string[] = [];

                // Files are already sorted oldest first
                for (const file of files) {
                    if (totalSize <= LOCAL_STORAGE_LIMIT_BYTES) break;
                    filesToDelete.push(file.name);
                    totalSize -= file.size;
                }

                await this.deleteFiles(filesToDelete);
            }
        } catch (e) {
            console.error("Error enforcing storage limit:", e);
        }
    }
}

export const localFileSystem = new LocalFileSystem();
