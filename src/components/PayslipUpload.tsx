import { useState, useEffect } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PayslipUploadProps {
  compact?: boolean;
  isEmailVerified?: boolean;
  subscriptionTier?: string;
  uploadsRemaining?: number;
}

const PayslipUpload = ({ 
  compact = false, 
  isEmailVerified: propIsEmailVerified,
  subscriptionTier: propSubscriptionTier,
  uploadsRemaining: propUploadsRemaining 
}: PayslipUploadProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [internalIsEmailVerified, setInternalIsEmailVerified] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [uploadsRemaining, setUploadsRemaining] = useState<number>(3);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const isEmailVerified = propIsEmailVerified ?? internalIsEmailVerified;

  useEffect(() => {
    // If props are provided, use them; otherwise fetch
    if (propSubscriptionTier !== undefined && propUploadsRemaining !== undefined) {
      setSubscriptionTier(propSubscriptionTier);
      setUploadsRemaining(propUploadsRemaining);
      return;
    }

    const loadUserQuota = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setInternalIsEmailVerified(!!user.email_confirmed_at);

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, uploads_remaining")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
          setUploadsRemaining(profile.uploads_remaining);
        }
      } catch (error) {
        console.error("Error loading user quota:", error);
      }
    };

    loadUserQuota();
  }, [propSubscriptionTier, propUploadsRemaining]);

  const handleFileSelect = async (file: File) => {
    // Check email verification first
    if (!isEmailVerified) {
      toast({
        title: "Email verification required",
        description: "Please verify your email before uploading payslips",
        variant: "destructive",
      });
      return;
    }

    // Check quota for free users
    if (subscriptionTier === "free" && uploadsRemaining <= 0) {
      setShowUpgradeDialog(true);
      return;
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, PNG, or JPEG file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload payslips",
          variant: "destructive",
        });
        return;
      }

      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Create payslip record
      const { data: payslip, error: insertError } = await supabase
        .from('payslips')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: fileName,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      toast({
        title: "File uploaded",
        description: "Processing payslip with OCR...",
      });

      // Call OCR edge function
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
        'process-payslip-ocr',
        {
          body: { payslipId: payslip.id, userId: user.id },
        }
      );

      if (ocrError) {
        console.error('OCR error:', ocrError);
        
        let errorMessage = "Failed to process payslip. Please try again or enter data manually.";
        
        if (ocrError.message?.includes("Upload quota exceeded")) {
          errorMessage = "Upload quota exceeded. Please upgrade to continue uploading payslips.";
        } else if (ocrError.message?.includes("Vision OCR failed")) {
          errorMessage = "Unable to extract text from this document. This may be a scanned or image-based PDF. Please verify the extracted data or enter it manually.";
        } else if (ocrError.message?.includes("Rate limit")) {
          errorMessage = "AI processing rate limit reached. Please try again in a few moments.";
        } else if (ocrError.message?.includes("credits depleted")) {
          errorMessage = "AI processing credits depleted. Please contact support or try again later.";
        }
        
        toast({
          title: "Processing Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw ocrError;
      }

      // Check if manual entry is required (scanned document)
      if (ocrResult.requires_manual_entry) {
        toast({
          title: "Manual entry required",
          description: "This appears to be a scanned document. Please enter your payslip values manually.",
        });
      } else {
        toast({
          title: "OCR complete",
          description: "Please review the extracted data",
        });
      }

      // Decrement uploads_remaining for free users
      if (subscriptionTier === "free") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ uploads_remaining: uploadsRemaining - 1 })
          .eq("id", user.id);

        if (!updateError) {
          setUploadsRemaining(uploadsRemaining - 1);
        }
      }

      // Navigate to confirmation page
      navigate(`/confirm/${ocrResult.data.id}`);

    } catch (error) {
      console.error('Error uploading payslip:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg text-center transition-colors ${
        compact ? 'p-4' : 'p-8'
      } ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (isEmailVerified && !(subscriptionTier === "free" && uploadsRemaining <= 0)) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {!compact && (
        <>
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Drop your payslip here</p>
          <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
        </>
      )}
      
      {subscriptionTier === "free" && (
        <div className="mb-4">
          {uploadsRemaining > 0 ? (
            <p className={`text-sm ${uploadsRemaining <= 1 ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>
              {uploadsRemaining} upload{uploadsRemaining !== 1 ? 's' : ''} remaining on your free plan
            </p>
          ) : (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-destructive mb-2">
                You've reached your upload limit
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to a paid plan for unlimited uploads and premium features
              </p>
              <Button
                size="sm"
                onClick={() => navigate("/pricing")}
                className="w-full"
              >
                View Plans & Upgrade
              </Button>
            </div>
          )}
        </div>
      )}
      
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg"
        onChange={handleFileInput}
        className="hidden"
        id={compact ? "file-upload-compact" : "file-upload"}
        aria-label="Upload payslip file"
        disabled={!isEmailVerified || (subscriptionTier === "free" && uploadsRemaining <= 0)}
      />
      <Button 
        asChild={!((!isEmailVerified) || (subscriptionTier === "free" && uploadsRemaining <= 0))}
        variant="outline" 
        disabled={isUploading || !isEmailVerified || (subscriptionTier === "free" && uploadsRemaining <= 0)} 
        className="w-full"
        onClick={(e) => {
          if (!isEmailVerified || (subscriptionTier === "free" && uploadsRemaining <= 0)) {
            e.preventDefault();
            if (!isEmailVerified) {
              toast({
                title: "Email verification required",
                description: "Please verify your email before uploading payslips",
                variant: "destructive",
              });
            } else {
              setShowUpgradeDialog(true);
            }
          }
        }}
      >
        {!isEmailVerified ? (
          <div className="cursor-not-allowed">
            <Upload className="mr-2 h-4 w-4 inline" />
            Verify Email to Upload
          </div>
        ) : subscriptionTier === "free" && uploadsRemaining <= 0 ? (
          <div className="cursor-not-allowed">
            <Upload className="mr-2 h-4 w-4 inline" />
            Upgrade to Upload
          </div>
        ) : (
          <label 
            htmlFor={compact ? "file-upload-compact" : "file-upload"} 
            className="cursor-pointer"
            aria-label="Upload payslip"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {compact ? "Upload" : "Select File"}
              </>
            )}
          </label>
        )}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        {compact ? "PDF, PNG, JPEG" : "Supports PDF, PNG, JPEG • Max 10MB"}
      </p>

      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You've used all {3} uploads on your free plan. Upgrade to a paid plan for unlimited uploads and premium features like AI ChatKit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/pricing")}>
              View Plans & Upgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayslipUpload;
