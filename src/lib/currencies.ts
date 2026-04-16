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

/**
 * `country` is an ISO 3166-1 alpha-2 code used to look up the country flag
 * via FlagCDN. EUR uses "eu" (FlagCDN serves the European Union flag for
 * that code). Non-country currencies (e.g. crypto stables) could be added
 * later with `country: null` and the UI falls back to initials.
 */
export type CurrencyOption = {
  code: string;
  name: string;
  symbol?: string;
  country: string;
};

export const CURRENCIES: CurrencyOption[] = [
  // Major reserves
  { code: "USD", name: "US Dollar", symbol: "$", country: "us" },
  { code: "EUR", name: "Euro", symbol: "€", country: "eu" },
  { code: "GBP", name: "British Pound", symbol: "£", country: "gb" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", country: "jp" },
  { code: "CHF", name: "Swiss Franc", country: "ch" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", country: "cn" },
  // APAC
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", country: "hk" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", country: "sg" },
  { code: "KRW", name: "Korean Won", symbol: "₩", country: "kr" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", country: "tw" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", country: "au" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", country: "nz" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", country: "in" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", country: "id" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", country: "my" },
  { code: "THB", name: "Thai Baht", symbol: "฿", country: "th" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", country: "ph" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", country: "vn" },
  // Americas
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", country: "ca" },
  { code: "MXN", name: "Mexican Peso", country: "mx" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", country: "br" },
  { code: "ARS", name: "Argentine Peso", country: "ar" },
  { code: "CLP", name: "Chilean Peso", country: "cl" },
  { code: "COP", name: "Colombian Peso", country: "co" },
  { code: "PEN", name: "Peruvian Sol", country: "pe" },
  // Europe (non-euro)
  { code: "NOK", name: "Norwegian Krone", country: "no" },
  { code: "SEK", name: "Swedish Krona", country: "se" },
  { code: "DKK", name: "Danish Krone", country: "dk" },
  { code: "ISK", name: "Icelandic Króna", country: "is" },
  { code: "PLN", name: "Polish Złoty", country: "pl" },
  { code: "CZK", name: "Czech Koruna", country: "cz" },
  { code: "HUF", name: "Hungarian Forint", country: "hu" },
  { code: "RON", name: "Romanian Leu", country: "ro" },
  { code: "BGN", name: "Bulgarian Lev", country: "bg" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", country: "tr" },
  // Middle East / Africa
  { code: "AED", name: "UAE Dirham", country: "ae" },
  { code: "SAR", name: "Saudi Riyal", country: "sa" },
  { code: "QAR", name: "Qatari Riyal", country: "qa" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", country: "il" },
  { code: "EGP", name: "Egyptian Pound", country: "eg" },
  { code: "ZAR", name: "South African Rand", symbol: "R", country: "za" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", country: "ng" },
  { code: "KES", name: "Kenyan Shilling", country: "ke" },
];

/** Lookup by ISO code (case-insensitive). */
export function getCurrency(code: string): CurrencyOption | null {
  const upper = code.toUpperCase();
  return CURRENCIES.find((c) => c.code === upper) ?? null;
}
