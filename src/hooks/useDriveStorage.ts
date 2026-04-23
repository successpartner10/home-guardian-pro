import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { googleDrive } from "@/lib/googleDrive";

const MAX_DRIVE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const PURGE_TARGET_BYTES = 8 * 1024 * 1024 * 1024; // Purge down to 8 GB

/**
 * Check the user's OpenEye_Archive Drive folder size and purge the oldest
 * non-starred clips if the total exceeds 10 GB (FIFO circular buffer).
 */
export const checkAndPurgeStorage = async (
  userId: string,
  providerToken: string
): Promise<void> => {
  if (!providerToken) return;

  try {
    console.log("[DriveStorage] Checking storage usage...");

    // 1. List all files in the Drive folder
    const files = await googleDrive.listFiles(providerToken);
    if (!files || files.length === 0) return;

    // 2. Calculate total size
    const totalBytes = files.reduce((sum: number, f: any) => sum + parseInt(f.size || "0", 10), 0);
    console.log(`[DriveStorage] Total usage: ${(totalBytes / 1e9).toFixed(2)} GB`);

    if (totalBytes <= MAX_DRIVE_BYTES) return; // Under limit, no purge needed

    // 3. Get starred alert IDs from Firestore so we can protect them
    const alertsSnap = await getDocs(
      query(collection(db, "alerts"), where("user_id", "==", userId), where("starred", "==", true))
    );
    const starredFiles = new Set(alertsSnap.docs.map(d => d.data().thumbnail_url).filter(Boolean));

    // 4. Sort non-starred files oldest-first
    const candidates = files
      .filter((f: any) => !starredFiles.has(f.name) && f.size)
      .sort((a: any, b: any) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());

    // 5. Delete oldest until under 8 GB
    let freed = 0;
    const targetFree = totalBytes - PURGE_TARGET_BYTES;
    for (const file of candidates) {
      if (freed >= targetFree) break;
      console.log(`[DriveStorage] Purging old file: ${file.name} (${(parseInt(file.size) / 1e6).toFixed(1)} MB)`);
      await googleDrive.deleteFile(file.id, providerToken);
      freed += parseInt(file.size || "0", 10);
    }

    console.log(`[DriveStorage] Purge complete. Freed ${(freed / 1e9).toFixed(2)} GB.`);
  } catch (e) {
    console.error("[DriveStorage] Purge error:", e);
  }
};

/**
 * Toggle the starred state of an alert clip. Starred clips are never purged.
 */
export const toggleStarAlert = async (alertId: string, currentStarred: boolean): Promise<void> => {
  await updateDoc(doc(db, "alerts", alertId), { starred: !currentStarred });
};
