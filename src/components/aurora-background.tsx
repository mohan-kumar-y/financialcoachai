export function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div className={"pointer-events-none absolute inset-0 overflow-hidden " + className} aria-hidden>
      <div
        className="aurora-blob h-[42rem] w-[42rem] -left-40 -top-48"
        style={{ background: "radial-gradient(circle at center, #22c55e55, transparent 70%)" }}
      />
      <div
        className="aurora-blob h-[36rem] w-[36rem] right-[-12rem] top-[-6rem]"
        style={{ background: "radial-gradient(circle at center, #0f8b8d66, transparent 70%)", animationDelay: "-6s" }}
      />
      <div
        className="aurora-blob h-[34rem] w-[34rem] left-1/3 bottom-[-12rem]"
        style={{ background: "radial-gradient(circle at center, #6366f155, transparent 70%)", animationDelay: "-11s" }}
      />
    </div>
  );
}
