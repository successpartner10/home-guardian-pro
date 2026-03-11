import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isApproved, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
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

  const isPendingPage = location.pathname === "/pending-approval";

  const isPrimaryAdmin = user?.email?.toLowerCase() === "successpartner10@gmail.com";
  const isActuallyApproved = isApproved || isPrimaryAdmin;

  if (!isActuallyApproved && !isPendingPage) {
    console.log("[ProtectedRoute] Not approved, redirecting...", { isApproved, isPrimaryAdmin });
    return <Navigate to="/pending-approval" replace />;
  }

  if (isActuallyApproved && isPendingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
