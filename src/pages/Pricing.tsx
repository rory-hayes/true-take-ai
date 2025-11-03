import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, ArrowLeft, Sparkles } from "lucide-react";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

const STRIPE_PRICES = {
  monthly: "price_1SP31vFI6AfZKCoZgbwMQ8tX",
  annual: "price_1SP32NFI6AfZKCoZWEI4zt37",
  tax_package: "price_1SP32zFI6AfZKCoZECDuUrvH",
};

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const annualCardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>("free");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");
      setIsEmailVerified(!!user.email_confirmed_at);

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCurrentTier(profile.subscription_tier);
      }
    };

    loadProfile();
  }, [navigate]);

  useEffect(() => {
    if (location.state?.selectedPlan === "annual" && annualCardRef.current) {
      setTimeout(() => {
        annualCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [location.state]);

  const handleSubscribe = async (priceId: string, planType: string) => {
    if (!isEmailVerified) {
      toast.error("Please verify your email address to subscribe. Check your inbox for the verification link.");
      return;
    }
    
    setLoading(planType);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, planType },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating checkout session");
    } finally {
      setLoading(null);
    }
  };

  const handlePurchaseTaxPackage = async () => {
    if (!isEmailVerified) {
      toast.error("Please verify your email address to make purchases. Check your inbox for the verification link.");
      return;
    }
    
    setLoading("tax_package");
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { priceId: STRIPE_PRICES.tax_package },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating payment session");
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Error opening customer portal");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: "Free",
      tier: "free",
      price: "€0",
      period: "forever",
      description: "Perfect for trying out the service",
      features: [
        "3 payslip uploads",
        "Basic AI insights",
        "Month-to-month analysis",
        "Email support",
      ],
      cta: currentTier === "free" ? "Current Plan" : "Downgrade",
      disabled: currentTier === "free",
    },
    {
      name: "Monthly",
      tier: "monthly",
      price: "€5",
      period: "/month",
      description: "Great for regular users",
      features: [
        "Unlimited payslip uploads",
        "Advanced AI insights",
        "AI ChatKit functionality",
        "Chat with your payslips",
        "Priority support",
      ],
      cta: currentTier === "monthly" ? "Current Plan" : "Subscribe",
      disabled: currentTier === "monthly",
      priceId: STRIPE_PRICES.monthly,
    },
    {
      name: "Annual",
      tier: "annual",
      price: "€54",
      period: "/year",
      description: "Best value - Save 10%",
      badge: "Save €6",
      features: [
        "Everything in Monthly",
        "10% discount",
        "Annual billing",
        "Priority support",
        "Early access to new features",
      ],
      cta: currentTier === "annual" ? "Current Plan" : "Subscribe",
      disabled: currentTier === "annual",
      priceId: STRIPE_PRICES.annual,
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {!isEmailVerified && <EmailVerificationBanner userEmail={userEmail} />}

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">
            Select the perfect plan for your needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.tier}
              ref={plan.tier === "annual" ? annualCardRef : undefined}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              {plan.badge && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary">{plan.badge}</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={plan.disabled || loading !== null || (!isEmailVerified && plan.tier !== "free")}
                  onClick={() => {
                    if (plan.priceId) {
                      handleSubscribe(plan.priceId, plan.tier);
                    }
                  }}
                  variant={plan.popular ? "default" : "outline"}
                  title={!isEmailVerified && plan.tier !== "free" ? "Email verification required" : undefined}
                >
                  {loading === plan.tier 
                    ? "Processing..." 
                    : (!isEmailVerified && plan.tier !== "free")
                      ? "Verify Email to Subscribe"
                      : plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {(currentTier === "monthly" || currentTier === "annual") && (
          <div className="flex justify-center mb-12">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={loading !== null}
            >
              {loading === "portal" ? "Loading..." : "Manage Subscription"}
            </Button>
          </div>
        )}

        <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">End of Year Tax Package</CardTitle>
            </div>
            <CardDescription>
              AI-generated tax return package based on your payslips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="text-4xl font-bold">€10</span>
              <span className="text-muted-foreground"> one-time</span>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>AI-analyzed tax return breakdown</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Personalized tax saving recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Deduction opportunities identification</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Step-by-step filing guide</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handlePurchaseTaxPackage}
              disabled={loading !== null || !isEmailVerified}
              title={!isEmailVerified ? "Email verification required" : undefined}
            >
              {loading === "tax_package" 
                ? "Processing..." 
                : !isEmailVerified 
                  ? "Verify Email to Purchase"
                  : "Purchase Tax Package"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
