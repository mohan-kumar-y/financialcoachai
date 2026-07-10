import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MessagesSquare,
  Telescope,
  Activity,
  Siren,
  TrendingDown,
  Newspaper,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MODULES = [
  { to: "/research", label: "AI Research", desc: "Ask Atlas anything", icon: MessagesSquare, color: "#6366f1" },
  { to: "/discover", label: "Discover", desc: "Curated stock ideas", icon: Telescope, color: "#0f8b8d" },
  { to: "/health", label: "Health", desc: "Portfolio quality", icon: Activity, color: "#22c55e" },
  { to: "/alerts", label: "Red Alerts", desc: "Holding red flags", icon: Siren, color: "#ef4444" },
  { to: "/signals", label: "Sell Signals", desc: "When to trim", icon: TrendingDown, color: "#f59e0b" },
  { to: "/brief", label: "Daily Brief", desc: "Your market rundown", icon: Newspaper, color: "#0ea5e9" },
  { to: "/funds", label: "Fund Analyzer", desc: "Overlap & drift", icon: Layers, color: "#8b5cf6" },
] as const;

export function WealthModules() {
  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-bold">Your AI Wealth OS</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m, i) => (
          <motion.div key={m.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={m.to}>
              <Card className="group h-full shadow-soft transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-110" style={{ background: m.color + "22", color: m.color }}>
                    <m.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
