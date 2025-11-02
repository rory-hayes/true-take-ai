import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationBannerProps {
  userEmail: string;
}

export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const handleResendVerification = async () => {
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) throw error;

      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email");
    } finally {
      setIsSending(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Alert className="mb-6 border-yellow-500 bg-yellow-500/10">
      <Mail className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="flex items-center justify-between">
        <span>Email Verification Required</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          Please verify your email address to unlock all features including inviting friends and managing subscriptions.
        </p>
        <Button
          onClick={handleResendVerification}
          disabled={isSending}
          size="sm"
          variant="outline"
        >
          {isSending ? "Sending..." : "Resend Verification Email"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
