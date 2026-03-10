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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-y-auto pt-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">SecureCam</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-70">Private Security Protocol</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl mb-12 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to monitor your secure network</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-muted/40 border-border/40 focus:bg-muted/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-muted/40 border-border/40 pr-12 focus:bg-muted/60"
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
              <Link to="/forgot-password" disabled className="block text-right text-xs text-primary/80 hover:text-primary hover:underline transition-colors">
                Forgot password?
              </Link>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="h-12 w-full text-base font-bold shadow-lg shadow-primary/20" disabled={loading}>
                {loading ? "Establishing..." : "Enter Secure Mode"}
              </Button>
              <p className="text-sm text-muted-foreground">
                First time here?{" "}
                <Link to="/signup" className="text-primary font-semibold hover:glow-primary transition-all">
                  Sign up for free
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
    </div>
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
