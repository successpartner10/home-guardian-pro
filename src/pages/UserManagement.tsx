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

interface UserProfile {
    id: string;
    user_id: string;
    display_name: string | null;
    email?: string;
    is_approved?: boolean;
    created_at: string;
}

const UserManagement = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("profiles")
                .select("id, user_id, display_name, created_at, is_approved")
                .order("created_at", { ascending: false });

            if (error) {
                toast({ title: "Error", description: "Could not fetch users", variant: "destructive" });
            } else if (data) {
                setUsers(data as UserProfile[]);
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "A system error occurred while fetching users.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleApproval = async (userId: string, currentStatus: boolean) => {
        // In a real Supabase setup, this would call an Edge Function or update a 'profiles' column
        // For now, we update the profile's 'is_approved' column (assuming it exists or we'll handle the error)
        const { error } = await supabase
            .from("profiles")
            .update({ is_approved: !currentStatus } as any)
            .eq("user_id", userId);

        if (error) {
            toast({
                title: "Database Update Required",
                description: "Please ensure the 'is_approved' column exists in your Supabase 'profiles' table.",
                variant: "destructive"
            });
        } else {
            setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_approved: !currentStatus } : u));
            toast({
                title: currentStatus ? "Access Revoked" : "User Approved",
                description: `Successfully updated access for the user.`
            });
        }
    };

    return (
        <AppLayout>
            <div className="p-4 space-y-6 max-w-4xl mx-auto pb-24">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gatekeeper</h1>
                    <p className="text-sm text-muted-foreground">Manage friend access and permissions</p>
                </div>

                <div className="grid gap-4">
                    {loading ? (
                        [1, 2, 3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted/20" />)
                    ) : users.length === 0 ? (
                        <p className="text-center py-12 text-muted-foreground">No users found.</p>
                    ) : (
                        <AnimatePresence>
                            {users.map((profile) => (
                                <motion.div
                                    key={profile.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                >
                                    <Card className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm">
                                        <CardContent className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {profile.display_name?.[0] || profile.email?.[0] || "?"}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate">{profile.display_name || "New User"}</p>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {profile.email || "Member"}</span>
                                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(profile.created_at), "MMM d, yyyy")}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {profile.is_approved ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleApproval(profile.user_id, true)}
                                                        className="text-green-500 hover:text-green-600 hover:bg-green-500/10 gap-2"
                                                    >
                                                        <UserCheck className="h-4 w-4" /> Approved
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleToggleApproval(profile.user_id, false)}
                                                        className="border-primary/20 hover:bg-primary/10 gap-2"
                                                    >
                                                        <UserX className="h-4 w-4" /> Pending
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 text-sm text-primary/80 italic">
                    <Shield className="h-5 w-5 shrink-0" />
                    <p>As the primary administrator, you have total control over the secure network. Changes take effect immediately.</p>
                </div>
            </div>
        </AppLayout>
    );
};

export default UserManagement;
