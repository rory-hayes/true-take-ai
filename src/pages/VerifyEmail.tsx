import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setEmail(user.email || "");
      
      // Check if already verified
      if (user.email_confirmed_at) {
        setIsVerified(true);
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    };

    checkUser();

    // Listen for verification events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        setIsVerified(true);
        toast.success("Email verified successfully!");
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResendEmail = async () => {
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email");
    } finally {
      setIsSending(false);
    }
  };

  if (isVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification email to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Please check your inbox and click the verification link to activate your account.
            You won't be able to access premium features until your email is verified.
          </p>
          
          <div className="space-y-2">
            <Button
              onClick={handleResendEmail}
              disabled={isSending}
              variant="outline"
              className="w-full"
              aria-label="Resend verification email"
            >
              {isSending ? "Sending..." : "Resend Verification Email"}
            </Button>
            
            <Button
              onClick={() => navigate("/dashboard")}
              variant="ghost"
              className="w-full"
              aria-label="Go to dashboard"
            >
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Didn't receive the email? Check your spam folder or click resend above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
