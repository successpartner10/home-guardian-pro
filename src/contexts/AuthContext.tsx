import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { Capacitor } from '@capacitor/core';
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
  browserLocalPersistence,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  browserPopupRedirectResolver,
  signInWithCredential
} from "firebase/auth";
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
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
  sendLoginLink: (email: string) => Promise<void>;
  relinkGoogle: () => Promise<void>;
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
        const result = await getRedirectResult(auth, browserPopupRedirectResolver);
        if (result) {
          console.log("[Auth] Redirect result processed for:", result.user.email);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          handleCredential(credential);
        }

        // 3. Handle incoming Email Magic Link
        if (isSignInWithEmailLink(auth, window.location.href)) {
          console.log("[Auth] Detected Email Magic Link in URL.");
          let email = window.localStorage.getItem('emailForSignIn');
          if (!email) {
            // If they opened the link on a different device, prompt them (we'll just use a basic prompt for simplicity here)
            email = window.prompt('Please provide your email for confirmation');
          }
          if (email) {
            try {
              const linkResult = await signInWithEmailLink(auth, email, window.location.href);
              console.log("[Auth] Successfully signed in with magic link:", linkResult.user.email);
              window.localStorage.removeItem('emailForSignIn');
              // Clear the URL params so it doesn't try to sign in again on refresh
              window.history.replaceState(null, '', window.location.pathname);
            } catch (err) {
              console.error("[Auth] Error signing in with magic link:", err);
            }
          }
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
 
          if (isPrimaryAdmin) setIsApproved(true);

          // Get profile with timeout
          const docSnap = await Promise.race([
            getDoc(docRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]).catch(err => {
            console.error("[Auth] Profile fetch failed/timed out:", err);
            return null;
          }) as any;
 
          if (docSnap && !docSnap.exists()) {
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
            if (snap.exists()) {
              const data = snap.data();
              
              // ── Force Reauth Check ──────────────────────────────────────────
              const forceReauthAt: number | undefined = data.force_reauth_at?.toMillis
                ? data.force_reauth_at.toMillis()
                : typeof data.force_reauth_at === 'number'
                  ? data.force_reauth_at
                  : undefined;
                  
              if (forceReauthAt && forceReauthAt > sessionStartTime) {
                await firebaseSignOut(auth);
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "/login";
                return;
              }
              // ───────────────────────────────────────────────────────────────

              setProfileData(data);
              setIsApproved(data.is_approved || (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()));
              
              if (data.ai_provider) aiOrchestrator.setProvider(data.ai_provider);
              
              const currentMonth = new Date().getMonth();
              if (data.ai_reset_month !== currentMonth) {
                updateDoc(docRef, { ai_events_this_month: 0, ai_reset_month: currentMonth }).catch(() => {});
                setAiEventsThisMonth(0);
              } else {
                setAiEventsThisMonth(data.ai_events_this_month || 0);
              }
            }
            setLoading(false); // Set loading false after profile snapshot
          }, (err) => {
            console.error("[Auth] Profile snapshot error:", err);
            setLoading(false);
          });

          // NUCLEAR CLEANUP: If Admin, purge any 'Ghost' devices older than 5 minutes
          if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            const cleanupMesh = async () => {
              const now = Date.now();
              const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
              const snap = await getDocs(query(collection(db, "devices"), where("user_id", "==", currentUser.uid)));
              for (const d of snap.docs) {
                const data = d.data();
                const updatedAt = data.updated_at?.toDate ? data.updated_at.toDate() : new Date(0);
                if (updatedAt < fiveMinutesAgo) await deleteDoc(doc(db, "devices", d.id)).catch(() => {});
              }
            };
            cleanupMesh();
          }

        } catch (error) {
          console.error("[Auth] Post-auth error:", error);
          setLoading(false);
        }
      } else {
        setProfileData(null);
        setIsApproved(false);
        if (unsubscribeProfile) unsubscribeProfile();
        localStorage.removeItem("google_drive_token");
        setLoading(false);
      }
    });

    // Final safety timeout — if neither onAuthStateChanged nor its children set loading to false
    const safetyTimeout = setTimeout(() => setLoading(false), 12000);

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log("[Auth] signInWithGoogle invoked.");
      googleProvider.setCustomParameters({ prompt: "select_account" });

      // On native Android, use the official native Google Sign-In SDK
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
      
      if (isNative || Capacitor.isNativePlatform()) {
        try {
          const result = await FirebaseAuthentication.signInWithGoogle();
          if (!result.credential) throw new Error("No credential returned from native sign-in");
          
          const credential = GoogleAuthProvider.credential(
            result.credential.idToken,
            result.credential.accessToken
          );
          
          const authResult = await signInWithCredential(auth, credential);
          handleCredential(credential);
          return;
        } catch (e: any) {
          const errStr = e.message || JSON.stringify(e);
          throw new Error(`NATIVE_ERR: ${errStr}`);
        }
      }

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
      console.error("[Auth] Google Sign-In failed:", error);
      const errorMessage = error.message || (error.code ? `Error ${error.code}` : JSON.stringify(error, Object.getOwnPropertyNames(error)));
      throw new Error(`Google Login Failed: ${errorMessage}`);
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

  const relinkGoogle = async () => {
    try {
      console.log("[Auth] Re-linking Google account for Drive scopes...");
      googleProvider.setCustomParameters({ prompt: "consent" });

      // On native Android, use the official native Google Sign-In SDK
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
      
      if (isNative || Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (!result.credential) throw new Error("No credential returned from native sign-in");
        const credential = GoogleAuthProvider.credential(
          result.credential.idToken,
          result.credential.accessToken
        );
        await signInWithCredential(auth, credential);
        handleCredential(credential);
        return;
      }

      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      handleCredential(credential);
      toast({ title: "Google Drive Connected", description: "Storage access has been restored." });
    } catch (error: any) {
      console.error("[Auth] Re-link failed:", error);
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    }
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
    <AuthContext.Provider value={{ user, profileData, loading, isApproved, isAdmin, aiDegraded, aiEventsThisMonth, signInWithGoogle, signOut, signUp, signIn, forceLogoutAllDevices, relinkGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
