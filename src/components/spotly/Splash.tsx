import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Camera, Compass, MapPinned, Users } from "lucide-react";
import { Logo } from "./Logo";

const items = [[Compass, "Explora"], [MapPinned, "Mapa"], [Camera, "Fotos"], [Users, "Personas"], [CalendarCheck, "Eventos"]] as const;
const waves = [
  "M-60 640 C 40 520, 130 760, 220 620 S 380 520, 470 640",
  "M-60 700 C 50 600, 150 800, 250 690 S 390 600, 470 720",
  "M-60 120 C 60 220, 140 40, 240 150 S 370 220, 470 100",
  "M-60 780 C 70 700, 160 860, 260 760 S 400 700, 470 790",
  "M-60 60 C 80 140, 170 -10, 270 90 S 390 150, 470 50",
];

/** Pantalla de inicio animada. No se cierra hasta que `waitFor` sea true Y haya pasado `duration` ms.
 * Fallback de seguridad: cierra igualmente a duration+1500ms aunque waitFor no llegue. */
export function Splash({ onDone, duration = 3800, waitFor = true }: { onDone: () => void; duration?: number; waitFor?: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const leaveRef = useRef(false);
  const leave = useCallback(() => {
    if (leaveRef.current) return;
    leaveRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 450);
  }, [onDone]);

  // Timer principal
  useEffect(() => { const t = window.setTimeout(() => setTimerDone(true), duration); return () => window.clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Cierre normal: timer + auth listos
  useEffect(() => { if (timerDone && waitFor) leave(); }, [timerDone, waitFor, leave]);
  // Fallback de seguridad: cierra pase lo que pase tras duration+1500ms
  useEffect(() => { const t = window.setTimeout(leave, duration + 1500); return () => window.clearTimeout(t); }, [leave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al tocar: solo cierra si auth ya resolvió; si no, ignora el tap
  const handleTap = useCallback(() => { if (waitFor) leave(); }, [waitFor, leave]);

  return (
    <div role="button" tabIndex={0} aria-label="Spotly. Toca para continuar" onClick={handleTap} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTap(); }}
      className={"spot-splash fixed inset-0 z-50 mx-auto flex max-w-[520px] cursor-pointer flex-col items-center overflow-hidden " + (leaving ? "spot-splash-out" : "")}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sw-a" x1="0" x2="1"><stop offset="0" stopColor="var(--spot-blue)" /><stop offset=".5" stopColor="var(--spot-fuchsia)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient>
          <linearGradient id="sw-b" x1="1" x2="0"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--spot-fuchsia)" /></linearGradient>
          <filter id="sw-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {waves.map((d, i) => (
          <g key={i} className="spot-wave-sway" style={{ animationDelay: `${i * -1.4}s`, animationDuration: `${7 + i * 1.3}s` }}>
            <path d={d} fill="none" stroke={i % 2 ? "url(#sw-b)" : "url(#sw-a)"} strokeWidth={i < 2 ? 2.2 : 1.4} strokeLinecap="round" filter="url(#sw-glow)" opacity={0.85 - i * 0.1} className="spot-wave-flow" style={{ animationDuration: `${5 + i * 1.2}s` }} />
            <path d={d} fill="none" stroke={i % 2 ? "url(#sw-b)" : "url(#sw-a)"} strokeWidth=".7" opacity=".45" transform="translate(0 9)" />
            <path d={d} fill="none" stroke={i % 2 ? "url(#sw-b)" : "url(#sw-a)"} strokeWidth=".7" opacity=".3" transform="translate(0 -9)" />
          </g>
        ))}
        {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 97) % 400} cy={(i * 151) % 900} r={i % 4 === 0 ? 1.6 : 0.9} fill="var(--foreground)" className="spot-twinkle" style={{ animationDelay: `${(i % 7) * 0.45}s` }} />)}
      </svg>

      <div className="relative z-10 mt-[max(3.5rem,calc(env(safe-area-inset-top)+2rem))] flex flex-col items-center px-6 text-center">
        <div className="spot-pin-drop relative">
          {[0, 1, 2].map((i) => <span key={i} className="spot-ripple" style={{ animationDelay: `${0.9 + i * 0.7}s` }} />)}
          <BigPin />
        </div>
        <div className="spot-rise mt-4" style={{ animationDelay: ".55s" }}><Logo className="spot-logo-glow origin-center scale-[2.5]" /></div>
        <p className="spot-rise spot-shimmer mt-10 text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ animationDelay: "1.1s" }}>Less typing. More talking.</p>
        <p className="spot-rise mt-7 bg-gradient-to-r from-primary via-accent to-[var(--spot-fuchsia)] bg-clip-text text-[17px] font-semibold uppercase leading-snug tracking-wide text-transparent" style={{ animationDelay: "1.5s" }}>Tu ciudad. Tu voz.<br />En tiempo real.</p>
      </div>

      <div className="relative z-10 mt-auto grid w-full grid-cols-5 gap-1 px-4 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
        {items.map(([I, l], i) => (
          <div key={l} className="spot-pop flex flex-col items-center gap-2" style={{ animationDelay: `${1.9 + i * 0.13}s` }}>
            <span className="spot-float grid h-14 w-14 place-items-center rounded-full border-2 bg-background/60 backdrop-blur" style={{ borderColor: i % 2 ? "var(--spot-fuchsia)" : "var(--primary)", boxShadow: `0 0 14px ${i % 2 ? "var(--spot-fuchsia)" : "var(--primary)"}55`, animationDelay: `${i * 0.35}s` }}><I size={22} style={{ color: i % 2 ? "var(--spot-fuchsia)" : "var(--primary)" }} /></span>
            <span className="text-[11px] font-semibold">{l}</span>
          </div>
        ))}
      </div>
      <p className="spot-blink absolute inset-x-0 bottom-3 text-center text-[10px] text-muted-foreground">Toca para continuar</p>
    </div>
  );
}

/** Pin grande con barras de voz que laten. */
function BigPin() {
  return (
    <svg width="104" height="125" viewBox="0 0 100 120" aria-hidden="true" className="spot-pin-glow">
      <defs><linearGradient id="bp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset=".55" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--live)" /></linearGradient></defs>
      <path d="M50 4C25 4 6 23 6 47c0 30 36 62 41 67a4 4 0 0 0 6 0c5-5 41-37 41-67C94 23 75 4 50 4Z" fill="url(#bp)" />
      <circle cx="50" cy="47" r="29" fill="var(--background)" />
      {[[30, 14], [38, 26], [46, 38], [54, 30], [62, 20], [70, 12]].map(([x, h], i) => <rect key={i} x={x! - 2.5} y={47 - h! / 2} width="5" height={h} rx="2.5" fill="url(#bp)" className="spot-bar" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${x}px 47px` }} />)}
    </svg>
  );
}
