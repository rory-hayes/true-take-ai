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
import { ArrowLeft, Trash2 } from "lucide-react";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AUD", "CAD"];
const COUNTRIES = ["IE", "UK", "US", "FR", "DE", "ES", "IT", "NL", "BE", "CH"];

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [country, setCountry] = useState("IE");
  const [dataRetention, setDataRetention] = useState("24");
  const [userId, setUserId] = useState("");

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
        .select("currency, country, data_retention_months")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCurrency(profile.currency || "EUR");
        setCountry(profile.country || "IE");
        setDataRetention((profile.data_retention_months || 24).toString());
      }
    };

    loadSettings();
  }, [navigate]);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          currency,
          country,
          data_retention_months: parseInt(dataRetention),
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Settings saved successfully");
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
                  <SelectTrigger id="currency">
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
                  <SelectTrigger id="country">
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
              />
              <p className="text-sm text-muted-foreground mt-2">
                Data older than this period will be automatically deleted
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that will permanently affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all
                      your payslip data and reset your account. Your subscription
                      will remain active.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
