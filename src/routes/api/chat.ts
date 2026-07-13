import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, WEALTH_MODEL } from "@/lib/ai-gateway.server";
import {
  normalizeFundamentals,
  normalizePeers,
  normalizeNews,
  normalizeAnalyst,
  fmtCr,
  fmtNum,
  fmtPrice,
} from "@/lib/market-data";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are "Atlas", the AI Research Assistant inside WealthOS — a premium personal wealth platform for Indian investors (currency ₹ INR).

You help users research stocks, ETFs, mutual funds, sectors and portfolio decisions. You write like a sharp, honest equity research analyst: structured, specific, and balanced.

## LIVE DATA IS MANDATORY
You have a tool called \`lookupIndianStock\`. Whenever a user asks about a SPECIFIC listed Indian company or stock (e.g. "Analyze Vedanta", "Is HDFC Bank a buy?", "What's TCS worth?"):
1. You MUST call \`lookupIndianStock\` FIRST to fetch the latest price, fundamentals and news.
2. Base EVERY number (price, market cap, P/E, P/B, ROE, 52-week range, dividend yield, news) ONLY on the tool result.
3. NEVER answer market-data questions from memory. NEVER invent or estimate a live price, market cap or valuation.
4. If the tool returns \`available: false\`, reply exactly with a line "**Market data currently unavailable for <name>.**" and DO NOT provide any prices, valuation or a BUY/HOLD/AVOID verdict. Offer to retry or check the ticker instead.

For broad questions (sectors, "should I add international equity", fund categories, general concepts) where no single ticker applies, you may answer from analysis without the tool — but still never fabricate a specific live quote.

## FORMAT
Use clean markdown with short sections. For a specific stock, structure the answer with these headings when data is available:
- **Snapshot** (what it is, sector, size)
- **Current Price & Key Metrics** (quote the live numbers from the tool: CMP, day change, market cap, P/E, P/B, ROE, dividend yield, 52W range)
- **Valuation**
- **Recent News** (from the tool)
- **Bull Case**
- **Bear Case / Risks**
- **Growth Drivers**
- **Portfolio Fit & Horizon**
- **Verdict** — a clear **BUY / HOLD / AVOID** call, a **conviction score (0–100)** and a one-line rationale.

## RULES
- Always give both bull and bear.
- Use ₹ and Indian market context (NSE/BSE, Nifty, SEBI, SIP, ELSS).
- After the live metrics, always note the data source and freshness returned by the tool.
- ALWAYS include this disclaimer once at the end of investment-specific answers, in italics: *Educational research only — not investment advice. Verify with live data before acting.*`;

const lookupIndianStock = tool({
  description:
    "Fetch the latest live market data for a specific Indian listed company/stock from the market-data provider: current price, day change, market cap, P/E, P/B, ROE, ROCE, debt/equity, dividend yield, 52-week high/low, peers and recent news. Call this before answering any question about a specific stock. Returns available:false when the provider cannot be reached.",
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .max(80)
      .describe("Company or stock name / ticker, e.g. 'Vedanta', 'HDFC Bank', 'TCS'"),
  }),
  execute: async ({ name }) => {
    const { getCached } = await import("@/lib/market-data.server");
    const key = `stock:${name.trim().toLowerCase()}`;
    const res = await getCached<Record<string, unknown>>(
      key,
      "/stock",
      `/stock?name=${encodeURIComponent(name.trim())}`,
      30,
    );

    if (res.status === "unavailable" || !res.payload) {
      return {
        available: false,
        query: name,
        source: res.source,
        message: "Market data provider unavailable — no live values could be retrieved.",
      };
    }

    const f = normalizeFundamentals(res.payload);
    if (!f.found || f.cmp === null) {
      return {
        available: false,
        query: name,
        source: res.source,
        message: "No live quote found for this name — check the company name or ticker.",
      };
    }

    const peers = normalizePeers(res.payload).map((p) => ({
      name: p.name,
      pe: fmtNum(p.pe),
      roe: fmtNum(p.roe, "%"),
    }));
    const news = normalizeNews(res.payload)
      .slice(0, 6)
      .map((n) => n.title);
    const analyst = normalizeAnalyst(res.payload);

    return {
      available: true,
      source: res.source,
      status: res.status, // "ok" (live) or "stale" (last cached)
      fetchedAt: res.fetchedAt,
      company: { name: f.name, symbol: f.symbol, sector: f.sector },
      metrics: {
        currentPrice: fmtPrice(f.cmp),
        dayChangePct: fmtNum(f.changePct, "%"),
        marketCap: fmtCr(f.marketCap),
        pe: fmtNum(f.pe),
        pb: fmtNum(f.pb),
        roe: fmtNum(f.roe, "%"),
        roce: fmtNum(f.roce, "%"),
        debtToEquity: fmtNum(f.debtToEquity),
        dividendYield: fmtNum(f.dividendYield, "%"),
        weekHigh52: fmtPrice(f.yearHigh),
        weekLow52: fmtPrice(f.yearLow),
        netProfitMargin: fmtNum(f.netProfitMargin, "%"),
      },
      peers,
      recentNews: news,
      analyst: analyst
        ? { buy: analyst.buy, hold: analyst.hold, sell: analyst.sell, targetPrice: fmtPrice(analyst.targetPrice) }
        : null,
    };
  },
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway(WEALTH_MODEL),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: { lookupIndianStock },
          // Allow the model to call the tool, read the result, then compose the answer.
          stopWhen: stepCountIs(4),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
