import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Download, Edit2, Save, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [payslipData, setPayslipData] = useState<any>(null);
  const [payslip, setPayslip] = useState<any>(null);
  const [editValues, setEditValues] = useState({
    gross_pay: 0,
    net_pay: 0,
    tax_deducted: 0,
    pension: 0,
    social_security: 0,
    other_deductions: 0,
  });

  useEffect(() => {
    loadPayslipDetail();
  }, [id]);

  const loadPayslipDetail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get payslip data
      const { data: payslipDataResult, error: dataError } = await supabase
        .from("payslip_data")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (dataError) throw dataError;
      if (!payslipDataResult) {
        toast.error("Payslip not found");
        navigate("/dashboard");
        return;
      }

      setPayslipData(payslipDataResult);
      setEditValues({
        gross_pay: payslipDataResult.gross_pay || 0,
        net_pay: payslipDataResult.net_pay || 0,
        tax_deducted: payslipDataResult.tax_deducted || 0,
        pension: payslipDataResult.pension || 0,
        social_security: payslipDataResult.social_security || 0,
        other_deductions: payslipDataResult.other_deductions || 0,
      });

      // Get payslip file info
      const { data: payslipResult } = await supabase
        .from("payslips")
        .select("*")
        .eq("id", payslipDataResult.payslip_id)
        .maybeSingle();

      if (payslipResult) {
        setPayslip(payslipResult);
      }
    } catch (error: any) {
      console.error("Error loading payslip:", error);
      toast.error(error.message || "Error loading payslip");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("payslip_data")
        .update(editValues)
        .eq("id", id);

      if (error) throw error;

      setPayslipData({ ...payslipData, ...editValues });
      setIsEditing(false);
      toast.success("Payslip updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Error updating payslip");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete payslip data
      const { error: dataError } = await supabase
        .from("payslip_data")
        .delete()
        .eq("id", id);

      if (dataError) throw dataError;

      // Delete payslip file
      if (payslip) {
        const { error: fileError } = await supabase
          .from("payslips")
          .delete()
          .eq("id", payslip.id);

        if (fileError) throw fileError;

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("payslips")
          .remove([payslip.file_path]);

        if (storageError) console.error("Storage deletion error:", storageError);
      }

      toast.success("Payslip deleted successfully");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Error deleting payslip");
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!payslip) {
      toast.error("No file available for download");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("payslips")
        .download(payslip.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = payslip.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download started");
    } catch (error: any) {
      toast.error(error.message || "Error downloading file");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!payslipData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex gap-2">
            {payslip && (
              <Button
                variant="outline"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Original
              </Button>
            )}
            
            {!isEditing ? (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditValues({
                      gross_pay: payslipData.gross_pay || 0,
                      net_pay: payslipData.net_pay || 0,
                      tax_deducted: payslipData.tax_deducted || 0,
                      pension: payslipData.pension || 0,
                      social_security: payslipData.social_security || 0,
                      other_deductions: payslipData.other_deductions || 0,
                    });
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Payslip Details</h1>
            <p className="text-muted-foreground mt-2">
              {payslip ? payslip.file_name : "Uploaded on"} {new Date(payslipData.created_at).toLocaleDateString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income & Deductions</CardTitle>
              <CardDescription>
                {isEditing ? "Edit your payslip values" : "Review your payslip breakdown"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="gross_pay">Gross Pay</Label>
                {isEditing ? (
                  <Input
                    id="gross_pay"
                    type="number"
                    step="0.01"
                    value={editValues.gross_pay}
                    onChange={(e) => setEditValues({ ...editValues, gross_pay: parseFloat(e.target.value) || 0 })}
                  />
                ) : (
                  <p className="text-2xl font-bold mt-1">{formatCurrency(payslipData.gross_pay, currency)}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_deducted">Tax Deducted</Label>
                  {isEditing ? (
                    <Input
                      id="tax_deducted"
                      type="number"
                      step="0.01"
                      value={editValues.tax_deducted}
                      onChange={(e) => setEditValues({ ...editValues, tax_deducted: parseFloat(e.target.value) || 0 })}
                    />
                  ) : (
                    <p className="text-lg font-medium text-red-600 mt-1">-{formatCurrency(payslipData.tax_deducted, currency)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="pension">Pension</Label>
                  {isEditing ? (
                    <Input
                      id="pension"
                      type="number"
                      step="0.01"
                      value={editValues.pension}
                      onChange={(e) => setEditValues({ ...editValues, pension: parseFloat(e.target.value) || 0 })}
                    />
                  ) : (
                    <p className="text-lg font-medium text-red-600 mt-1">-{formatCurrency(payslipData.pension, currency)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="social_security">PRSI</Label>
                  {isEditing ? (
                    <Input
                      id="social_security"
                      type="number"
                      step="0.01"
                      value={editValues.social_security}
                      onChange={(e) => setEditValues({ ...editValues, social_security: parseFloat(e.target.value) || 0 })}
                    />
                  ) : (
                    <p className="text-lg font-medium text-red-600 mt-1">-{formatCurrency(payslipData.social_security, currency)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="other_deductions">Other Deductions</Label>
                  {isEditing ? (
                    <Input
                      id="other_deductions"
                      type="number"
                      step="0.01"
                      value={editValues.other_deductions}
                      onChange={(e) => setEditValues({ ...editValues, other_deductions: parseFloat(e.target.value) || 0 })}
                    />
                  ) : (
                    <p className="text-lg font-medium text-red-600 mt-1">-{formatCurrency(payslipData.other_deductions, currency)}</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="net_pay">Net Pay</Label>
                {isEditing ? (
                  <Input
                    id="net_pay"
                    type="number"
                    step="0.01"
                    value={editValues.net_pay}
                    onChange={(e) => setEditValues({ ...editValues, net_pay: parseFloat(e.target.value) || 0 })}
                  />
                ) : (
                  <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(payslipData.net_pay, currency)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Payslip</CardTitle>
              <CardDescription>
                Permanently remove this payslip from your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Payslip
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete this payslip
                      and all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
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
