import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import Goals from "./pages/Goals";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={
            <AuthGuard requireAuth={false}>
              <Login />
            </AuthGuard>
          } />
          <Route path="/register" element={
            <AuthGuard requireAuth={false}>
              <Register />
            </AuthGuard>
          } />
          
          {/* Protected routes */}
          <Route path="/" element={<Index />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="/cameras" element={
            <AuthGuard>
              <Cameras />
            </AuthGuard>
          } />
          <Route path="/goals" element={
            <AuthGuard>
              <Goals />
            </AuthGuard>
          } />
          <Route path="/integrations" element={
            <AuthGuard>
              <Integrations />
            </AuthGuard>
          } />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
