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

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      toast({ title: "Check your email", description: "We sent a confirmation link to verify your account." });
      navigate("/login");
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">SecureCam</h1>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl">Create account</CardTitle>
            <CardDescription>Start monitoring in minutes</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" placeholder="John" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-muted/50 pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              <div className="relative w-full my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-base font-semibold transition-colors"
                onClick={signInWithGoogle}
                disabled={loading}
              >
                Continue with Google
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
};

export default Signup;
