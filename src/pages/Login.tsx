import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Zap, Cloud, Lock, Gift } from "lucide-react";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleHardReset = async () => {
    if (confirm("This will clear all local data and force a fresh reload. Use this if you are stuck in a login loop. Continue?")) {
      localStorage.clear();
      sessionStorage.clear();
      
      // Unregister all service workers to clear PWA cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Reload the page from the server
      window.location.reload();
    }
  };

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const timeoutId = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          toast({
            title: "Login taking too long?",
            description: "If no window appeared, check if your browser is blocking popups.",
            variant: "default",
          });
          return false;
        }
        return currentLoading;
      });
    }, 15000);

    try {
      await signInWithGoogle();
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      toast({
        title: "Login Error",
        description: error.message || "Failed to start Google sign-in.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden selection:bg-primary selection:text-black">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10 space-y-12"
      >
        <div className="flex flex-col items-center gap-6">
           <Logo size="xl" className="h-48 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-float" />
           <div className="text-center space-y-1">
             <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase">HGUARD <span className="text-primary">ELITE</span></h1>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">Elite Mesh Intelligence</p>
           </div>
        </div>

        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-2xl relative overflow-hidden rounded-[2.5rem] p-4">
          <CardHeader className="space-y-1 text-center pb-8 pt-6">
            <CardTitle className="text-xl font-bold tracking-tight text-white">Welcome Back</CardTitle>
            <CardDescription className="text-[10px] font-bold text-primary uppercase tracking-widest">Protocol Authentication Required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pb-8 flex flex-col items-center px-6">
            <Button
              type="button"
              className="h-16 w-full text-base font-bold tracking-tight rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                     <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Connect with Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <FeatureCard
            icon={<Zap className="w-4 h-4 text-primary" />}
            title="Mesh P2P"
            desc="Direct zero-latency stream"
          />
          <FeatureCard
            icon={<Cloud className="w-4 h-4 text-blue-400" />}
            title="Sync"
            desc="Saves to your own Drive"
          />
        </div>

        <div className="text-center space-y-6">
          <Button
            variant="link"
            onClick={handleHardReset}
            className="text-[9px] font-bold text-white/20 hover:text-white/40 uppercase tracking-widest transition-colors"
          >
            Encryption Reset Hook
          </Button>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[8px] font-bold text-white/10 uppercase tracking-[0.5em]">HGUARD ELITE PROTOCOL v2.5.1</p>
          </div>
        </div>
      </motion.div>
    </div >
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-3xl flex flex-col gap-2 hover:bg-white/[0.05] transition-all duration-300 group">
    <div className="bg-white/5 w-fit p-2 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-all">
      {icon}
    </div>
    <div>
      <h3 className="text-xs font-bold text-white tracking-tight">{title}</h3>
      <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
    </div>
  </div>
);

export default Login;
