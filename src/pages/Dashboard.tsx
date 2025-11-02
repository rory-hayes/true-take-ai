import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, LogOut, TrendingUp, DollarSign } from "lucide-react";
import FloatingChatButton from "@/components/FloatingChatButton";
import PayslipUpload from "@/components/PayslipUpload";
import PayslipChart from "@/components/PayslipChart";
import { UserMenu } from "@/components/UserMenu";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth?mode=login");
      } else {
        setUser(session.user);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth?mode=login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
              True Take
            </span>
          </div>
          <UserMenu userEmail={user?.email || ""} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
          <p className="text-muted-foreground">Track and analyze your payslip data</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No payslips uploaded yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Gross Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Upload your first payslip</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Need more data</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Upload Payslip</CardTitle>
              <CardDescription>
                Upload your payslip PDF for automatic data extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayslipUpload />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Payslips</CardTitle>
              <CardDescription>Your recently uploaded payslip documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payslips uploaded yet</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <Card>
          <CardHeader>
            <CardTitle>Income Trends</CardTitle>
            <CardDescription>
              View your income trends over the past 12 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PayslipChart />
          </CardContent>
        </Card>
      </main>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Dashboard;
