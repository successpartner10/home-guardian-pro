import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const ADMIN_EMAIL = "successpartner10@gmail.com";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
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

  const isApproved = user.email === ADMIN_EMAIL || user.user_metadata?.approved === true;
  const isPendingPage = location.pathname === "/pending-approval";

  if (!isApproved && !isPendingPage) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (isApproved && isPendingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
