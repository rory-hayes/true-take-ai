import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainNav } from "@/components/MainNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import PayslipUpload from "@/components/PayslipUpload";
import FloatingChatButton from "@/components/FloatingChatButton";

const Upload = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [uploadsRemaining, setUploadsRemaining] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?mode=login");
        return;
      }

      setUserEmail(session.user.email || "");
      setIsEmailVerified(!!session.user.email_confirmed_at);

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, uploads_remaining")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.subscription_tier) {
        setSubscriptionTier(profile.subscription_tier);
      }
      if (profile?.uploads_remaining !== undefined) {
        setUploadsRemaining(profile.uploads_remaining);
      }

      setIsLoading(false);
    };

    load();
  }, [navigate]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav userEmail={userEmail} isEmailVerified={isEmailVerified} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {subscriptionTier === "free" && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">{uploadsRemaining} uploads remaining</span> on your free plan.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload Payslip</h1>
          <p className="text-muted-foreground">
            Upload your PDF or image payslip and let Tally extract the key information.
          </p>
        </div>

        <PayslipUpload
          isEmailVerified={isEmailVerified}
          subscriptionTier={subscriptionTier}
          uploadsRemaining={uploadsRemaining}
        />
      </main>
      <FloatingChatButton />
    </div>
  );
};

export default Upload;


