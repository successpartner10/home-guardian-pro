import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isApproved, isAdmin } = useAuth();
  const location = useLocation();
  const [deviceCheck, setDeviceCheck] = useState<"loading" | "has_devices" | "no_devices">("loading");

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const snap = await getDocs(query(collection(db, "devices"), where("user_id", "==", user.uid)));
        setDeviceCheck(snap.empty ? "no_devices" : "has_devices");
      } catch {
        setDeviceCheck("has_devices"); // fail-open
      }
    };
    check();
  }, [user]);

  if (loading || (user && deviceCheck === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isPendingPage = location.pathname === "/pending";

  // Re-enable Admin Approval gate
  if (!isApproved && !isAdmin && !isPendingPage) {
    return <Navigate to="/pending" replace />;
  }

  if (isApproved && isPendingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

