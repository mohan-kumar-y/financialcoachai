import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  /** Map the raw number to a display string (e.g. currency). */
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  duration = 1.2,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
