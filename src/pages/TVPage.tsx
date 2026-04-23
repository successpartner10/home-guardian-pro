import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    limit,
    deleteDoc,
    doc
} from "firebase/firestore";
import { Tv, Monitor, Smartphone, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const TVPage = () => {
    const [pairingCode, setPairingCode] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        // Generate a random 6-character code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setPairingCode(code);

        // Listen for pairing attempts matching this code
        const q = query(
            collection(db, "pairing"),
            where("code", "==", code),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const pairingDoc = snapshot.docs[0];
                const { token } = pairingDoc.data();
                if (token) {
                    // Clean up pairing doc
                    deleteDoc(doc(db, "pairing", pairingDoc.id));
                    navigate(`/shared/${token}`);
                }
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-white p-6 overflow-hidden ten-ft-ui">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-50" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex flex-col items-center text-center max-w-2xl"
            >
                <div className="h-32 w-32 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center mb-10 shadow-2xl backdrop-blur-md">
                    <Tv className="h-16 w-16 text-primary animate-pulse" />
                </div>

                <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">TV Pairing</h1>
                <p className="text-zinc-200 text-lg font-medium mb-12 max-w-sm">
                    Enter this code on your phone to cast the camera stream instantly to this screen.
                </p>

                <div className="flex gap-4 mb-16">
                    {pairingCode.split('').map((char, i) => (
                        <motion.div
                            key={i}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="h-20 w-16 sm:h-24 sm:w-20 rounded-2xl bg-white/5 border-2 border-white/10 flex items-center justify-center text-4xl sm:text-5xl font-black shadow-2xl backdrop-blur-xl"
                        >
                            {char}
                        </motion.div>
                    ))}
                </div>

                <div className="flex items-center gap-12 p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex flex-col items-center gap-3">
                        <Smartphone className="h-6 w-6 text-zinc-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Phone</span>
                    </div>
                    <ArrowRight className="h-6 w-6 text-primary animate-pulse" />
                    <div className="flex flex-col items-center gap-3">
                        <Monitor className="h-6 w-6 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">This TV</span>
                    </div>
                </div>

                <p className="mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                    Waiting for secure link...
                </p>
            </motion.div>
        </div>
    );
};

export default TVPage;
