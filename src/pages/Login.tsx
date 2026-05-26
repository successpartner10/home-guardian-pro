import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Zap, Cloud, Mail, Lock, ChevronDown } from "lucide-react";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signInWithGoogle, signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleHardReset = async () => {
    if (confirm("This will clear all local data and force a fresh reload. Use this if you are stuck in a login loop. Continue?")) {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      window.location.reload();
    }
  };

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: "Google Login Failed",
        description: error.message || "Try email/password login below.",
        variant: "destructive",
      });
      setShowEmailForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (signInError: any) {
      // If sign-in fails, try creating account
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
        try {
          await signUp(email, password);
          toast({ title: "Account created", description: "Welcome to HGUARD!" });
        } catch (signUpError: any) {
          toast({
            title: "Login Failed",
            description: signUpError.message || "Check your email and password.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Login Failed",
          description: signInError.message || "Check your email and password.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden selection:bg-primary selection:text-black">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10 space-y-8"
      >
        <div className="flex flex-col items-center gap-6">
          <Logo size="xl" className="h-48 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-float" />
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-white">HGUARD</h1>
            <p className="text-sm text-muted-foreground">Turn old phones into home security cameras</p>
          </div>
        </div>

        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-2xl relative overflow-hidden rounded-[2.5rem] p-4">
          <CardHeader className="space-y-1 text-center pb-6 pt-6">
            <CardTitle className="text-xl font-bold tracking-tight text-white">Welcome Back</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">Sign in to watch and manage your cameras</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 flex flex-col items-center px-6">
            {/* Google Login */}
            <Button
              type="button"
              id="google-login-btn"
              className="h-14 w-full text-base font-bold tracking-tight rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading && !showEmailForm ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center w-full gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Email/Password Toggle */}
            <Button
              type="button"
              id="email-toggle-btn"
              variant="ghost"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="w-full h-12 border border-white/10 rounded-2xl text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight"
            >
              <Mail className="w-4 h-4" />
              Sign in with Email
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`} />
            </Button>

            {/* Email/Password Form */}
            <AnimatePresence>
              {showEmailForm && (
                <motion.form
                  id="email-login-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleEmailLogin}
                  className="w-full space-y-3 overflow-hidden"
                >
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-primary"
                    autoComplete="email"
                  />
                  <Input
                    id="password-input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-primary"
                    autoComplete="current-password"
                  />
                  <Button
                    id="email-submit-btn"
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full h-12 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Access System
                      </>
                    )}
                  </Button>
                  <p className="text-center text-[10px] text-white/30">
                    New user? Enter your email + a password to auto-register.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <FeatureCard icon={<Zap className="w-4 h-4 text-primary" />} title="Live video" desc="Watch from anywhere" />
          <FeatureCard icon={<Cloud className="w-4 h-4 text-blue-400" />} title="Cloud clips" desc="Saved to your Google Drive" />
        </div>

        <div className="text-center space-y-6">
          <Button
            variant="link"
            onClick={handleHardReset}
            className="text-[9px] font-bold text-white/20 hover:text-white/40 uppercase tracking-widest transition-colors"
          >
            Stuck signing in? Reset app data
          </Button>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[8px] font-bold text-white/10 tracking-wide">HGUARD v2.5.2</p>
          </div>
        </div>
      </motion.div>
    </div>
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
