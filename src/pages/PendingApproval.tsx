import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Shield, Clock, LogOut } from "lucide-react";
import { motion } from "framer-motion";

const PendingApproval = () => {
    const { signOut, user } = useAuth();

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center tracking-tighter">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md space-y-10"
            >
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary/10 border-2 border-primary/20 shadow-2xl">
                    <Shield className="h-12 w-12 text-primary" />
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-4 rounded-full border-2 border-dashed border-primary/20"
                    />
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-black uppercase leading-tight tracking-tighter">Access Reserved</h1>
                    <p className="text-muted-foreground text-lg font-medium max-w-xs mx-auto">
                        Node <span className="text-foreground font-black">{user?.email?.split('@')[0]}</span> is verified but awaiting administrative clearance.
                    </p>
                </div>

                <div className="zoomon-card p-8 flex items-center gap-6 bg-primary/5 border-2 border-primary/10">
                    <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Clock className="h-7 w-7 animate-pulse" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Security Status</p>
                        <p className="text-xl font-black uppercase tracking-tight text-primary">Awaiting Gatekeeper</p>
                    </div>
                </div>

                <div className="space-y-6 pt-6">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                        Contact successpartner10@gmail.com for instant access.
                    </p>
                    <div className="flex flex-col gap-4">
                        <Button
                            variant="default"
                            onClick={() => signOut()}
                            className="h-14 w-full rounded-2xl font-black gap-2 shadow-xl shadow-primary/20 uppercase tracking-widest"
                        >
                            <LogOut className="h-5 w-5" /> LOGIN WITH DIFFERENT ACCOUNT
                        </Button>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">
                            Logged in as {user?.email}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PendingApproval;
