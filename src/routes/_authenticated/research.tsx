import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/wealth/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/progress-ring";
import { deepResearch, type ResearchReport } from "@/lib/research.functions";
import {
  MessagesSquare,
  Send,
  Bot,
  User,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Rocket,
  Swords,
  Target as TargetIcon,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

const SUGGESTIONS = [
  "Is HDFC Bank a good long-term hold?",
  "Compare Nifty 50 index fund vs an active flexi-cap fund",
  "Should I add international equity to my portfolio?",
  "Analyse the Indian IT sector outlook",
];

function ResearchPage() {
  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={MessagesSquare}
          title="AI Research Assistant"
          subtitle="Ask Atlas about stocks, ETFs, mutual funds, sectors and portfolio decisions — or run a full deep-research report."
        />
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessagesSquare className="h-4 w-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="deep" className="gap-1.5">
              <FlaskConical className="h-4 w-4" /> Deep Research
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="mt-4">
            <ChatPanel />
          </TabsContent>
          <TabsContent value="deep" className="mt-4">
            <DeepResearchPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ChatPanel() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: () => toast.error("Atlas could not respond. Please try again."),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <Card className="flex h-[calc(100vh-16rem)] min-h-[460px] flex-col shadow-soft">
      <CardContent ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elevated">
              <Bot className="h-7 w-7" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Meet Atlas, your research analyst</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask anything about investing. Try one of these:</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isUser = m.role === "user";
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={isUser ? "flex justify-end gap-3" : "flex gap-3"}
            >
              {!isUser && (
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={
                  isUser
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[85%] text-sm text-foreground"
                }
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-display prose-headings:text-base prose-p:my-1.5 prose-ul:my-1.5 prose-strong:text-foreground">
                    <ReactMarkdown>{text || "…"}</ReactMarkdown>
                  </div>
                )}
              </div>
              {isUser && (
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
              )}
            </motion.div>
          );
        })}

        {status === "submitted" && (
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 pt-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <div className="border-t border-border/60 p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a stock, fund, sector or portfolio decision…"
            disabled={busy}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Educational research only — not investment advice. Connect a live market-data provider for real-time accuracy.
        </p>
      </div>
    </Card>
  );
}

const RECO_STYLE: Record<string, { bg: string; fg: string }> = {
  BUY: { bg: "#22c55e22", fg: "#16a34a" },
  HOLD: { bg: "#f59e0b22", fg: "#d97706" },
  AVOID: { bg: "#ef444422", fg: "#dc2626" },
};

