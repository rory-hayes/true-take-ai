import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check } from "lucide-react";

interface PlanConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  planName: string;
  price: string;
  period: string;
  features: string[];
  isLoading: boolean;
}

export function PlanConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  planName,
  price,
  period,
  features,
  isLoading,
}: PlanConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Your Subscription</DialogTitle>
          <DialogDescription>
            Please review your plan selection before proceeding to payment
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{planName}</h3>
              <p className="text-sm text-muted-foreground">
                Billed {period === "/month" ? "monthly" : period === "/year" ? "annually" : "once"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{price}</p>
              <p className="text-xs text-muted-foreground">{period}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Included Features:</h4>
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total:</span>
              <span className="text-xl font-bold">{price}{period !== " one-time" && period}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            aria-label="Cancel subscription"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            aria-label="Confirm and proceed to payment"
          >
            {isLoading ? "Processing..." : "Confirm & Proceed to Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
