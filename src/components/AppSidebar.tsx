import { Home, Settings, LayoutDashboard, Camera, Target, Zap, LogIn, UserPlus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, requiresAuth: true },
  { title: "Cameras", url: "/cameras", icon: Camera, requiresAuth: true },
  { title: "Goals", url: "/goals", icon: Target, requiresAuth: true },
  { title: "Integrations", url: "/integrations", icon: Zap, requiresAuth: true },
  { title: "Settings", url: "/settings", icon: Settings },
];

const authItems = [
  { title: "Login", url: "/login", icon: LogIn },
  { title: "Register", url: "/register", icon: UserPlus },
];

export function AppSidebar() {
  const { user, signOut, isLoading } = useAuth();

  const visibleItems = mainItems.filter(item => !item.requiresAuth || user);

  return (
    <Sidebar className="border-r border-border/50 bg-background/95 backdrop-blur">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-cyan-400 font-semibold">
            Cortana Home
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      activeClassName="bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-400"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!user && !isLoading && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">
              Account
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {authItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        activeClassName="bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-400"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter className="p-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {user.email}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => signOut()}
            className="w-full"
          >
            Sign Out
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
