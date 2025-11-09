import { User, Settings, CreditCard, LogOut, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface UserMenuProps {
  userEmail: string;
  isEmailVerified?: boolean;
}

export const UserMenu = ({ userEmail, isEmailVerified = true }: UserMenuProps) => {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, full_name")
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
      return;
    }
    toast.success("Signed out successfully");
    navigate("/");
  };

  const getTierLabel = () => {
    const tier = profile?.subscription_tier || "free";
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getTierColor = () => {
    const tier = profile?.subscription_tier || "free";
    switch (tier) {
      case "monthly":
        return "bg-blue-500";
      case "annual":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return userEmail.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {profile?.full_name || "User"}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
              {!isEmailVerified && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                  Unverified
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>User Profile</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate("/pricing")}>
          <CreditCard className="mr-2 h-4 w-4" />
          <div className="flex items-center justify-between flex-1">
            <span>Tier</span>
            <Badge variant="secondary" className={getTierColor()}>
              {getTierLabel()}
            </Badge>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
