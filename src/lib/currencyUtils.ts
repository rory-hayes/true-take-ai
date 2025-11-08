const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  AUD: "A$",
  CAD: "C$",
};

const CURRENCY_FORMATS: Record<string, { locale: string; position: "before" | "after" }> = {
  EUR: { locale: "de-DE", position: "before" },
  USD: { locale: "en-US", position: "before" },
  GBP: { locale: "en-GB", position: "before" },
  CHF: { locale: "de-CH", position: "before" },
  AUD: { locale: "en-AU", position: "before" },
  CAD: { locale: "en-CA", position: "before" },
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function formatCurrency(amount: number | null | undefined, currency: string = "EUR"): string {
  if (amount === null || amount === undefined) return "-";
  
  const format = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS.EUR;
  const symbol = getCurrencySymbol(currency);
  
  // Format the number with proper locale
  const formattedNumber = new Intl.NumberFormat(format.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // Position symbol based on currency convention
  if (format.position === "before") {
    return `${symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${symbol}`;
  }
}
