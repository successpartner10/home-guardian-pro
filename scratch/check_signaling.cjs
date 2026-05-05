
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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

async function checkSignaling() {
    const deviceId = "rLxm06pXDBIU3MdZQLmE";
    const q = query(collection(db, "signaling"), where("deviceId", "==", deviceId));
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} signals for device ${deviceId}`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`- Type: ${data.type} | From: ${data.from} | To: ${data.to} | Created: ${data.created_at?.toDate()}`);
    });
    process.exit(0);
}

checkSignaling().catch(err => {
    console.error(err);
    process.exit(1);
});
