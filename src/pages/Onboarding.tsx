import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";
import { Camera, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const selectRole = async (role: "camera" | "viewer") => {
    if (!user || loading) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "devices"), {
        user_id: user.uid,
        name: role === "camera" ? "My Camera" : "My Viewer",
        type: role,
        status: "offline",
        created_at: serverTimestamp(),
      });
      navigate(role === "camera" ? "/camera" : "/dashboard");
    } catch (e) {
      console.error("[Onboarding] Failed to create device:", e);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 p-6 relative overflow-hidden selection:bg-primary selection:text-black">
      {/* Background watermark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.05] z-0 flex items-center justify-center">
        <Logo size="xl" className="w-[140%] h-[140%] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg text-center space-y-12"
      >
        {/* Header */}
        <div className="space-y-6">
          <div className="relative group mx-auto w-fit">
             <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full scale-75 group-hover:scale-110 transition-transform duration-1000" />
             <Logo size="lg" className="h-32 w-32 drop-shadow-[0_20px_50px_rgba(234,179,8,0.2)] relative z-10" />
          </div>
          <div className="text-center">
            <h1 className="text-6xl font-black uppercase tracking-[-0.05em] text-white leading-none mb-2">HGUARD</h1>
            <div className="flex items-center gap-4 justify-center opacity-60">
              <div className="h-[1px] w-10 bg-primary rounded-full" />
              <p className="text-[10px] text-primary font-[1000] uppercase tracking-[0.5em]">Home protection</p>
              <div className="h-[1px] w-10 bg-primary rounded-full" />
            </div>
          </div>
          <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
            Welcome to HGUARD. How will you use this device?
          </p>
        </div>

        {/* Role Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => selectRole("camera")}
            disabled={loading}
            className="group relative flex flex-col items-center gap-6 p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/10 hover:border-primary/50 backdrop-blur-3xl transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-primary/10 disabled:opacity-50"
          >
            <div className="h-28 w-28 rounded-[2.5rem] bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-500 border border-primary/20 group-hover:border-primary/40 shadow-inner">
              <Camera className="h-14 w-14 text-primary drop-shadow-glow" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Camera</h2>
              <p className="text-[10px] font-[1000] text-white/30 uppercase tracking-[0.3em]">
                Make this a camera
              </p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => selectRole("viewer")}
            disabled={loading}
            className="group relative flex flex-col items-center gap-6 p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/10 hover:border-white/40 backdrop-blur-3xl transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-white/5 disabled:opacity-50"
          >
            <div className="h-28 w-28 rounded-[2.5rem] bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all duration-500 border border-white/10 group-hover:border-white/20 shadow-inner">
              <MonitorSmartphone className="h-14 w-14 text-white/60 group-hover:text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Viewer</h2>
              <p className="text-[10px] font-[1000] text-white/30 uppercase tracking-[0.3em]">
                Watch your home
              </p>
            </div>
          </motion.button>
        </div>

        {loading && (
          <div className="flex justify-center pt-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-glow" />
          </div>
        )}

        <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.5em] pt-4">
          Version: {(window as any).hGuard_Version || "v2.5.2"}
        </p>
      </motion.div>
    </div>
  );
};

export default Onboarding;
