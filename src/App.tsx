import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import CameraMode from "./pages/CameraMode";
import LiveFeed from "./pages/LiveFeed";
import PublicView from "./pages/PublicView";
import TVPage from "./pages/TVPage";
import MultiLiveFeed from "./pages/MultiLiveFeed";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/SettingsPage";
import PendingApproval from "./pages/PendingApproval";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import InstallPrompt from "./components/InstallPrompt";

import { useGlobalAlerts } from "@/hooks/useGlobalAlerts";

const GlobalHooks = () => {
  useGlobalAlerts();
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalHooks />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/camera" element={<ProtectedRoute><CameraMode /></ProtectedRoute>} />
              <Route path="/camera/:deviceId" element={<ProtectedRoute><CameraMode /></ProtectedRoute>} />
              <Route path="/live/all" element={<ProtectedRoute><MultiLiveFeed /></ProtectedRoute>} />
              <Route path="/live/:deviceId" element={<ProtectedRoute><LiveFeed /></ProtectedRoute>} />
              <Route path="/shared/:token" element={<PublicView />} />
              <Route path="/tv" element={<TVPage />} />
              <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/pending-approval" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallPrompt />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
