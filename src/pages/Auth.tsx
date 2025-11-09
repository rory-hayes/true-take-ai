import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Mail } from "lucide-react";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms of Service",
  }),
  acceptPrivacy: z.boolean().refine((val) => val === true, {
    message: "You must accept the Privacy Policy",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">(
    (searchParams.get("mode") as "login" | "signup") || "login"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signupSchema.parse({ 
        email, 
        password, 
        confirmPassword,
        dateOfBirth,
        acceptTerms, 
        acceptPrivacy 
      });
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      // Store legal agreement timestamps and IP address
      if (authData.user) {
        const now = new Date().toISOString();
        
        // Get user's IP address (best effort)
        let ipAddress = "unknown";
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
        } catch (error) {
          console.error("Failed to fetch IP address:", error);
        }

        await supabase
          .from("profiles")
          .update({
            terms_accepted_at: now,
            privacy_accepted_at: now,
            signup_ip_address: ipAddress,
            date_of_birth: validated.dateOfBirth,
          })
          .eq("id", authData.user.id);
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });

      // Redirect to verification page
      navigate("/verify-email");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create account",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to login",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            Tally
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access your dashboard"
                : "Start tracking your payslips today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address"
                  aria-describedby="email-error"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-label={mode === "login" ? "Password" : "Create password (minimum 6 characters)"}
                  aria-describedby="password-error"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      aria-label="Confirm your password"
                      aria-describedby="confirm-password-error"
                      autoComplete="new-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      aria-label="Date of birth for pension calculations"
                    />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="acceptTerms"
                        checked={acceptTerms}
                        onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      />
                      <label
                        htmlFor="acceptTerms"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I accept the{" "}
                        <Link to="/terms" className="text-primary hover:underline" target="_blank">
                          Terms of Service
                        </Link>
                      </label>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="acceptPrivacy"
                        checked={acceptPrivacy}
                        onCheckedChange={(checked) => setAcceptPrivacy(checked as boolean)}
                      />
                      <label
                        htmlFor="acceptPrivacy"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I accept the{" "}
                        <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>
                  </div>
                </>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || (mode === "signup" && (!acceptTerms || !acceptPrivacy))}
                aria-label={isLoading ? "Processing" : mode === "login" ? "Sign in to your account" : "Create your account"}
                aria-busy={isLoading}
              >
                {isLoading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
              {mode === "signup" && (!acceptTerms || !acceptPrivacy) && (
                <p className="text-sm text-destructive text-center">
                  You must accept the Terms of Service and Privacy Policy to continue
                </p>
              )}
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>

            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setDateOfBirth("");
                  setAcceptTerms(false);
                  setAcceptPrivacy(false);
                }}
                className="text-primary hover:underline"
              >
                {mode === "login"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Log in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
