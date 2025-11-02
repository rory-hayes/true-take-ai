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
}

const PayslipUpload = ({ compact = false }: PayslipUploadProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [uploadsRemaining, setUploadsRemaining] = useState<number>(3);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    const loadUserQuota = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
  }, []);

  const handleFileSelect = async (file: File) => {
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
          body: { payslipId: payslip.id },
        }
      );

      if (ocrError) {
        console.error('OCR error:', ocrError);
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
        setIsDragging(true);
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
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg"
        onChange={handleFileInput}
        className="hidden"
        id={compact ? "file-upload-compact" : "file-upload"}
      />
      <Button asChild variant="outline" disabled={isUploading} className="w-full">
        <label htmlFor={compact ? "file-upload-compact" : "file-upload"} className="cursor-pointer">
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
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        {compact ? "PDF, PNG, JPEG" : "Supports PDF, PNG, JPEG • Max 10MB"}
      </p>

      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached your free plan limit of 3 uploads. Upgrade to a paid plan for unlimited uploads and premium features like AI ChatKit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/pricing")}>
              View Plans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayslipUpload;
