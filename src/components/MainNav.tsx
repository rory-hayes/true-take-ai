import { FileText } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

interface MainNavProps {
  userEmail?: string;
  isEmailVerified?: boolean;
}

export function MainNav({ userEmail = "", isEmailVerified = true }: MainNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Upload", path: "/upload" },
    { label: "Insights", path: "/insights" },
    { label: "Subscription", path: "/subscription" },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <FileText className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">Tally</span>
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "default" : "ghost"}
                size="sm"
                className={`px-3 ${isActive(item.path) ? "" : "text-muted-foreground"}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu userEmail={userEmail} isEmailVerified={isEmailVerified} />
        </div>
      </div>
    </header>
  );
}


