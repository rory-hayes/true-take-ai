import { ReactNode } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInset,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, LayoutDashboard, Upload, CreditCard, Settings, Users } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { Input } from "@/components/ui/input";

interface AppShellProps {
  children: ReactNode;
  userEmail?: string;
  isEmailVerified?: boolean;
}

export default function AppShell({ children, userEmail = "", isEmailVerified = true }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="px-3 py-2">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Tally</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/dashboard")}
                    onClick={() => navigate("/dashboard")}
                  >
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/dashboard")} // upload happens on dashboard
                    onClick={() => navigate("/dashboard")}
                  >
                    <Upload />
                    <span>Upload Payslip</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/pricing")}
                    onClick={() => navigate("/pricing")}
                  >
                    <CreditCard />
                    <span>Pricing</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/settings")}
                    onClick={() => navigate("/settings")}
                  >
                    <Settings />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/invite")}
                    onClick={() => navigate("/invite")}
                  >
                    <Users />
                    <span>Invite a Friend</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b">
          <div className="container mx-auto px-4 h-14 flex items-center gap-3">
            <SidebarTrigger />
            <div className="flex-1 max-w-xl">
              <Input placeholder="Search payslips..." className="h-9" />
            </div>
            <UserMenu userEmail={userEmail} isEmailVerified={isEmailVerified} />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}


