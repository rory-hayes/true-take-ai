import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("EUR");

  const refreshCurrency = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single();

      if (profile?.currency) {
        setCurrencyState(profile.currency);
      }
    } catch (error) {
      console.error("Error fetching currency:", error);
    }
  };

  useEffect(() => {
    refreshCurrency();
  }, []);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, refreshCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
