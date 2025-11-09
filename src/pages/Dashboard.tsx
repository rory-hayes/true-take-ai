import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, TrendingUp, DollarSign, AlertCircle, Plus, Euro, Banknote, TrendingDown, Minus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FloatingChatButton from "@/components/FloatingChatButton";
import { formatCurrency, getCurrencySymbol } from "@/lib/currencyUtils";
import PayslipUpload from "@/components/PayslipUpload";
import PayslipChart from "@/components/PayslipChart";
import { UserMenu } from "@/components/UserMenu";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { PensionInsightsCard } from "@/components/PensionInsightsCard";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [payslipData, setPayslipData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUploads: 0,
    latestGrossPay: null as number | null,
    latestNetPay: null as number | null,
    ytdGrossPay: null as number | null,
    ytdNetPay: null as number | null,
    trend: null as string | null,
    trendDirection: null as 'up' | 'down' | 'neutral' | null,
    trendAmount: null as number | null,
  });
  const [selectedDialog, setSelectedDialog] = useState<'uploads' | 'latest' | 'trend' | 'pension' | 'upload' | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [uploadsRemaining, setUploadsRemaining] = useState<number>(3);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [grossAnnualIncome, setGrossAnnualIncome] = useState<number>(0);
  const [currentPensionContrib, setCurrentPensionContrib] = useState<number>(0);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth?mode=login");
      } else {
        setUser(session.user);
        setIsEmailVerified(!!session.user.email_confirmed_at);
        fetchPayslipData(session.user.id);
        
        // Check if returning from Stripe checkout
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('checkout') === 'success') {
          // Clear the query parameter
          window.history.replaceState({}, '', '/dashboard');
          // Check subscription status
          checkSubscriptionStatus();
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth?mode=login");
      } else {
        setUser(session.user);
        setIsEmailVerified(!!session.user.email_confirmed_at);
        fetchPayslipData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkSubscriptionStatus = async () => {
    try {
      console.log('Checking subscription status...');
      
      // Add a small delay to ensure Stripe has processed the subscription
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        toast({
          title: "Checking subscription...",
          description: "This may take a few moments. Refreshing your data...",
        });
        
        // Try refreshing data anyway
        if (user) {
          await fetchPayslipData(user.id);
        }
        return;
      }

      console.log('Subscription check result:', data);
      
      if (data.subscribed) {
        toast({
          title: "Subscription activated!",
          description: `Welcome to ${data.subscription_tier} tier! Your account has been upgraded.`,
        });
        
        // Refresh the page data to reflect new subscription
        if (user) {
          await fetchPayslipData(user.id);
        }
      } else {
        toast({
          title: "Processing payment...",
          description: "Your payment is being processed. Your subscription will be active shortly.",
        });
        
        // Retry after a few seconds
        setTimeout(async () => {
          const { data: retryData } = await supabase.functions.invoke('check-subscription');
          if (retryData?.subscribed && user) {
            await fetchPayslipData(user.id);
            toast({
              title: "Subscription activated!",
              description: "Your account has been upgraded successfully.",
            });
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Error in checkSubscriptionStatus:', error);
    }
  };

  const fetchPayslipData = async (userId: string) => {
    try {
      // Fetch user profile for subscription tier, uploads remaining, and date of birth
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, uploads_remaining, date_of_birth')
        .eq('id', userId)
        .single();

      if (profile?.subscription_tier) {
        setSubscriptionTier(profile.subscription_tier);
      }
      if (profile?.uploads_remaining !== undefined) {
        setUploadsRemaining(profile.uploads_remaining);
      }
      if (profile?.date_of_birth) {
        const birthDate = new Date(profile.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear() - 
          (today.getMonth() < birthDate.getMonth() || 
           (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
        setUserAge(age);
      }

      // Fetch confirmed payslip data with pay period information
      const { data, error } = await supabase
        .from('payslip_data')
        .select(`
          *,
          payslips!inner(pay_period_start, pay_period_end)
        `)
        .eq('user_id', userId)
        .eq('confirmed', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayslipData(data || []);

      // Calculate stats and pension data
      if (data && data.length > 0) {
        const latest = data[0];
        const totalUploads = data.length;
        const latestGrossPay = latest.gross_pay;
        const latestNetPay = latest.net_pay;

        // Calculate YTD totals (current year)
        const currentYear = new Date().getFullYear();
        const ytdPayslips = data.filter(payslip => {
          const payslipYear = new Date(payslip.created_at).getFullYear();
          return payslipYear === currentYear;
        });
        
        const ytdGrossPay = ytdPayslips.reduce((sum, p) => sum + (p.gross_pay || 0), 0);
        const ytdNetPay = ytdPayslips.reduce((sum, p) => sum + (p.net_pay || 0), 0);

        // Calculate trend (compare last two payslips)
        let trend = null;
        let trendDirection: 'up' | 'down' | 'neutral' | null = null;
        let trendAmount = null;
        if (data.length >= 2) {
          const current = data[0].gross_pay;
          const previous = data[1].gross_pay;
          const change = ((current - previous) / previous) * 100;
          const absoluteChange = current - previous;
          trend = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
          trendAmount = absoluteChange;
          trendDirection = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral';
        }

        setStats({ 
          totalUploads, 
          latestGrossPay, 
          latestNetPay,
          ytdGrossPay,
          ytdNetPay,
          trend,
          trendDirection,
          trendAmount
        });

        // Calculate annual income from latest gross pay (multiply by 12)
        if (latestGrossPay) {
          setGrossAnnualIncome(latestGrossPay * 12);
        }

        // Calculate annual pension contribution (multiply by 12)
        const latestPension = latest.pension || 0;
        setCurrentPensionContrib(latestPension * 12);
      }
    } catch (error) {
      console.error('Error fetching payslip data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load your payslip data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Tally
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setSelectedDialog('upload')}
              disabled={!isEmailVerified || (subscriptionTier === "free" && uploadsRemaining === 0)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Upload Payslip
            </Button>
            <UserMenu userEmail={user?.email || ""} isEmailVerified={isEmailVerified} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!isEmailVerified && <EmailVerificationBanner userEmail={user?.email || ""} />}
        
        {subscriptionTier === "free" && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">{uploadsRemaining} uploads remaining</span> on your free plan.
              {uploadsRemaining <= 1 && (
                <> {isEmailVerified ? (
                  <a href="/pricing" className="underline hover:text-primary">Upgrade now</a>
                ) : (
                  <span className="text-muted-foreground cursor-not-allowed" title="Email verification required">Upgrade now</span>
                )} for unlimited uploads and premium features.</>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
          <p className="text-muted-foreground">Track and analyse your payslip data</p>
        </div>

        {/* Stats Cards - Now 4 cards including Upload */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedDialog('uploads')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUploads}</div>
              {stats.ytdGrossPay !== null && stats.ytdGrossPay > 0 ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Year-to-Date Totals</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Gross:</span>
                    <span className="font-medium">{formatCurrency(stats.ytdGrossPay, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Net:</span>
                    <span className="font-medium text-green-600">{formatCurrency(stats.ytdNetPay || 0, currency)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalUploads === 0 ? "No payslips uploaded yet" : "Click to view all"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => stats.latestGrossPay && setSelectedDialog('latest')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Payslip</CardTitle>
              {currency === 'EUR' ? (
                <Euro className="h-4 w-4 text-muted-foreground" />
              ) : currency === 'GBP' ? (
                <span className="text-muted-foreground font-bold">£</span>
              ) : currency === 'USD' ? (
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Banknote className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.latestGrossPay ? formatCurrency(stats.latestGrossPay, currency) : "-"}
              </div>
              {stats.latestGrossPay && stats.latestNetPay ? (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Gross Pay</span>
                    <span className="font-medium">{formatCurrency(stats.latestGrossPay, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Net Pay</span>
                    <span className="font-medium text-green-600">{formatCurrency(stats.latestNetPay, currency)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click for full breakdown</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Upload your first payslip
                </p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => stats.trend && setSelectedDialog('trend')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trend</CardTitle>
              {stats.trendDirection === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : stats.trendDirection === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : stats.trendDirection === 'neutral' ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                stats.trendDirection === 'up' ? 'text-green-600' : 
                stats.trendDirection === 'down' ? 'text-red-600' : 
                ''
              }`}>
                {stats.trend || "-"}
              </div>
              {stats.trend && stats.trendAmount !== null ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {stats.trendDirection === 'up' ? 'Increase' : stats.trendDirection === 'down' ? 'Decrease' : 'Change'} of {formatCurrency(Math.abs(stats.trendAmount), currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    vs previous payslip
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Upload a second payslip to see trends
                </p>
              )}
            </CardContent>
          </Card>

          <PensionInsightsCard
            age={userAge}
            grossAnnualIncome={grossAnnualIncome}
            currentPensionContribAnnual={currentPensionContrib}
            onClick={() => setSelectedDialog('pension')}
          />
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payslips</CardTitle>
              <CardDescription>Your recently uploaded payslip documents</CardDescription>
            </CardHeader>
            <CardContent>
              {payslipData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payslips uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payslipData.slice(0, 3).map((payslip) => {
                    const payPeriodEnd = payslip.payslips?.pay_period_end;
                    const displayDate = payPeriodEnd 
                      ? new Date(payPeriodEnd).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : new Date(payslip.created_at).toLocaleDateString();
                    
                    return (
                      <div
                        key={payslip.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/payslip/${payslip.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">
                              {formatCurrency(payslip.gross_pay, currency)} Gross
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {displayDate}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatCurrency(payslip.net_pay, currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">Net Pay</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Income Trends</CardTitle>
              <CardDescription>
                View your income trends based on uploaded payslips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayslipChart data={payslipData} currency={currency} />
            </CardContent>
          </Card>
        </div>

        {/* Dialogs for drill-down */}
        <Dialog open={selectedDialog === 'uploads'} onOpenChange={() => setSelectedDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>All Payslips</DialogTitle>
              <DialogDescription>Complete history of your uploaded payslips</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {payslipData.map((payslip) => (
                <div
                  key={payslip.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setSelectedDialog(null);
                    navigate(`/payslip/${payslip.id}`);
                  }}
                >
                  <div>
                    <p className="font-semibold">{formatCurrency(payslip.gross_pay, currency)} Gross</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payslip.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(payslip.net_pay, currency)}</p>
                    <p className="text-sm text-muted-foreground">Net Pay</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={selectedDialog === 'latest'} onOpenChange={() => setSelectedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Latest Payslip Breakdown</DialogTitle>
              <DialogDescription>Detailed view of your most recent payslip</DialogDescription>
            </DialogHeader>
            {payslipData[0] && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                  <span className="font-medium">Gross Pay</span>
                  <span className="text-xl font-bold">{formatCurrency(payslipData[0].gross_pay, currency)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax Deducted</span>
                    <span className="text-red-600">-{formatCurrency(payslipData[0].tax_deducted, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pension</span>
                    <span className="text-red-600">-{formatCurrency(payslipData[0].pension, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PRSI</span>
                    <span className="text-red-600">-{formatCurrency(payslipData[0].social_security, currency)}</span>
                  </div>
                  {payslipData[0].other_deductions > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Other Deductions</span>
                      <span className="text-red-600">-{formatCurrency(payslipData[0].other_deductions, currency)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border-2 border-green-500/20">
                  <span className="font-semibold">Net Pay</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(payslipData[0].net_pay, currency)}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={selectedDialog === 'trend'} onOpenChange={() => setSelectedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payslip Comparison</DialogTitle>
              <DialogDescription>Compare your last two payslips</DialogDescription>
            </DialogHeader>
            {payslipData.length >= 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Latest</p>
                    <div className="space-y-2">
                      <div className="text-center p-3 bg-accent/50 rounded-lg">
                        <p className="text-2xl font-bold">{formatCurrency(payslipData[0].gross_pay, currency)}</p>
                        <p className="text-xs text-muted-foreground">Gross Pay</p>
                      </div>
                      <div className="text-center p-2 rounded-lg">
                        <p className="text-lg font-semibold text-green-600">{formatCurrency(payslipData[0].net_pay, currency)}</p>
                        <p className="text-xs text-muted-foreground">Net Pay</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Previous</p>
                    <div className="space-y-2">
                      <div className="text-center p-3 bg-accent/30 rounded-lg">
                        <p className="text-2xl font-bold">{formatCurrency(payslipData[1].gross_pay, currency)}</p>
                        <p className="text-xs text-muted-foreground">Gross Pay</p>
                      </div>
                      <div className="text-center p-2 rounded-lg">
                        <p className="text-lg font-semibold">{formatCurrency(payslipData[1].net_pay, currency)}</p>
                        <p className="text-xs text-muted-foreground">Net Pay</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-3xl font-bold text-primary">{stats.trend}</p>
                  <p className="text-sm text-muted-foreground mt-1">Change in gross pay</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={selectedDialog === 'pension'} onOpenChange={() => setSelectedDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Pension Contribution Breakdown</DialogTitle>
              <DialogDescription>
                Detailed analysis of your pension contributions and tax efficiency
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Your Age</p>
                  <p className="text-2xl font-bold">{userAge || "Not set"}</p>
                  {!userAge && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your date of birth in settings
                    </p>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Gross Annual Income</p>
                  <p className="text-2xl font-bold">{formatCurrency(grossAnnualIncome, currency)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on latest payslip
                  </p>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Current Monthly Contribution</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(currentPensionContrib / 12, currency)}
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Recommended Monthly Contribution</p>
                <p className="text-3xl font-bold">
                  {formatCurrency((Math.min(grossAnnualIncome, 115000) * (userAge ? (
                    userAge < 30 ? 0.15 :
                    userAge < 40 ? 0.20 :
                    userAge < 50 ? 0.25 :
                    userAge < 55 ? 0.30 :
                    userAge < 60 ? 0.35 : 0.40
                  ) : 0.20)) / 12, currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This is the maximum tax-efficient contribution based on Irish Revenue rules
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Revenue Age-Based Limits</h4>
                <div className="text-sm space-y-1">
                  <p className="flex justify-between"><span>Under 30:</span> <span className="font-medium">15% of income</span></p>
                  <p className="flex justify-between"><span>30-39:</span> <span className="font-medium">20% of income</span></p>
                  <p className="flex justify-between"><span>40-49:</span> <span className="font-medium">25% of income</span></p>
                  <p className="flex justify-between"><span>50-54:</span> <span className="font-medium">30% of income</span></p>
                  <p className="flex justify-between"><span>55-59:</span> <span className="font-medium">35% of income</span></p>
                  <p className="flex justify-between"><span>60+:</span> <span className="font-medium">40% of income</span></p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  * Maximum qualifying income for tax relief: €115,000
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={selectedDialog === 'upload'} onOpenChange={() => setSelectedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Payslip</DialogTitle>
              <DialogDescription>
                Upload a new payslip to track your income
              </DialogDescription>
            </DialogHeader>
            <PayslipUpload 
              isEmailVerified={isEmailVerified} 
              subscriptionTier={subscriptionTier} 
              uploadsRemaining={uploadsRemaining} 
            />
          </DialogContent>
        </Dialog>
      </main>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Dashboard;
