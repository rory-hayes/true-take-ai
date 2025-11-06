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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function InviteFriend() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState(true);
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [invitesSent, setInvitesSent] = useState(0);
  const [maxInvites, setMaxInvites] = useState(3);
  const [dailyInvitesSent, setDailyInvitesSent] = useState(0);
  const [maxDailyInvites] = useState(5);
  const [resetTime, setResetTime] = useState<string>("");

  useEffect(() => {
    const loadReferrals = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || "");
        setIsEmailVerified(!!user.email_confirmed_at);

        // Get invite quota
        const { data: profile } = await supabase
          .from("profiles")
          .select("invites_sent, max_invites, invites_sent_today, last_invite_date")
          .eq("id", user.id)
          .single();

        if (profile) {
          setInvitesSent(profile.invites_sent || 0);
          setMaxInvites(profile.max_invites || 3);
          
          // Check if daily invites are from today
          const today = new Date().toISOString().split('T')[0];
          const isToday = profile.last_invite_date === today;
          setDailyInvitesSent(isToday ? (profile.invites_sent_today || 0) : 0);
          
          // Set reset time to midnight tonight
          const tomorrow = new Date();
          tomorrow.setHours(24, 0, 0, 0);
          setResetTime(tomorrow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }

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
      } catch (error) {
        console.error("Error loading referrals:", error);
      } finally {
        setLoadingCode(false);
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
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: {
          referredEmail: email,
          referralCode: referralCode,
        },
      });

      if (error) {
        if (error.message?.includes("Lifetime invite limit reached")) {
          toast.error(error.message);
        } else if (error.message?.includes("Daily invite limit reached")) {
          toast.error(error.message);
        } else if (error.message?.includes("Email verification required")) {
          toast.error(error.message);
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      toast.success(
        `Invitation sent! ${data.invites_remaining} lifetime invites remaining, ${data.daily_invites_remaining} today.`
      );
      setEmail("");
      setInvitesSent(invitesSent + 1);
      setDailyInvitesSent(dailyInvitesSent + 1);

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
    const statusConfig = {
      pending: { label: "Sent", className: "bg-blue-500" },
      completed: { label: "Signed Up", className: "bg-purple-500" },
      rewarded: { label: "Rewarded", className: "bg-green-500" },
      expired: { label: "Expired", className: "bg-gray-500" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      className: "bg-gray-500" 
    };
    
    return (
      <Badge className={config.className}>
        {config.label}
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
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
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
            <div className="text-sm text-muted-foreground mt-2 space-y-1">
              <p>
                <strong>Lifetime:</strong> {maxInvites - invitesSent} of {maxInvites} invites remaining
              </p>
              <p>
                <strong>Today:</strong> {maxDailyInvites - dailyInvitesSent} of {maxDailyInvites} invites remaining
                {dailyInvitesSent >= maxDailyInvites && resetTime && (
                  <span className="text-orange-600 font-semibold ml-1">
                    (resets at {resetTime})
                  </span>
                )}
              </p>
            </div>
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
              {loadingCode ? (
                <>
                  <div>
                    <Label>Referral Code</Label>
                    <Skeleton className="h-10 w-full mt-1" />
                  </div>
                  <div>
                    <Label>Referral Link</Label>
                    <Skeleton className="h-10 w-full mt-1" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="referral-code-input">Referral Code</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        id="referral-code-input"
                        value={referralCode} 
                        readOnly 
                        className="font-mono"
                        aria-label="Your referral code" 
                      />
                      <Button 
                        onClick={copyReferralCode} 
                        variant="outline"
                        aria-label="Copy referral code to clipboard"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="referral-link-input">Referral Link</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="referral-link-input"
                        value={`${window.location.origin}/auth?ref=${referralCode}`}
                        readOnly
                        className="text-sm"
                        aria-label="Your referral link"
                      />
                      <Button 
                        onClick={copyReferralLink} 
                        variant="outline"
                        aria-label="Copy referral link to clipboard"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
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
                    aria-label="Enter friend's email address"
                    aria-describedby="email-hint"
                  />
                  <p id="email-hint" className="sr-only">Enter the email address of the friend you want to invite</p>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block w-full">
                        <Button 
                          type="submit" 
                          disabled={loading || loadingCode || !isEmailVerified || invitesSent >= maxInvites || dailyInvitesSent >= maxDailyInvites}
                          aria-label={loading ? "Sending invitation" : "Send invitation email"}
                          aria-busy={loading}
                          className="w-full"
                        >
                          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                          {loading ? "Sending..." : invitesSent >= maxInvites ? "Lifetime Limit Reached" : dailyInvitesSent >= maxDailyInvites ? "Daily Limit Reached" : "Send Invitation"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(loadingCode || !isEmailVerified || invitesSent >= maxInvites || dailyInvitesSent >= maxDailyInvites) && (
                      <TooltipContent>
                        <p>
                          {loadingCode 
                            ? "Loading referral code..." 
                            : !isEmailVerified 
                              ? "Please verify your email before sending invites" 
                              : invitesSent >= maxInvites
                                ? `You have reached your lifetime invite limit (${maxInvites} invites)`
                                : dailyInvitesSent >= maxDailyInvites
                                  ? `Daily limit reached (${maxDailyInvites} per day). Resets at ${resetTime}`
                                  : ""}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{referral.referred_email}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          <p>
                            Sent: {new Date(referral.created_at).toLocaleDateString()} at{" "}
                            {new Date(referral.created_at).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                          {referral.completed_at && (
                            <p>
                              Completed: {new Date(referral.completed_at).toLocaleDateString()}
                            </p>
                          )}
                          {referral.reward_expires_at && (
                            <p className="text-orange-600">
                              Reward expires: {new Date(referral.reward_expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(referral.status)}
                        {referral.reward_applied && (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            Reward Applied
                          </Badge>
                        )}
                      </div>
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
