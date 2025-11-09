import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Download, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/lib/currencyUtils";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AUD", "CAD"];
const COUNTRIES = ["IE", "UK", "US", "FR", "DE", "ES", "IT", "NL", "BE", "CH"];

export default function Settings() {
  const navigate = useNavigate();
  const { refreshCurrency, currency: globalCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [country, setCountry] = useState("IE");
  const [dataRetention, setDataRetention] = useState("24");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [userId, setUserId] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("currency, country, data_retention_months, date_of_birth, subscription_tier, subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setCurrency(profile.currency || "EUR");
        setCountry(profile.country || "IE");
        setDataRetention((profile.data_retention_months || 24).toString());
        setDateOfBirth(profile.date_of_birth || "");
        setSubscriptionTier(profile.subscription_tier || "free");
        setSubscriptionStatus(profile.subscription_status || "inactive");
      }
    };

    loadSettings();
  }, [navigate]);

  const handleCheckSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        toast.error("Failed to check subscription. Please try again.");
        return;
      }

      console.log('Subscription check result:', data);
      
      if (data.subscribed) {
        setSubscriptionTier(data.subscription_tier);
        setSubscriptionStatus('active');
        toast.success(`Subscription verified! You're on the ${data.subscription_tier} plan.`);
      } else {
        setSubscriptionTier('free');
        setSubscriptionStatus('inactive');
        toast.info("No active subscription found.");
      }
    } catch (error) {
      console.error('Error in handleCheckSubscription:', error);
      toast.error("Failed to check subscription. Please try again.");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {      
      const { error } = await supabase
        .from("profiles")
        .update({
          currency,
          country,
          data_retention_months: parseInt(dataRetention),
          date_of_birth: dateOfBirth || null,
        })
        .eq("id", userId);

      if (error) throw error;

      // Refresh currency context to ensure it's in sync
      await refreshCurrency();
      toast.success("Settings saved successfully. All amounts have been updated.");
    } catch (error: any) {
      toast.error(error.message || "Error saving settings");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    setLoading(true);
    try {
      // Delete payslip data
      const { error: dataError } = await supabase
        .from("payslip_data")
        .delete()
        .eq("user_id", userId);

      if (dataError) throw dataError;

      // Delete payslips
      const { error: payslipsError } = await supabase
        .from("payslips")
        .delete()
        .eq("user_id", userId);

      if (payslipsError) throw payslipsError;

      // Delete files from storage
      const { data: files } = await supabase.storage
        .from("payslips")
        .list(userId);

      if (files && files.length > 0) {
        const filePaths = files.map((file) => `${userId}/${file.name}`);
        await supabase.storage.from("payslips").remove(filePaths);
      }

      // Reset upload count
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ uploads_remaining: 3 })
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("All data deleted successfully");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Error deleting data");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      // Fetch all payslip data
      const { data: payslipData, error: dataError } = await supabase
        .from("payslip_data")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (dataError) throw dataError;

      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name, currency, country, subscription_tier, created_at")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Format data for export
      const exportData = {
        profile: {
          email: profile.email,
          name: profile.full_name || "N/A",
          currency: profile.currency,
          country: profile.country,
          subscription_tier: profile.subscription_tier,
          account_created: profile.created_at,
        },
        payslips: payslipData.map((p) => ({
          date: new Date(p.created_at).toLocaleDateString(),
          gross_pay: formatCurrency(p.gross_pay, globalCurrency),
          net_pay: formatCurrency(p.net_pay, globalCurrency),
          tax_deducted: formatCurrency(p.tax_deducted, globalCurrency),
          pension: formatCurrency(p.pension, globalCurrency),
          social_security: formatCurrency(p.social_security, globalCurrency),
          other_deductions: formatCurrency(p.other_deductions, globalCurrency),
          confirmed: p.confirmed,
        })),
        total_payslips: payslipData.length,
        export_date: new Date().toISOString(),
      };

      // Convert to JSON and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxman-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export data. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      // Delete payslip data
      await supabase.from("payslip_data").delete().eq("user_id", userId);
      
      // Delete payslips
      await supabase.from("payslips").delete().eq("user_id", userId);
      
      // Delete files from storage
      const { data: files } = await supabase.storage
        .from("payslips")
        .list(userId);

      if (files && files.length > 0) {
        const filePaths = files.map((file) => `${userId}/${file.name}`);
        await supabase.storage.from("payslips").remove(filePaths);
      }

      // Delete subscriptions (if any)
      await supabase.from("subscriptions").delete().eq("user_id", userId);

      // Delete one_time_purchases (if any)
      await supabase.from("one_time_purchases").delete().eq("user_id", userId);

      // Delete profile
      await supabase.from("profiles").delete().eq("id", userId);

      // Sign out the user
      await supabase.auth.signOut();
      
      toast.success("Account deleted successfully. You will be redirected to the home page.");
      
      // Redirect to landing page
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Account deletion error:", error);
      toast.error(error.message || "Error deleting account. Please contact support.");
      setLoading(false);
    }
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

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account preferences and data
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>
                Set your preferred currency and location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" aria-label="Select preferred currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country" aria-label="Select your country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((ctry) => (
                      <SelectItem key={ctry} value={ctry}>
                        {ctry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  aria-label="Your date of birth"
                  aria-describedby="dob-hint"
                />
                <p id="dob-hint" className="text-sm text-muted-foreground mt-2">
                  Required for accurate pension contribution calculations
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>
                View and manage your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div>
                  <p className="font-semibold text-lg capitalize">{subscriptionTier} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Status: <span className={subscriptionStatus === 'active' ? 'text-green-600' : 'text-muted-foreground'}>
                      {subscriptionStatus}
                    </span>
                  </p>
                </div>
                <Button
                  onClick={handleCheckSubscription}
                  disabled={subscriptionLoading}
                  variant="outline"
                  aria-label="Refresh subscription status"
                >
                  {subscriptionLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Refresh Status"
                  )}
                </Button>
              </div>
              {subscriptionTier === 'free' && (
                <div className="text-sm text-muted-foreground">
                  <p>Want unlimited uploads? <a href="/pricing" className="text-primary underline">Upgrade now</a></p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
              <CardDescription>
                How long should we keep your payslip data?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="retention">Retention Period (months)</Label>
              <Input
                id="retention"
                type="number"
                min="1"
                max="120"
                value={dataRetention}
                onChange={(e) => setDataRetention(e.target.value)}
                aria-label="Data retention period in months"
                aria-describedby="retention-hint"
              />
              <p id="retention-hint" className="text-sm text-muted-foreground mt-2">
                Data older than this period will be automatically deleted
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveSettings} 
              disabled={loading}
              aria-label={loading ? "Saving settings" : "Save settings"}
              aria-busy={loading}
            >
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Export Your Data</CardTitle>
              <CardDescription>
                Download all your payslip data for your records or compliance purposes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export includes your profile information and all payslip summaries in JSON format. 
                This data can be imported into spreadsheet software for further analysis.
              </p>
              <Button
                onClick={handleExportData}
                disabled={exportLoading}
                variant="outline"
                className="w-full sm:w-auto"
                aria-label={exportLoading ? "Exporting data" : "Export your data"}
                aria-busy={exportLoading}
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Download My Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that will permanently affect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" 
                      disabled={loading}
                      aria-label="Delete all payslip data"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete Payslip Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all payslip data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your payslips and reset your upload count. 
                        Your account and subscription will remain active.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAllData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Payslip Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-sm text-muted-foreground mt-2">
                  Removes all your payslip files and data but keeps your account active.
                </p>
              </div>

              <div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={loading}
                      aria-label="Delete account permanently"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p className="font-semibold text-destructive">
                          This action cannot be undone.
                        </p>
                        <p>
                          This will permanently delete your account, all your payslip data, 
                          subscriptions, and remove all your information from our servers.
                        </p>
                        <p>
                          You will need to create a new account to use the service again.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Delete My Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-sm text-muted-foreground mt-2">
                  Permanently deletes your account and all associated data. This cannot be reversed.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
