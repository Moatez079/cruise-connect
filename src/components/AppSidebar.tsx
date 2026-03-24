import { Anchor, Ship, Users, QrCode, Settings, LogOut, LayoutDashboard, MessageSquare, Receipt, Star } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
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
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const { isOwner, isBoatAdmin, profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const ownerItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Boats', url: '/boats', icon: Ship },
    { title: 'Requests', url: '/requests', icon: MessageSquare },
    { title: 'Invoices', url: '/invoices', icon: Receipt },
    { title: 'Feedback', url: '/feedback', icon: Star },
    { title: 'Rooms', url: '/rooms', icon: QrCode },
    { title: 'Users', url: '/users', icon: Users },
    { title: 'Settings', url: '/settings', icon: Settings },
  ];

  const adminItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Requests', url: '/requests', icon: MessageSquare },
    { title: 'Invoices', url: '/invoices', icon: Receipt },
    { title: 'Feedback', url: '/feedback', icon: Star },
    { title: 'Rooms', url: '/rooms', icon: QrCode },
  ];

  const items = isOwner ? ownerItems : adminItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Anchor className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-serif text-sm font-semibold text-foreground">Floating Hotel</h2>
              <p className="text-xs text-muted-foreground">Management</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        {!collapsed && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-foreground truncate">
              {profile?.display_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOwner ? 'Owner' : isBoatAdmin ? 'Boat Admin' : 'Receptionist'}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
