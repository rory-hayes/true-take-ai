import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PensionInsightsCardProps {
  age: number | null;
  grossAnnualIncome: number;
  currentPensionContribAnnual: number;
  onClick?: () => void;
}

function getMaxPensionPercent(age: number): number {
  if (age < 30) return 0.15;
  if (age < 40) return 0.20;
  if (age < 50) return 0.25;
  if (age < 55) return 0.30;
  if (age < 60) return 0.35;
  return 0.40;
}

export function PensionInsightsCard({ 
  age, 
  grossAnnualIncome, 
  currentPensionContribAnnual,
  onClick 
}: PensionInsightsCardProps) {
  const { currency } = useCurrency();
  
  // Calculate pension insights
  const eligibleIncome = Math.min(grossAnnualIncome, 115000);
  const maxPercent = age ? getMaxPensionPercent(age) : 0.20; // Default to 20% if no age
  const maxTaxEfficientContribution = eligibleIncome * maxPercent;
  const recommendedMonthly = maxTaxEfficientContribution / 12;
  const currentMonthly = currentPensionContribAnnual / 12;
  const progressPercent = maxTaxEfficientContribution > 0 
    ? Math.min((currentPensionContribAnnual / maxTaxEfficientContribution) * 100, 100)
    : 0;

  const tooltipText = age 
    ? `You're currently contributing ${progressPercent.toFixed(1)}% of your maximum tax-relievable pension allowance (${formatCurrency(maxTaxEfficientContribution, currency)}/year). ${
        progressPercent < 100 
          ? `Increasing your contributions by about ${formatCurrency((maxTaxEfficientContribution - currentPensionContribAnnual) / 12, currency)}/month would help you fully maximise your tax benefits under current Revenue rules.`
          : "You're maximising your tax-efficient pension contributions!"
      }`
    : "Add your date of birth in settings to calculate your optimal pension contribution based on Revenue limits.";

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Pension Contribution Insights
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">
                {formatCurrency(recommendedMonthly, currency)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended Monthly Contribution
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on your {age ? `age (${age}), ` : ""}income, and Revenue limits for tax relief
            </p>
          </div>

          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Current: {formatCurrency(currentMonthly, currency)} ({progressPercent.toFixed(1)}%)</span>
              <span>Max: {maxPercent * 100}%</span>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Contribution:</span>
              <span className="font-medium">{formatCurrency(currentMonthly, currency)} ({progressPercent.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax-Relief Limit:</span>
              <span className="font-medium">{formatCurrency(maxTaxEfficientContribution / 12, currency)} (Max {maxPercent * 100}%)</span>
            </div>
          </div>

          <button 
            className="text-xs text-primary hover:underline w-full text-center"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            View Pension Breakdown →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
