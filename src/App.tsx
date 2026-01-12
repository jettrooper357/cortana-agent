import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import Goals from "./pages/Goals";
import Tasks from "./pages/Tasks";
import Rules from "./pages/Rules";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <main className="flex-1 flex flex-col">
              <header className="h-12 flex items-center border-b border-border/50 px-4 bg-background/95 backdrop-blur">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              </header>
              <div className="flex-1">
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
                  <Route path="/tasks" element={
                    <AuthGuard>
                      <Tasks />
                    </AuthGuard>
                  } />
                  <Route path="/rules" element={
                    <AuthGuard>
                      <Rules />
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
              </div>
            </main>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