function DeepResearchPanel() {
  const [query, setQuery] = useState("");
  const runFn = useServerFn(deepResearch);
  const { mutate, data, isPending, isError } = useMutation({
    mutationFn: (q: string) => runFn({ data: { query: q } }),
    onError: () => toast.error("Could not generate the report. Please try again."),
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardContent className="p-4 sm:p-6">
          <label className="text-sm font-medium">What should Atlas research?</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Titan Company — is it a buy for a 5-year horizon?"
              rows={2}
              className="flex-1"
            />
            <Button
              className="sm:self-end"
              disabled={isPending || !query.trim()}
              onClick={() => mutate(query.trim())}
            >
              <FlaskConical className="h-4 w-4" />
              {isPending ? "Researching…" : "Run deep research"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isPending && (
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Building bull case, bear case, valuation, competitors and conviction score…
          </CardContent>
        </Card>
      )}

      {isError && !isPending && (
        <Card className="shadow-soft">
          <CardContent className="p-6 text-sm text-destructive">Something went wrong. Try a more specific query.</CardContent>
        </Card>
      )}

      {data && !isPending && <ReportView report={data} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ReportView({ report }: { report: ResearchReport }) {
  const f = report.fundamentals;

  if (!report.dataAvailable || !report.analysis) {
    return (
      <DataUnavailable
        meta={report.meta}
        title={`Live data unavailable for “${f.name || "this query"}”`}
        hint="Atlas will not issue a recommendation without live fundamentals. Check the company name / ticker or the market-data provider key, then try again. No fabricated numbers are shown."
      />
    );
  }

  const a = report.analysis;
  const reco = RECO_STYLE[a.recommendation] ?? RECO_STYLE.HOLD;
  const changePos = (f.changePct ?? 0) >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="overflow-hidden shadow-soft">
        <div className="bg-gradient-hero p-5 text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">{f.sector ?? "Equity"}</p>
              <h2 className="font-display text-2xl font-bold">{f.name}</h2>
              <p className="mt-1 text-sm opacity-90">
                {fmtPrice(f.cmp)}{" "}
                {f.changePct !== null && (
                  <span className={changePos ? "text-emerald-200" : "text-red-200"}>
                    {changePos ? "▲" : "▼"} {fmtNum(Math.abs(f.changePct), "%")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: reco.bg, color: "#fff" }}>
                  {a.recommendation}
                </span>
                <p className="mt-1 text-xs opacity-80">{a.confidence} confidence</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-1">
                <ProgressRing
                  value={a.convictionScore}
                  size={72}
                  stroke={7}
                  color="#fff"
                  trackColor="rgba(255,255,255,0.25)"
                  label={`${a.convictionScore}`}
                  sublabel="conviction"
                />
              </div>
            </div>
          </div>
        </div>
        <CardContent className="space-y-4 p-5">
          <DataStatus meta={report.meta} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="CMP" value={fmtPrice(f.cmp)} />
            <Metric label="Market Cap" value={fmtCr(f.marketCap)} />
            <Metric label="P/E" value={fmtNum(f.pe)} />
            <Metric label="P/B" value={fmtNum(f.pb)} />
            <Metric label="ROE" value={fmtNum(f.roe, "%")} />
            <Metric label="ROCE" value={fmtNum(f.roce, "%")} />
            <Metric label="Debt/Equity" value={fmtNum(f.debtToEquity)} />
            <Metric label="Net Margin" value={fmtNum(f.netProfitMargin, "%")} />
            <Metric label="Div Yield" value={fmtNum(f.dividendYield, "%")} />
            <Metric label="52W Range" value={`${fmtPrice(f.yearLow)}–${fmtPrice(f.yearHigh)}`} />
          </div>
          <p className="text-sm text-muted-foreground">{a.snapshot}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="Bull Case" icon={TrendingUp} color="#16a34a" items={a.bullCase} />
        <ListCard title="Bear Case" icon={TrendingDown} color="#dc2626" items={a.bearCase} />
        <ListCard title="Key Risks" icon={ShieldAlert} color="#d97706" items={a.risks} />
        <ListCard title="Growth Drivers" icon={Rocket} color="#6366f1" items={a.growthDrivers} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextCard title="Valuation Summary" icon={TargetIcon} text={a.valuationSummary} />
        <TextCard title="Portfolio Fit" icon={TargetIcon} text={a.portfolioFit} />
        <ChipsCard title="Peers" icon={Swords} items={report.peers.map((p) => `${p.name} · PE ${fmtNum(p.pe)}`)} />
        <TextCard title="Investment Horizon" icon={Clock} text={a.investmentHorizon} />
      </div>

      {report.news.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Recent News</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {report.news.slice(0, 6).map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {n.url ? (
                    <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {n.title}
                    </a>
                  ) : (
                    <span>{n.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft" style={{ borderColor: reco.fg + "55" }}>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: reco.fg }}>
            Verdict — {a.recommendation}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{a.verdict}</p>
          <p className="text-xs italic text-muted-foreground">
            Educational research only — not investment advice. Numbers sourced live from {report.meta.source}; verify before acting.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ListCard({
  title,
  icon: Icon,
  color,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: string[];
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm" style={{ color }}>
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TextCard({ title, icon: Icon, text }: { title: string; icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function ChipsCard({ title, icon: Icon, items }: { title: string; icon: React.ComponentType<{ className?: string }>; items: string[] }) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((c, i) => (
          <Badge key={i} variant="secondary">
            {c}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
