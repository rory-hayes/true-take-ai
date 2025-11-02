import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, Gift } from "lucide-react";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export default function InviteFriend() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);

  useEffect(() => {
    const loadReferrals = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");
      setIsEmailVerified(!!user.email_confirmed_at);

      // Get or create referral code
      const { data: existingReferrals } = await supabase
        .from("referrals")
        .select("referral_code")
        .eq("referrer_id", user.id)
        .limit(1);

      if (existingReferrals && existingReferrals.length > 0) {
        setReferralCode(existingReferrals[0].referral_code);
      } else {
        // Generate new referral code
        const { data: newCode } = await supabase.rpc("generate_referral_code");
        if (newCode) {
          setReferralCode(newCode);
        }
      }

      // Load referral history
      const { data: referralHistory } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (referralHistory) {
        setReferrals(referralHistory);
      }
    };

    loadReferrals();
  }, [navigate]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEmailVerified) {
      toast.error("Please verify your email before inviting friends");
      return;
    }
    
    setLoading(true);

    try {
      // Create referral record
      const { error } = await supabase
        .from("referrals")
        .insert({
          referrer_id: userId,
          referred_email: email,
          referral_code: referralCode,
        });

      if (error) throw error;

      toast.success(`Invitation sent to ${email}`);
      setEmail("");

      // Reload referrals
      const { data: referralHistory } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      if (referralHistory) {
        setReferrals(referralHistory);
      }
    } catch (error: any) {
      toast.error(error.message || "Error sending invitation");
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied to clipboard");
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied to clipboard");
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-500",
      completed: "bg-blue-500",
      rewarded: "bg-green-500",
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-500"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {!isEmailVerified && <EmailVerificationBanner userEmail={userEmail} />}

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Invite a Friend</h1>
            <p className="text-muted-foreground mt-2">
              Share the love and get rewarded! Both you and your friend get 1 month free
              when they subscribe.
            </p>
          </div>

          <Card className="border-primary bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="h-6 w-6 text-primary" />
                <CardTitle>Your Referral Code</CardTitle>
              </div>
              <CardDescription>
                Share this code or link with your friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Referral Code</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={referralCode} readOnly className="font-mono" />
                  <Button onClick={copyReferralCode} variant="outline">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Referral Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={`${window.location.origin}/auth?ref=${referralCode}`}
                    readOnly
                    className="text-sm"
                  />
                  <Button onClick={copyReferralLink} variant="outline">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Invitation</CardTitle>
              <CardDescription>
                Invite a friend via email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <Label htmlFor="email">Friend's Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="friend@example.com"
                    required
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  <Mail className="mr-2 h-4 w-4" />
                  {loading ? "Sending..." : "Send Invitation"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referral History</CardTitle>
              <CardDescription>
                Track your referrals and rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No referrals yet. Start inviting friends!
                </p>
              ) : (
                <div className="space-y-4">
                  {referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{referral.referred_email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited on {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(referral.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
