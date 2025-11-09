import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { FileText, TrendingUp, Shield, Sparkles, Upload, Search, CheckCircle, Lock, Globe, Database, Eye, MessageSquare } from "lucide-react";
const Landing = () => {
  const navigate = useNavigate();
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({
      behavior: "smooth"
    });
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Tally
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection("how-it-works")} className="text-sm font-medium hover:text-primary transition-colors">
              How it works
            </button>
            <button onClick={() => scrollToSection("benefits")} className="text-sm font-medium hover:text-primary transition-colors">
              Benefits
            </button>
            <button onClick={() => scrollToSection("testimonials")} className="text-sm font-medium hover:text-primary transition-colors">
              Testimonials
            </button>
            <button onClick={() => scrollToSection("pricing")} className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </button>
          </nav>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth?mode=login")}>
              Sign In
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
            AI-Powered Payslip Analysis
          </h1>
          <p className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            Understand your payslip. Catch mistakes. Gain clarity.
          </p>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Tally analyses each payslip instantly—explaining your pay, taxes, and deductions in human language. Keep every payslip consistent and catch issues before they cost you money.
          </p>
          <div className="flex flex-col gap-3 max-w-md mx-auto text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Start without a credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>See insights in under five seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Learn from thousands of analysed payslips</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-lg px-8">
              Upload My Payslip
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Book a Demo for Companies
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">Three simple steps to payslip clarity</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Step 1: Upload your payslip</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Drag in a PDF, photo, or CSV from any major employer in the UK or Ireland.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Step 2: Let AI review it</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  The analysis engine checks calculations, highlights anomalies, and explains each section.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Step 3: Act on instant insights</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track trends, download summaries, and share findings before payroll mistakes become costly.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Tally?</h2>
            <p className="text-xl text-muted-foreground">AI that works for you, not against you</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Translate every line item</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Turn payroll jargon into plain language so you always understand gross, net, and deductions.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Catch payroll errors automatically</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Compare payslips over time to spot incorrect tax codes, missing contributions, and surprise deductions.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Automate tax-time prep</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate year-end summaries, track reliefs, and export accountant-ready reports in one click.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Stay in control of your data</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Encrypt every payslip, host in the EU, and delete anything instantly from your secure dashboard.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          <div className="text-center mt-12 p-6 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-xl font-semibold">
              Average users recover €120 per year from payroll mistakes
            </p>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="container mx-auto px-4 py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Security & Transparency</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your payslip contains sensitive personal data. We built Tally with privacy as the default so you always know how information is handled.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="flex gap-4 items-start">
              <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-muted-foreground">
                Encrypt data in transit and at rest with TLS 1.3 and AES-256.
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-muted-foreground">
                Process files exclusively on EU-based infrastructure.
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-muted-foreground">
                Redact personally identifiable information before AI analysis.
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-muted-foreground">
                Provide full activity history so you can audit who accessed what.
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-muted-foreground">
                Offer granular data retention controls inside your settings.
              </p>
            </div>
          </div>
          <div className="bg-card rounded-lg p-8 border border-border">
            <h3 className="text-2xl font-bold mb-6 text-center">Security Snapshot</h3>
            <p className="text-muted-foreground text-center mb-8">
              Key facts about how Tally handles your documents
            </p>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <Lock className="h-8 w-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Encryption</h4>
                <p className="text-sm text-muted-foreground">
                  AES-256 at rest and TLS 1.3 in transit keep your files protected.
                </p>
              </div>
              <div className="text-center">
                <Globe className="h-8 w-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Regional processing</h4>
                <p className="text-sm text-muted-foreground">
                  Data stays on EU cloud regions in Dublin and Frankfurt.
                </p>
              </div>
              <div className="text-center">
                <Database className="h-8 w-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Data control</h4>
                <p className="text-sm text-muted-foreground">
                  Delete uploads instantly or set automated retention policies.
                </p>
              </div>
              <div className="text-center">
                <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Visibility</h4>
                <p className="text-sm text-muted-foreground">
                  Full activity history shows who uploaded, reviewed, or exported files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Customer Stories</h2>
            <p className="text-xl text-muted-foreground">
              Real results from people and teams who rely on Tally
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardDescription className="text-base italic mb-4">
                  "Tally spotted an emergency tax code on my first upload. It paid for itself in one payday."
                </CardDescription>
                <div>
                  <CardTitle className="text-lg">Aoife M.</CardTitle>
                  <p className="text-sm text-muted-foreground">Marketing Manager, Dublin</p>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription className="text-base italic mb-4">
                  "The year-end summary saved our finance team a full day. We exported everything straight to payroll."
                </CardDescription>
                <div>
                  <CardTitle className="text-lg">James L.</CardTitle>
                  <p className="text-sm text-muted-foreground">People Operations Lead, London</p>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription className="text-base italic mb-4">
                  "I finally understand my deductions. The explanations are clear and I can download evidence for HR instantly."
                </CardDescription>
                <div>
                  <CardTitle className="text-lg">Sara P.</CardTitle>
                  <p className="text-sm text-muted-foreground">Software Engineer, Galway</p>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the plan that works for you</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Monthly</CardTitle>
                <CardDescription>Perfect for ongoing payroll checkups</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">€5</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Upload unlimited payslips</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Spot incorrect tax codes automatically</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Generate instant AI explanations</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Export shareable PDF reports</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Get responsive email support</span>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={() => navigate("/auth?mode=signup")}>
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
            <Card className="border-primary relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Best Value
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Tax Time Bundle</CardTitle>
                <CardDescription>Save two months – €50 per year</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">€50</span>
                  <span className="text-muted-foreground">/yr</span>
                  <span className="ml-2 text-sm line-through text-muted-foreground">€60</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Everything in Monthly plan</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Priority human review when anomalies appear</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Download year-end tax packs in seconds</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Store full history with configurable retention</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">Get early access to beta features and product roadmap</span>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={() => navigate("/auth?mode=signup")}>
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Limited beta spots available. Cancel anytime.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">Is my data safe?</AccordionTrigger>
              <AccordionContent>
                Yes. All data is encrypted with AES-256 at rest and TLS 1.3 in transit. We process everything on EU-based infrastructure and redact personally identifiable information before AI analysis.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">What formats are supported?</AccordionTrigger>
              <AccordionContent>
                We support PDF, photos (JPG, PNG), and CSV files from any major employer in the UK or Ireland.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">How does the AI catch errors?</AccordionTrigger>
              <AccordionContent>
                Our AI compares your payslips over time, checks tax calculations, verifies deductions, and highlights anomalies like incorrect tax codes or missing contributions.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">Do you keep my payslips?</AccordionTrigger>
              <AccordionContent>
                You're in control. You can delete any upload instantly or set automated retention policies in your settings.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left">Can I cancel anytime?</AccordionTrigger>
              <AccordionContent>
                Yes, you can cancel your subscription at any time with no questions asked.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left">What makes this better than reading my payslip manually?</AccordionTrigger>
              <AccordionContent>
                Tally translates payroll jargon into plain language, automatically spots errors by comparing payslips over time, and generates year-end summaries in seconds—saving you time and catching mistakes that cost money.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-4 py-20 bg-secondary/30">
        <div className="max-w-4xl mx-auto text-center space-y-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-12 border border-border">
          <Sparkles className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold">Get clarity on your pay — in seconds.</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of people who understand their payslips and catch errors before they cost money.
          </p>
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-lg px-8">
            Try It Free
          </Button>
          <p className="text-sm text-muted-foreground">
            No credit card required • Cancel anytime • Results in 5 seconds
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">Tally</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered payslip analysis for everyone. Built and hosted in the EU.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <div className="space-y-2">
                <button onClick={() => scrollToSection("how-it-works")} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                  How It Works
                </button>
                <button onClick={() => scrollToSection("pricing")} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                  Pricing
                </button>
                <button onClick={() => scrollToSection("benefits")} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                  Features
                </button>
                <button onClick={() => scrollToSection("testimonials")} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                  Testimonials
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; 2025 Tally. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;