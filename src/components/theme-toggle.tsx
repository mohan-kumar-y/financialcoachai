import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={className}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-center"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </motion.span>
    </Button>
  );
}
