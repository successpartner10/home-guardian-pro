import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useGlobalAlerts = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!user) return;

        const playNotification = async () => {
            const pref = user.user_metadata?.notifications || "ring";

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

        const channel = supabase
            .channel("global-alerts")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "alerts",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    // Trigger notification
                    playNotification();

                    // Show toast
                    toast({
                        title: "Security Alert",
                        description: `New ${payload.new.type} detected.`,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast]);
};
