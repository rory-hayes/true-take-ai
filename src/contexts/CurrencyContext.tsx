import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => Promise<void>;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("EUR");

  const refreshCurrency = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    refreshCurrency();

    // Listen for auth state changes to refresh currency
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        refreshCurrency();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCurrency]);

  const setCurrency = useCallback(async (newCurrency: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ currency: newCurrency })
        .eq("id", user.id);

      if (error) throw error;
      
      setCurrencyState(newCurrency);
    } catch (error) {
      console.error("Error updating currency:", error);
    }
  }, []);

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
