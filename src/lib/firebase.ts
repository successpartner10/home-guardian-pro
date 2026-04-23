import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCtuLdRPzNGG7ReAoe8U11YVosglM2jaAo",
    authDomain: "hguard-elite.firebaseapp.com",
    projectId: "hguard-elite",
    storageBucket: "hguard-elite.firebasestorage.app",
    messagingSenderId: "1057882843675",
    appId: "1:1057882843675:web:bb6891839a545c410c66be",
    measurementId: "G-ZCEDES1HY4"
};

const app = initializeApp(firebaseConfig);
export { signInWithRedirect } from "firebase/auth";
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
// Add other scopes if needed (e.g. drive.readonly if we want to list)
googleProvider.addScope("https://www.googleapis.com/auth/drive.install");
googleProvider.setCustomParameters({
    prompt: "select_account"
});
