import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText, TrendingUp, Shield, Sparkles } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              True Take
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/auth?mode=login")}>
              Login
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Track Your Payslips,
            <span className="block bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Maximize Your Returns
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload your payslips, spot trends instantly, and get AI-powered insights to help you understand your earnings and prepare for tax season.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=login")} className="text-lg px-8">
              Sign In
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Start with 3 free uploads • No credit card required
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Everything You Need to Track Your Income
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart OCR Extraction</h3>
              <p className="text-muted-foreground">
                Automatically extract and verify all data from your payslips with AI-powered accuracy.
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Trend Analysis</h3>
              <p className="text-muted-foreground">
                Visualize your income trends over 12 months with detailed charts and insights.
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
              <p className="text-muted-foreground">
                Your financial data is encrypted and stored securely. Only you have access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-12 border border-border">
          <Sparkles className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold">Ready to Take Control?</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of users who are already tracking their income smarter.
          </p>
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-lg px-8">
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2025 True Take. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
