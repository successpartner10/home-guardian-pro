import { useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    limit,
    Timestamp
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useGlobalAlerts = () => {
    const { user, profileData } = useAuth();
    const { toast } = useToast();
    const initializedAt = useRef(Timestamp.now());

    useEffect(() => {
        if (!user) return;

        const playNotification = async () => {
            const pref = profileData?.notifications || "ring";

            if (pref === "mute") return;

            if (pref === "vibrate" && "vibrate" in navigator) {
                navigator.vibrate([200, 100, 200]);
            }

            if (pref === "ring") {
                try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4

                    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.5);
                } catch (e) {
                    console.error("Failed to play notification sound:", e);
                }
            }
        };

        const q = query(
            collection(db, "alerts"),
            where("user_id", "==", user.uid),
            orderBy("created_at", "desc"),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) return;

            const newAlert = snapshot.docs[0].data();
            const createdAt = newAlert.created_at as Timestamp;

            // Only notify for alerts created after we started listening
            if (createdAt && createdAt.toMillis() > initializedAt.current.toMillis()) {
                playNotification();
                toast({
                    title: "Security Alert",
                    description: `New ${newAlert.type || 'activity'} detected.`,
                });
            }
        });

        return () => unsubscribe();
    }, [user, profileData, toast]);
};
