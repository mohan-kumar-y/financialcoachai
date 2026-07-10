import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider, WEALTH_MODEL } from "@/lib/ai-gateway.server";

const researchInput = z.object({
  query: z.string().min(1).max(160),
});

// Kept intentionally flat (no min/max/format bounds) for reliable structured output.
const reportSchema = z.object({
  asset: z.string(),
  assetType: z.string(),
  snapshot: z.string(),
  recommendation: z.enum(["BUY", "HOLD", "AVOID"]),
  convictionScore: z.number(),
  confidence: z.enum(["High", "Medium", "Low"]),
  bullCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  risks: z.array(z.string()),
  valuation: z.string(),
  growthDrivers: z.array(z.string()),
  competitors: z.array(z.string()),
  portfolioFit: z.string(),
  investmentHorizon: z.string(),
  verdict: z.string(),
});

export type ResearchReport = z.infer<typeof reportSchema>;

export const deepResearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => researchInput.parse(input))
  .handler(async ({ data }): Promise<ResearchReport> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `Produce a deep equity research report for: "${data.query}".
Context: Indian investor, currency ₹ INR, NSE/BSE unless clearly a global asset.
- bullCase, bearCase, risks, growthDrivers, competitors: 3-5 concise items each.
- convictionScore: integer 0-100.
- valuation: 1-2 sentences with an illustrative multiple/estimate.
- portfolioFit + investmentHorizon: 1-2 sentences each.
- verdict: 2-3 sentence summary ending with the call.
Numbers are illustrative estimates, not live quotes.`;

    try {
      const { output } = await generateText({
        model: gateway(WEALTH_MODEL),
        output: Output.object({ schema: reportSchema }),
        prompt,
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const match = error.text.match(/\{[\s\S]*\}/);
        if (match) return reportSchema.parse(JSON.parse(match[0]));
      }
      throw error;
    }
  });
