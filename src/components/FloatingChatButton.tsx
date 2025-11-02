import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ChatKitModal } from "@/components/ChatKitModal";

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    const loadSubscriptionTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setIsEmailVerified(!!user.email_confirmed_at);

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
    if (!isEmailVerified) {
      // Do nothing - tooltip will explain
      return;
    }
    if (!isPremium) {
      setShowUpgradeDialog(true);
    } else {
      setIsChatOpen(true);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(false);
    navigate("/pricing", { state: { selectedPlan: "annual" } });
  };

  if (loading) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
              onClick={handleClick}
              variant={isPremium ? "default" : "outline"}
              disabled={!isEmailVerified}
              aria-label="AI ChatKit"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            {!isEmailVerified ? (
              <p>Please verify your email to unlock AI ChatKit</p>
            ) : isPremium ? (
              <p>AI ChatKit - Ask about your payslips</p>
            ) : (
              <p>AI ChatKit is available on paid plans. Click to upgrade!</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ChatKitModal open={isChatOpen} onOpenChange={setIsChatOpen} />

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              AI ChatKit is not available on the free plan. Upgrade to Annual to unlock this feature and start asking questions about your payslips.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade}>
              Upgrade to Annual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingChatButton;
