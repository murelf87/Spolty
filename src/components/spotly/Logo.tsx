import { useId } from "react";

/** Pin de ubicación con onda de voz (la "o" de Spotly). */
export function SpotPin({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 120" aria-hidden="true" style={{ width: `${size / 16}rem`, height: `${(size * 1.2) / 16}rem`, flex: "none" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--live)" />
        </linearGradient>
      </defs>
      <path d="M50 4C25 4 6 23 6 47c0 30 36 62 41 67a4 4 0 0 0 6 0c5-5 41-37 41-67C94 23 75 4 50 4Z" fill={`url(#${id})`} />
      <circle cx="50" cy="47" r="29" fill="var(--background)" />
      {([[33, 10], [41, 18], [50, 26], [59, 18], [67, 10]] as const).map(([x, h]) => (
        <rect key={x} x={x - 3} y={47 - h / 2 - 3} width="6" height={h + 6} rx="3" fill={`url(#${id})`} />
      ))}
    </svg>
  );
}

export function Logo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  if (compact) return <SpotPin size={30} />;
  return (
    <span className={`inline-flex items-end font-extrabold leading-none tracking-tight text-foreground ${className}`} style={{ fontSize: "1.875rem" }} aria-label="Spotly">
      <span>Sp</span>
      <span className="-mx-[1px] translate-y-[0.5rem]"><SpotPin size={28} /></span>
      <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">tly</span>
    </span>
  );
}
