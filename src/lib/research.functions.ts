import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, WEALTH_MODEL } from "@/lib/ai-gateway.server";
import {
  normalizeFundamentals,
  normalizePeers,
  normalizeNews,
  normalizeAnalyst,
  fmtCr,
  fmtNum,
  fmtPrice,
  type StockFundamentals,
  type StockResearchData,
  type DataMeta,
} from "@/lib/market-data";

const researchInput = z.object({ query: z.string().min(1).max(120) });

// AI generates ONLY the qualitative narrative + verdict. All hard numbers
// (CMP, market cap, PE, PB, ROE, debt…) come from the live data provider.
// Schema kept flat/constraint-free for reliable structured output.
const analysisSchema = z.object({
  recommendation: z.enum(["BUY", "HOLD", "AVOID"]),
  convictionScore: z.number(),
  confidence: z.enum(["High", "Medium", "Low"]),
  snapshot: z.string(),
  valuationSummary: z.string(),
  bullCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  risks: z.array(z.string()),
  growthDrivers: z.array(z.string()),
  portfolioFit: z.string(),
  investmentHorizon: z.string(),
  verdict: z.string(),
});
export type ResearchAnalysis = z.infer<typeof analysisSchema>;

export interface ResearchReport {
  dataAvailable: boolean;
  fundamentals: StockFundamentals;
  meta: DataMeta;
  peers: StockResearchData["peers"];
  news: StockResearchData["news"];
  analysis: ResearchAnalysis | null;
}

export const deepResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => researchInput.parse(input))
  .handler(async ({ data }): Promise<ResearchReport> => {
    // 1. Fetch live market data FIRST.
    const { getCached } = await import("@/lib/market-data.server");
    const cacheKey = `stock:${data.query.trim().toLowerCase()}`;
    const res = await getCached<Record<string, unknown>>(
      cacheKey,
      "/stock",
      `/stock?name=${encodeURIComponent(data.query.trim())}`,
      30,
    );
    const meta: DataMeta = { source: res.source, fetchedAt: res.fetchedAt, status: res.status };
    const fundamentals = normalizeFundamentals(res.payload);
    const peers = normalizePeers(res.payload);
    const news = normalizeNews(res.payload);
    const analystFromApi = normalizeAnalyst(res.payload);

    // 2. If no live data, do NOT fabricate a recommendation.
    if (res.status === "unavailable" || !fundamentals.found || fundamentals.cmp === null) {
      return { dataAvailable: false, fundamentals, meta, peers, news, analysis: null };
    }

    // 3. Feed the REAL numbers to the model for qualitative analysis + verdict.
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const f = fundamentals;
    const facts = [
      `Company: ${f.name} (${f.symbol})`,
      `Sector/Industry: ${f.sector ?? "n/a"}`,
      `CMP: ${fmtPrice(f.cmp)}`,
      `Day change: ${fmtNum(f.changePct, "%")}`,
      `52w high/low: ${fmtPrice(f.yearHigh)} / ${fmtPrice(f.yearLow)}`,
      `Market Cap: ${fmtCr(f.marketCap)}`,
      `P/E: ${fmtNum(f.pe)}`,
      `P/B: ${fmtNum(f.pb)}`,
      `ROE: ${fmtNum(f.roe, "%")}`,
      `ROCE: ${fmtNum(f.roce, "%")}`,
      `Debt/Equity: ${fmtNum(f.debtToEquity)}`,
      `Net profit margin: ${fmtNum(f.netProfitMargin, "%")}`,
      `Dividend yield: ${fmtNum(f.dividendYield, "%")}`,
    ].join("\n");
    const peerText = peers.length
      ? peers.map((p) => `- ${p.name}: PE ${fmtNum(p.pe)}, ROE ${fmtNum(p.roe, "%")}`).join("\n")
      : "n/a";
    const newsText = news.length ? news.slice(0, 6).map((n) => `- ${n.title}`).join("\n") : "n/a";
    const analystText = analystFromApi
      ? `Analyst buy/hold/sell: ${analystFromApi.buy ?? "?"}/${analystFromApi.hold ?? "?"}/${analystFromApi.sell ?? "?"}; target ${fmtPrice(analystFromApi.targetPrice)}`
      : "n/a";

    const prompt = `You are an equity analyst. Analyse the stock below using ONLY the live data provided (do not invent numbers or prices). Base your recommendation on these fundamentals, valuation and recent news — not on generic prior knowledge.

LIVE FUNDAMENTALS (source: ${meta.source}):
${facts}

PEERS:
${peerText}

RECENT NEWS HEADLINES:
${newsText}

ANALYST CONSENSUS: ${analystText}

Return:
- snapshot: 2 sentences on what the company does and its current setup.
- valuationSummary: 2 sentences interpreting the PE/PB/ROE/debt vs peers (say "not disclosed" for any missing metric, never guess).
- bullCase, bearCase, risks, growthDrivers: 3-5 concise points each grounded in the data above.
- portfolioFit + investmentHorizon: 1-2 sentences each.
- convictionScore: integer 0-100. confidence: High/Medium/Low based on how complete the data is.
- verdict: 2-3 sentences ending with the BUY/HOLD/AVOID call.
If key metrics are missing, lower the confidence and say so.`;

    try {
      const { output } = await generateText({
        model: gateway(WEALTH_MODEL),
        output: Output.object({ schema: analysisSchema }),
        prompt,
      });
      const analysis: ResearchAnalysis = {
        ...output,
        convictionScore: Math.max(0, Math.min(100, Math.round(output.convictionScore))),
      };
      return { dataAvailable: true, fundamentals, meta, peers, news, analysis };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const match = error.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = analysisSchema.parse(JSON.parse(match[0]));
          return { dataAvailable: true, fundamentals, meta, peers, news, analysis: parsed };
        }
      }
      throw error;
    }
  });
