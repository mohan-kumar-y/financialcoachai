import { motion } from "framer-motion";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "var(--primary)",
  trackColor = "color-mix(in oklab, var(--muted-foreground) 18%, transparent)",
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-xl font-bold">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel && <span className="text-[10px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
