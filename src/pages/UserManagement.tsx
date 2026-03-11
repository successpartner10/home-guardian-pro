import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, UserX, Shield, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UserProfile {
    id: string;
    user_id: string;
    display_name: string | null;
    email?: string;
    is_approved?: boolean;
    created_at: string;
}

const UserManagement = () => {
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            // We fetch from profiles which is linked to auth.users
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
            } else if (data) {
                setUsers(data as UserProfile[]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleApproval = async (userId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ is_approved: !currentStatus } as any)
                .eq("user_id", userId);

            if (error) {
                toast({ title: "Update Failed", description: "Database error or permission denied.", variant: "destructive" });
            } else {
                setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_approved: !currentStatus } : u));
                toast({
                    title: !currentStatus ? "User Approved" : "Access Revoked",
                    description: `Permissions updated for the network node.`
                });
            }
        } catch (e) {
            toast({ title: "System Error", variant: "destructive" });
        }
    };

    if (!isAdmin) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[60vh] text-destructive font-black uppercase tracking-tighter text-4xl">
                    Restricted Access
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="p-6 space-y-10 max-w-4xl mx-auto pb-32 tracking-tighter">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-primary">
                        <Shield className="w-10 h-10" />
                        <h1 className="text-4xl font-black uppercase leading-none">Gatekeeper</h1>
                    </div>
                    <p className="text-lg text-muted-foreground font-medium">Manage secure network access and approve new nodes.</p>
                </div>

                <div className="grid gap-4">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-24 rounded-[2rem] bg-card/20 animate-pulse border-2 border-border/20" />)
                    ) : users.length === 0 ? (
                        <div className="text-center py-20 opacity-20 italic font-black uppercase text-2xl">No users detected in orbit.</div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {users.map((profile) => (
                                <motion.div
                                    key={profile.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <div className={cn(
                                        "relative overflow-hidden p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between gap-6",
                                        profile.is_approved ? "bg-primary/5 border-primary/20" : "bg-card/40 border-border/40 grayscale-[0.5]"
                                    )}>
                                        <div className="flex items-center gap-6">
                                            <div className={cn(
                                                "h-16 w-16 rounded-3xl flex items-center justify-center text-3xl font-black shadow-xl",
                                                profile.is_approved ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                            )}>
                                                {profile.display_name?.[0]?.toUpperCase() || "N"}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-2xl font-black uppercase tracking-tight leading-none">
                                                    {profile.display_name || "New Node"}
                                                </p>
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {profile.user_id.slice(0, 8)}...</span>
                                                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {format(new Date(profile.created_at), "MMM d, yyyy")}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant={profile.is_approved ? "default" : "outline"}
                                            size="lg"
                                            onClick={() => handleToggleApproval(profile.user_id, !!profile.is_approved)}
                                            className={cn(
                                                "h-16 px-8 rounded-3xl font-black transition-all active:scale-95",
                                                profile.is_approved
                                                    ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                                    : "border-2 border-primary/40 text-primary hover:bg-primary/10"
                                            )}
                                        >
                                            {profile.is_approved ? (
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-6 w-6" />
                                                    <span>APPROVED</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <UserX className="h-6 w-6" />
                                                    <span>PENDING</span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                <div className="p-6 rounded-[2rem] bg-primary/5 border-2 border-primary/10 flex gap-4 items-start text-primary/80">
                    <Shield className="h-8 w-8 shrink-0 mt-1" />
                    <div className="space-y-1">
                        <p className="text-lg font-black uppercase leading-none">Admin Authority</p>
                        <p className="text-sm font-bold opacity-70 uppercase tracking-tight">
                            As the architect, you define the network boundaries. Approvals are instant and grant full viewing/recording privileges.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default UserManagement;
