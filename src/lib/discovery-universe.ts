// Client-safe curated NSE stock universe used by the Stock Discovery Center.
// The provider (indianapi.in) accepts either the NSE ticker or the company
// name in /stock?name=. We pass short tickers where they work and fall back
// to full names for tickers with unusual characters. Anything the provider
// cannot resolve is silently skipped by the screen builder — never mocked.
//
// Starting set = the 15 tickers previously hardcoded in src/lib/market.ts
// (kept intact because they were chosen to be reasonable) plus ~50 more
// large/mid/small caps across sectors so the discovery screens have real
// breadth. Keep <=80 to stay within a reasonable batch budget.

export const DISCOVERY_UNIVERSE: readonly string[] = [
  // Existing seed (from market.ts sample data) — do not remove.
  "TITAN", "HDFCBANK", "ASIANPAINT", "ITC", "POWERGRID", "COALINDIA",
  "TATAMOTORS", "PERSISTENT", "DIXON", "CAMS", "POLYCAB", "IEX",
  "KPITTECH", "NESTLEIND", "IRCTC",
  // Broad additions across sectors and market caps.
  "RELIANCE", "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM",
  "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "INDUSINDBK",
  "BAJFINANCE", "BAJAJFINSV", "SBILIFE", "HDFCLIFE",
  "LT", "ULTRACEMCO", "GRASIM", "SHREECEM", "AMBUJACEM",
  "HINDUNILVR", "BRITANNIA", "DABUR", "MARICO", "TATACONSUM", "GODREJCP",
  "MARUTI", "M&M", "EICHERMOT", "HEROMOTOCO", "BAJAJ-AUTO",
  "BHARTIARTL", "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL",
  "NTPC", "ONGC", "GAIL", "BPCL", "IOC",
  "ADANIENT", "ADANIPORTS", "ADANIGREEN",
  "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP", "MAXHEALTH",
  "HAVELLS", "BOSCHLTD", "PIDILITIND", "DMART", "TRENT",
  "ZOMATO", "PAYTM", "NAUKRI", "POLICYBZR",
  "LTIM", "COFORGE", "MPHASIS",
];
