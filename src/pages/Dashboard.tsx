import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FloatingChatButton from "@/components/FloatingChatButton";
import { formatCurrency } from "@/lib/currencyUtils";
import PayslipUpload from "@/components/PayslipUpload";
import PayslipChart from "@/components/PayslipChart";
import { UserMenu } from "@/components/UserMenu";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useCurrency } from "@/contexts/CurrencyContext";

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
    trend: null as string | null,
  });
  const [selectedDialog, setSelectedDialog] = useState<'uploads' | 'latest' | 'trend' | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [uploadsRemaining, setUploadsRemaining] = useState<number>(3);

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
      // Fetch user profile for subscription tier and uploads remaining
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, uploads_remaining')
        .eq('id', userId)
        .single();

      if (profile?.subscription_tier) {
        setSubscriptionTier(profile.subscription_tier);
      }
      if (profile?.uploads_remaining !== undefined) {
        setUploadsRemaining(profile.uploads_remaining);
      }

      // Fetch confirmed payslip data
      const { data, error } = await supabase
        .from('payslip_data')
        .select('*')
        .eq('user_id', userId)
        .eq('confirmed', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayslipData(data || []);

      // Calculate stats
      if (data && data.length > 0) {
        const latest = data[0];
        const totalUploads = data.length;
        const latestGrossPay = latest.gross_pay;

        // Calculate trend (compare last two payslips)
        let trend = null;
        if (data.length >= 2) {
          const current = data[0].gross_pay;
          const previous = data[1].gross_pay;
          const change = ((current - previous) / previous) * 100;
          trend = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
        }

        setStats({ totalUploads, latestGrossPay, trend });
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
          <UserMenu userEmail={user?.email || ""} isEmailVerified={isEmailVerified} />
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
          <p className="text-muted-foreground">Track and analyze your payslip data</p>
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
              <p className="text-xs text-muted-foreground">
                {stats.totalUploads === 0 ? "No payslips uploaded yet" : "Click to view all"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => stats.latestGrossPay && setSelectedDialog('latest')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Gross Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.latestGrossPay ? formatCurrency(stats.latestGrossPay, currency) : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.latestGrossPay ? "Click for breakdown" : "Upload your first payslip"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => stats.trend && setSelectedDialog('trend')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trend || "-"}</div>
              <p className="text-xs text-muted-foreground">
                {stats.trend ? "Click for comparison" : "Need more data"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Upload</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PayslipUpload compact isEmailVerified={isEmailVerified} subscriptionTier={subscriptionTier} uploadsRemaining={uploadsRemaining} />
            </CardContent>
          </Card>
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
                  {payslipData.slice(0, 3).map((payslip) => (
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
                            {new Date(payslip.created_at).toLocaleDateString()}
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
                  ))}
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
                    <span className="text-muted-foreground">Social Security</span>
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
      </main>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Dashboard;
