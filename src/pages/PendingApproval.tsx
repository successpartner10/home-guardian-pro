import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Shield, Clock, LogOut } from "lucide-react";
import { motion } from "framer-motion";

const PendingApproval = () => {
    const { signOut, user } = useAuth();

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm space-y-8"
            >
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                    <Shield className="h-10 w-10 text-primary" />
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-2 rounded-full border border-dashed border-primary/30"
                    />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">Access Restricted</h1>
                    <p className="text-muted-foreground text-sm">
                        Welcome, <span className="text-foreground font-semibold">{user?.email}</span>.
                        Your account is currently pending approval from the system administrator.
                    </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 bg-muted/30">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Clock className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">Status</p>
                        <p className="text-sm font-semibold">Awaiting Verification</p>
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <p className="text-xs text-muted-foreground italic">
                        Please contact the owner if you believe this is an error.
                    </p>
                    <Button
                        variant="ghost"
                        onClick={() => signOut()}
                        className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                        <LogOut className="h-4 w-4" /> Sign out
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default PendingApproval;
