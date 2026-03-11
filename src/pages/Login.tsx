import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-y-auto pt-12 pb-24 relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03] z-0 flex items-center justify-center">
        <img src="/logo.png" alt="" className="w-[150%] max-w-none grayscale" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-12 flex flex-col items-center gap-6">
          <div className="flex h-48 w-48 items-center justify-center rounded-[3rem] bg-gradient-to-br from-primary/20 to-transparent glow-primary overflow-hidden p-4 border border-white/10 shadow-2xl">
            <img src="/logo.png" alt="hGuard Logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-center group">
            <h1 className="text-6xl font-black text-foreground tracking-tighter uppercase leading-none mb-2 group-hover:text-primary transition-colors">hGuard</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.5em] opacity-60">Elite Defense Protocol</p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl mb-12 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-black uppercase tracking-tight">Access Terminal</CardTitle>
            <CardDescription className="font-medium">Enter credentials to bypass security layer</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest opacity-60">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-muted/40 border-2 border-border/20 rounded-xl focus:border-primary/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest opacity-60">Security Key</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-muted/40 border-2 border-border/20 rounded-xl pr-12 focus:border-primary/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Link to="/forgot-password" title="Feature coming soon" className="block text-right text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors">
                Recover Access?
              </Link>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="h-14 w-full text-base font-black uppercase tracking-widest shadow-xl shadow-primary/20 rounded-xl" disabled={loading}>
                {loading ? "Decrypting..." : "Initialize Session"}
              </Button>

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">
                New Operative?{" "}
                <Link to="/signup" className="text-primary font-black hover:opacity-80 transition-all">
                  Join Protocol
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Feature Highlights Section */}
        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <FeatureCard
            icon={<Zap className="w-5 h-5 text-yellow-400" />}
            title="Peer-to-Peer"
            desc="Direct video streaming. No central server eyes."
          />
          <FeatureCard
            icon={<Cloud className="w-5 h-5 text-blue-400" />}
            title="Private Cloud"
            desc="Saves to YOUR Google Drive securely."
          />
          <FeatureCard
            icon={<Lock className="w-5 h-5 text-green-400" />}
            title="Privacy First"
            desc="Hardware-level privacy logic."
          />
          <FeatureCard
            icon={<Gift className="w-5 h-5 text-purple-400" />}
            title="100% Free"
            desc="No subscriptions. No hidden costs."
          />
        </div>
      </motion.div>
    </div >
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-4 rounded-2xl bg-card/40 border border-white/5 backdrop-blur-md flex flex-col gap-2 hover:bg-card/60 transition-colors">
    <div className="bg-white/5 w-fit p-2 rounded-xl mb-1">
      {icon}
    </div>
    <h3 className="text-sm font-bold text-foreground">{title}</h3>
    <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed italic">{desc}</p>
  </div>
);

import { Zap, Cloud, Lock, Gift } from "lucide-react";

export default Login;
