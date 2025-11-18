import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainNav } from "@/components/MainNav";
import FloatingChatButton from "@/components/FloatingChatButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Sparkles } from "lucide-react";
import { PensionInsightsCard } from "@/components/PensionInsightsCard";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/currencyUtils";

const Insights = () => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [userAge, setUserAge] = useState<number | null>(null);
  const [grossAnnualIncome, setGrossAnnualIncome] = useState<number>(0);
  const [currentPensionContrib, setCurrentPensionContrib] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?mode=login");
        return;
      }

      const user = session.user;
      setUserEmail(user.email || "");
      setIsEmailVerified(!!user.email_confirmed_at);

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, uploads_remaining, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.subscription_tier) {
        setSubscriptionTier(profile.subscription_tier);
      }
      if (profile?.date_of_birth) {
        const birthDate = new Date(profile.date_of_birth);
        const today = new Date();
        const age =
          today.getFullYear() -
          birthDate.getFullYear() -
          (today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
            ? 1
            : 0);
        setUserAge(age);
      }

      // Load latest confirmed payslip for income and pension
      const { data: payslips } = await supabase
        .from("payslip_data")
        .select("gross_pay, pension")
        .eq("user_id", user.id)
        .eq("confirmed", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (payslips && payslips.length > 0) {
        const latest = payslips[0];
        if (latest.gross_pay) {
          setGrossAnnualIncome(latest.gross_pay * 12);
        }
        const latestPension = latest.pension || 0;
        setCurrentPensionContrib(latestPension * 12);
      }

      setIsLoading(false);
    };

    load();
  }, [navigate]);

  if (isLoading) {
    return null;
  }

  const isPremium = subscriptionTier === "monthly" || subscriptionTier === "annual";

  return (
    <div className="min-h-screen bg-background">
      <MainNav userEmail={userEmail} isEmailVerified={isEmailVerified} />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Tax & Pension Insights</h1>
          <p className="text-muted-foreground">
            Personalized recommendations based on your payslip data.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <PensionInsightsCard
            age={userAge}
            grossAnnualIncome={grossAnnualIncome}
            currentPensionContribAnnual={currentPensionContrib}
            onClick={() => {}}
          />

          <Card>
            <CardHeader>
              <CardTitle>Tax Efficiency Score</CardTitle>
              <CardDescription>How well you're optimizing your tax situation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-emerald-600">75%</span>
                <span className="text-sm text-muted-foreground">Good tax efficiency</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Pension optimization</p>
                  <p className="font-medium">Good</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Tax credits used</p>
                  <p className="font-medium">Optimal</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Deductions claimed</p>
                  <p className="font-medium">Average</p>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upload more payslips to improve the accuracy of your tax efficiency score.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className={!isPremium ? "opacity-70" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Premium Feature
                  </Badge>
                </div>
                <CardTitle>AI Chat Assistant</CardTitle>
                <CardDescription>
                  Ask questions about your payslips and get tax guidance powered by ChatKit.
                </CardDescription>
              </div>
              {!isPremium && <Lock className="h-5 w-5 text-muted-foreground" />}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Explain payslip lines in plain language</li>
                <li>Understand changes in net pay over time</li>
                <li>Get suggestions on pension and tax optimization</li>
              </ul>
              {!isPremium && (
                <Button className="w-full" onClick={() => navigate("/subscription")}>
                  Upgrade to Premium
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={!isPremium ? "opacity-70" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Premium Feature
                  </Badge>
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Unlock deeper analytics and projections on your income and deductions.
                </CardDescription>
              </div>
              {!isPremium && <Lock className="h-5 w-5 text-muted-foreground" />}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Year-to-date income breakdown</li>
                <li>Trend analysis across multiple employers</li>
                <li>Scenario modelling for pension changes</li>
              </ul>
              {!isPremium && (
                <Button className="w-full" onClick={() => navigate("/subscription")}>
                  Upgrade to Premium
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>End of Year Tax Helper</CardTitle>
            </div>
            <CardDescription>
              Optional add-on: AI-generated tax summary package based on your payslips.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Get a tailored breakdown of your tax position for the year.</p>
              <p>Includes deduction opportunities and a filing checklist.</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                From {formatCurrency(10, currency)} <span className="text-sm text-muted-foreground">one-time</span>
              </p>
              <Button
                className="mt-2"
                variant="outline"
                onClick={() => navigate("/subscription#tax-helper")}
              >
                View Tax Helper
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <FloatingChatButton />
    </div>
  );
};

export default Insights;


