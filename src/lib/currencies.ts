/**
 * Common ISO 4217 currencies, ordered roughly by user prevalence (major
 * reserves first, then regional-majors, then smaller). Used by the native-
 * currency typeahead in the add-asset drawer.
 *
 * Coverage rationale: covers every currency Frankfurter supports for FX
 * conversion, plus a handful of common non-Frankfurter currencies (TWD, AED,
 * NGN, etc.) the user might still want to track natively — those just won't
 * roll up into the base-currency total.
 */

export type CurrencyOption = { code: string; name: string; symbol?: string };

export const CURRENCIES: CurrencyOption[] = [
  // Major reserves
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  // APAC
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "KRW", name: "Korean Won", symbol: "₩" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  // Americas
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "PEN", name: "Peruvian Sol" },
  // Europe (non-euro)
  { code: "NOK", name: "Norwegian Krone" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "DKK", name: "Danish Krone" },
  { code: "ISK", name: "Icelandic Króna" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  // Middle East / Africa
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "KES", name: "Kenyan Shilling" },
];

/** Lookup by ISO code (case-insensitive). */
export function getCurrency(code: string): CurrencyOption | null {
  const upper = code.toUpperCase();
  return CURRENCIES.find((c) => c.code === upper) ?? null;
}
