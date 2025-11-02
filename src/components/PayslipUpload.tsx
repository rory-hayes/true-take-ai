import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PayslipUpload = () => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    // Placeholder for file upload
    toast({
      title: "Upload feature coming soon",
      description: "File storage and OCR processing will be implemented next",
    });
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
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-lg font-medium mb-2">Drop your payslip here</p>
      <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        className="hidden"
        id="file-upload"
      />
      <Button asChild variant="outline">
        <label htmlFor="file-upload" className="cursor-pointer">
          Select PDF File
        </label>
      </Button>
      <p className="text-xs text-muted-foreground mt-4">
        Supports PDF format only • Max 10MB
      </p>
    </div>
  );
};

export default PayslipUpload;
