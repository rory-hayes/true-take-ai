import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscriptionTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
        }
      } catch (error) {
        console.error("Error loading subscription tier:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscriptionTier();
  }, []);

  const isPremium = subscriptionTier === "monthly" || subscriptionTier === "annual";

  const handleClick = () => {
    if (!isPremium) {
      navigate("/pricing");
    } else {
      // Placeholder for future ChatKit integration
      console.log("Chat button clicked - ChatKit to be integrated");
    }
  };

  if (loading) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
            onClick={handleClick}
            variant={isPremium ? "default" : "outline"}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {isPremium ? (
            <p>AI ChatKit - Coming Soon</p>
          ) : (
            <p>AI ChatKit is available on paid plans. Click to upgrade!</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FloatingChatButton;
