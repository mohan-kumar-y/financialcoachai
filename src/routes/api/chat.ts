/**
 * Thin transport layer for the research chat (Phase 1, LLD §14).
 *
 * This route owns NO reasoning. It only:
 *   1. resolves the caller,
 *   2. runs investment-brain.ts (which may only reach engines via the Gateway),
 *   3. runs decision-validator.ts,
 *   4. streams explanation-engine.ts prose,
 *   5. writes the audit trail.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeFundamentals,
  normalizePeers,
  normalizeNews,
  normalizeAnalyst,
  fmtCr,
  fmtNum,
  fmtPrice,
} from "@/lib/market-data";
import { run as runBrain } from "@/server/brain/investment-brain";
import { validate } from "@/server/validator/decision-validator";
import {
  streamExplanation,
  parseExplanation,
} from "@/server/explanation/explanation-engine";
import {
  recordBrainRun,
  recordDecision,
  recordExplanation,
} from "@/server/audit/audit-store";

type ChatRequestBody = { messages?: unknown };

/**
 * Prose guidance only — no verdict logic lives here. The action comes from the
 * validated decision; this just tells the Explanation Engine how to write.
 */
const RESEARCH_STYLE = `You are "Atlas", the research voice of WealthOS.

## LIVE DATA IS MANDATORY
You have a tool called \`lookupIndianStock\`. Whenever the user asks about a SPECIFIC listed Indian company or stock:
1. You MUST call \`lookupIndianStock\` FIRST.
2. Every number (price, market cap, P/E, P/B, ROE, 52-week range, dividend yield, news) must come ONLY from the tool result.
3. NEVER answer market-data questions from memory and NEVER invent or estimate a live figure.
4. If the tool returns \`available: false\`, reply with the line "**Market data currently unavailable for <name>.**" and give no prices, valuation or verdict.

For broad questions (sectors, fund categories, concepts) no tool call is needed, but never fabricate a quote.

## STYLE
Sharp, honest equity-research tone. Use ₹ and Indian market context (NSE/BSE, Nifty, SEBI, SIP, ELSS). Always give both bull and bear. After live metrics, note the data source and freshness returned by the tool. If a validated WealthOS decision is supplied, present it under the contract headings and never override it; if none is supplied, answer the question directly and give no portfolio action.`;


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

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return (last.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

async function resolveCaller(request: Request) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  const auth = request.headers.get("authorization");
  if (!url || !anon || !auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const supabase = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        if (!process.env.LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const uiMessages = messages as UIMessage[];
        const caller = await resolveCaller(request);

        // 1. Investment Brain -> 2. Decision Validator (skipped for anonymous
        //    callers: no portfolio context means no decision to validate).
        let decision = null as Awaited<ReturnType<typeof validate>>["decision"] | null;
        let evidence: Awaited<ReturnType<typeof runBrain>>["evidence"] = [];
        let decisionId: string | null = null;

        if (caller) {
          try {
            const correlationId = crypto.randomUUID();
            const brain = await runBrain(
              {
                correlationId,
                userRequest: lastUserText(uiMessages),
                triggerType: "MANUAL",
                userId: caller.userId,
              },
              { supabase: caller.supabase, userId: caller.userId },
            );
            evidence = brain.evidence;
            const outcome = await validate(brain.draft, {
              supabase: caller.supabase,
              userId: caller.userId,
              evidence: brain.evidence,
            });
            decision = outcome.decision;
            await recordBrainRun(brain, {
              userId: caller.userId,
              requestText: lastUserText(uiMessages) || null,
              triggerType: "MANUAL",
            });
            decisionId = await recordDecision(outcome.decision, {
              failures: outcome.failures,
              notes: outcome.notes,
            });
          } catch (err) {
            console.error("[chat] brain pipeline failed:", err);
            decision = null;
          }
        }

        // 3. Explanation Engine — prose only, never a verdict of its own.
        const result = await streamExplanation({
          decision,
          evidence,
          messages: uiMessages,
          tools: { lookupIndianStock },
          extraSystem: RESEARCH_STYLE,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            if (!decision || !decisionId) return;
            const text = (responseMessage?.parts ?? [])
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n");
            if (!text) return;
            await recordExplanation(decisionId, parseExplanation(text, decision), decision.action);
          },
        });
      },
    },
  },
});

