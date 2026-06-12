import { Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-30"
          : "sticky top-0 z-30 border-b border-border/60 glass"
      }
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to="/"
          className={
            "flex items-center gap-2 font-display text-lg font-bold " +
            (transparent ? "text-primary-foreground" : "text-foreground")
          }
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
            <TrendingUp className="h-4 w-4" />
          </span>
          WealthOS
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            to="/blueprints"
            className={
              "text-sm font-medium transition-opacity hover:opacity-80 " +
              (transparent ? "text-primary-foreground/90" : "text-muted-foreground")
            }
          >
            Blueprints
          </Link>
          <Link
            to="/dashboard"
            className={
              "text-sm font-medium transition-opacity hover:opacity-80 " +
              (transparent ? "text-primary-foreground/90" : "text-muted-foreground")
            }
          >
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle
            className={transparent ? "text-primary-foreground hover:bg-white/10" : ""}
          />
          <Button asChild variant={transparent ? "secondary" : "default"} size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
