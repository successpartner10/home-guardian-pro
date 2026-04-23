import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  Timestamp,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { aiOrchestrator } from "@/lib/ai/aiOrchestrator";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  profileData: any | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  aiDegraded: boolean;
  aiEventsThisMonth: number;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  forceLogoutAllDevices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAIL = "successpartner10@gmail.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiEventsThisMonth, setAiEventsThisMonth] = useState(0);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const AI_EVENT_LIMIT = 1000;
  const aiDegraded = aiEventsThisMonth >= AI_EVENT_LIMIT;

  // Record when this browser session started — used to detect force-reauth from other devices
  const sessionStartTime = useRef<number>(
    (() => {
      const stored = sessionStorage.getItem("hguard_session_start");
      if (stored) return parseInt(stored, 10);
      const now = Date.now();
      sessionStorage.setItem("hguard_session_start", String(now));
      return now;
    })()
  ).current;

  const handleCredential = (credential: any) => {
    if (credential) {
      const token = (credential as any).accessToken;
      if (token) {
        console.log("[Auth] Captured Google Drive Access Token");
        localStorage.setItem("google_drive_token", token);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Force persistence mode first
        await setPersistence(auth, browserLocalPersistence);
        console.log("[Auth] Persistence set to Local");

        // 2. Handle redirect result BEFORE onAuthStateChanged fires too many updates
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("[Auth] Redirect result processed for:", result.user.email);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          handleCredential(credential);
        }
      } catch (error: any) {
        console.error("[Auth] Initialization error:", error.code, error.message);
      }
      // Do NOT setLoading(false) here — let onAuthStateChanged be the sole authority
    };

    initAuth();
    
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log("[Auth] onAuthStateChanged:", currentUser ? `${currentUser.email} (${currentUser.uid})` : "no user");
 
      if (currentUser) {
        try {
          const isPrimaryAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          const docRef = doc(db, "profiles", currentUser.uid);
 
          // Fast-track admin approval state for UI
          if (isPrimaryAdmin) setIsApproved(true);

          const docSnap = await getDoc(docRef).catch(err => {
            console.error("[Auth] Profile getDoc failed:", err);
            return null;
          });
 
          if (docSnap && !docSnap.exists()) {
            console.log("[Auth] Profile missing. Creating...");
            await setDoc(docRef, {
              email: currentUser.email,
              display_name: currentUser.displayName || "",
              is_approved: isPrimaryAdmin,
              auto_upgrade_ai: true,
              ai_provider: 'gemma',
              created_at: new Date().toISOString()
            }).catch(e => console.error("[Auth] Profile creation failed:", e));
          }
 
          unsubscribeProfile = onSnapshot(docRef, async (snap) => {
            const isPrimaryAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            if (isPrimaryAdmin) setIsApproved(true);
            
            if (snap.exists()) {
              const data = snap.data();
              console.log("[Auth] Profile snapshot update received.");

              // ── Force Reauth Check ──────────────────────────────────────────
              // If another device (or admin) triggered a global logout after this
              // session started, sign out, clear all local caches, and reload.
              const forceReauthAt: number | undefined = data.force_reauth_at?.toMillis
                ? data.force_reauth_at.toMillis()
                : typeof data.force_reauth_at === 'number'
                  ? data.force_reauth_at
                  : undefined;
              if (forceReauthAt && forceReauthAt > sessionStartTime) {
                console.warn("[Auth] Force reauth detected — clearing session and signing out.");
                await firebaseSignOut(auth);
                // Nuke all local storage & caches
                localStorage.clear();
                sessionStorage.clear();
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }
                window.location.href = "/login";
                return;
              }
              // ───────────────────────────────────────────────────────────────

              setProfileData(data);
              setIsApproved(data.is_approved || isPrimaryAdmin);
              
              if (data.ai_provider) {
                aiOrchestrator.setProvider(data.ai_provider);
              }

              // Monthly reset logic...
              const currentMonth = new Date().getMonth();
              if (data.ai_reset_month !== currentMonth) {
                const { updateDoc: updateDocFn } = await import('firebase/firestore');
                await updateDocFn(docRef, { ai_events_this_month: 0, ai_reset_month: currentMonth }).catch(() => {});
                setAiEventsThisMonth(0);
              } else {
                setAiEventsThisMonth(data.ai_events_this_month || 0);
              }
            }
          }, (err) => console.error("[Auth] Profile snapshot error:", err));
          // NUCLEAR CLEANUP: If Admin, purge any 'Ghost' devices older than 5 minutes
          if (isPrimaryAdmin) {
            const cleanupMesh = async () => {
              console.log("[Auth] Starting Nuclear Mesh Cleanup...");
              const now = Date.now();
              const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
              
              const devicesRef = collection(db, "devices");
              const q = query(devicesRef, where("user_id", "==", currentUser.uid));
              const snap = await getDocs(q);
              
              let purgeCount = 0;
              for (const d of snap.docs) {
                const data = d.data();
                const updatedAt = data.updated_at?.toDate ? data.updated_at.toDate() : new Date(0);
                
                // Nuclear rule: If offline AND older than 2 mins
                if (updatedAt < twoMinutesAgo) {
                  console.log(`[Auth] Purging stale ghost device: ${d.id} (${data.name})`);
                  await deleteDoc(doc(db, "devices", d.id)).catch(() => {});
                  purgeCount++;
                }
              }
              if (purgeCount > 0) console.log(`[Auth] Purged ${purgeCount} stale instances.`);
            };
            cleanupMesh();
          }

        } catch (error) {
          console.error("[Auth] Initialization error:", error);
        }
      } else {
        setProfileData(null);
        setIsApproved(false);
        if (unsubscribeProfile) unsubscribeProfile();
        localStorage.removeItem("google_drive_token");
      }
 
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log("[Auth] signInWithGoogle invoked.");
      googleProvider.setCustomParameters({ prompt: "select_account" });

      // ALWAYS try popup first — signInWithRedirect is broken by Chrome's COOP policy
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        handleCredential(credential);
        console.log("[Auth] Popup sign-in succeeded.");
      } catch (popupError: any) {
        // Only fall back to redirect if popup was truly blocked by the browser
        if (popupError.code === 'auth/popup-blocked') {
          console.log("[Auth] Popup blocked — falling back to Redirect.");
          await signInWithRedirect(auth, googleProvider);
        } else if (popupError.code === 'auth/popup-closed-by-user') {
          console.log("[Auth] User closed popup.");
          // Don't throw — user intentionally cancelled
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error("[Auth] Google Sign-In failed:", error.code, error.message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem("google_drive_token");
  };

  // Writes a force_reauth_at timestamp to Firestore.
  // Every device listening via onSnapshot will detect this and sign itself out.
  const forceLogoutAllDevices = async () => {
    if (!user) return;
    await updateDoc(doc(db, "profiles", user.uid), {
      force_reauth_at: serverTimestamp()
    });
  };

  return (
    <AuthContext.Provider value={{ user, profileData, loading, isApproved, isAdmin, aiDegraded, aiEventsThisMonth, signInWithGoogle, signOut, signUp, signIn, forceLogoutAllDevices }}>
      {children}
    </AuthContext.Provider>
  );
};
