import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PayslipData {
  id: string;
  gross_pay: number;
  tax_deducted: number;
  net_pay: number;
  pension: number;
  social_security: number;
  other_deductions: number;
  additional_data: any;
}

const ConfirmPayslip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PayslipData | null>(null);
  const [isEditingAdditional, setIsEditingAdditional] = useState(false);
  const [editedAdditionalData, setEditedAdditionalData] = useState<any>({});
  
  const currencySymbol = getCurrencySymbol(currency);

  useEffect(() => {
    fetchPayslipData();
  }, [id]);

  const fetchPayslipData = async () => {
    try {
      const { data: payslipData, error } = await supabase
        .from('payslip_data')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setData(payslipData);
      setEditedAdditionalData(payslipData.additional_data || {});
    } catch (error) {
      console.error('Error fetching payslip data:', error);
      toast({
        title: "Error",
        description: "Failed to load payslip data",
        variant: "destructive",
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAdditionalDataEdit = (key: string, value: string) => {
    setEditedAdditionalData({
      ...editedAdditionalData,
      [key]: value
    });
  };

  const handleSaveAdditionalData = () => {
    setData({
      ...data!,
      additional_data: editedAdditionalData
    });
    setIsEditingAdditional(false);
    toast({
      title: "Changes saved",
      description: "Additional information updated. Don't forget to Confirm & Save.",
    });
  };

  const handleCancelAdditionalEdit = () => {
    setEditedAdditionalData(data?.additional_data || {});
    setIsEditingAdditional(false);
  };

  const handleConfirm = async () => {
    if (!data) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('payslip_data')
        .update({
          gross_pay: data.gross_pay,
          tax_deducted: data.tax_deducted,
          net_pay: data.net_pay,
          pension: data.pension,
          social_security: data.social_security,
          other_deductions: data.other_deductions,
          additional_data: data.additional_data,
          confirmed: true,
        })
        .eq('id', id);

      if (error) throw error;

      // Decrement uploads_remaining for free tier users
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier, uploads_remaining')
          .eq('id', user.id)
          .single();

        if (profile?.subscription_tier === 'free' && profile.uploads_remaining > 0) {
          await supabase
            .from('profiles')
            .update({ uploads_remaining: profile.uploads_remaining - 1 })
            .eq('id', user.id);
        }
      }

      toast({
        title: "Success",
        description: "Payslip data confirmed and saved",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error confirming payslip:', error);
      toast({
        title: "Error",
        description: "Failed to save payslip data",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      // Delete the unconfirmed data and associated payslip
      if (data) {
        const { data: payslipData } = await supabase
          .from('payslip_data')
          .select('payslip_id')
          .eq('id', id)
          .single();

        await supabase.from('payslip_data').delete().eq('id', id);
        
        if (payslipData?.payslip_id) {
          await supabase.from('payslips').delete().eq('id', payslipData.payslip_id);
        }
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Error canceling:', error);
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>No data found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Confirm Payslip Data</h1>
            <p className="text-muted-foreground">
              Review and edit the extracted information before saving
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Extracted Information
              </CardTitle>
              <CardDescription>
                Please verify all amounts are correct. Edit any incorrect values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gross_pay">Gross Pay ({currencySymbol})</Label>
                  <Input
                    id="gross_pay"
                    type="number"
                    step="0.01"
                    value={data.gross_pay || ''}
                    onChange={(e) => setData({ ...data, gross_pay: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="net_pay">Net Pay ({currencySymbol})</Label>
                  <Input
                    id="net_pay"
                    type="number"
                    step="0.01"
                    value={data.net_pay || ''}
                    onChange={(e) => setData({ ...data, net_pay: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_deducted">Tax Deducted ({currencySymbol})</Label>
                  <Input
                    id="tax_deducted"
                    type="number"
                    step="0.01"
                    value={data.tax_deducted || ''}
                    onChange={(e) => setData({ ...data, tax_deducted: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pension">Pension ({currencySymbol})</Label>
                  <Input
                    id="pension"
                    type="number"
                    step="0.01"
                    value={data.pension || 0}
                    onChange={(e) => setData({ ...data, pension: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social_security">PRSI ({currencySymbol})</Label>
                  <Input
                    id="social_security"
                    type="number"
                    step="0.01"
                    value={data.social_security || 0}
                    onChange={(e) => setData({ ...data, social_security: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="other_deductions">Other Deductions ({currencySymbol})</Label>
                  <Input
                    id="other_deductions"
                    type="number"
                    step="0.01"
                    value={data.other_deductions || 0}
                    onChange={(e) => setData({ ...data, other_deductions: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              {data.additional_data?.validation_warnings && (
                <Alert variant="destructive" className="mt-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Warnings</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <p>{data.additional_data.validation_warnings}</p>
                    <p className="text-sm">
                      Please review the amounts above and correct any discrepancies. The net pay should equal gross pay minus all deductions (tax, PRSI, pension, and other deductions).
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {data.additional_data && Object.keys(data.additional_data).filter(key => key !== 'validation_warnings').length > 0 && (
                <div className="pt-6 border-t mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Additional Information</h3>
                    {!isEditingAdditional ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingAdditional(true)}
                        className="h-8 px-2"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveAdditionalData}
                          className="h-8 px-2"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelAdditionalEdit}
                          className="h-8 px-2"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {!isEditingAdditional ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(data.additional_data)
                        .filter(([key]) => key !== 'validation_warnings')
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(editedAdditionalData)
                        .filter(([key]) => key !== 'validation_warnings')
                        .map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={`additional_${key}`} className="text-sm capitalize">
                              {key.replace(/_/g, ' ')}
                            </Label>
                            <Input
                              id={`additional_${key}`}
                              value={String(value)}
                              onChange={(e) => handleAdditionalDataEdit(key, e.target.value)}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleConfirm} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm & Save
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPayslip;
