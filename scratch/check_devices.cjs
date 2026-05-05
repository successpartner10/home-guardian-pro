
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCtuLdRPzNGG7ReAoe8U11YVosglM2jaAo",
    authDomain: "hguard-elite.firebaseapp.com",
    projectId: "hguard-elite",
    storageBucket: "hguard-elite.firebasestorage.app",
    messagingSenderId: "1057882843675",
    appId: "1:1057882843675:web:bb6891839a545c410c66be",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDevices() {
    const snap = await getDocs(collection(db, "devices"));
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`Device: ${data.name} | Type: ${data.type} | Status: ${data.status} | Last Seen: ${data.last_seen?.toDate()}`);
    });
    process.exit(0);
}

checkDevices().catch(err => {
    console.error(err);
    process.exit(1);
});
