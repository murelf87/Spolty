import { useEffect, useState, type ReactNode } from "react";
import { usePos } from "@/lib/preview-context";
import { Ghost, Loader2, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Hoja inferior reutilizable (modales, selectores, confirmaciones). */
export function BottomSheet({ title, onClose, children, z = 60, footer }: { title?: string | undefined; onClose: () => void; children: ReactNode; z?: number; footer?: ReactNode }) {
  const pos = usePos();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className={pos + " inset-0 flex items-end bg-background/75 backdrop-blur-sm"} style={{ zIndex: z }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex w-full max-w-[520px] flex-col rounded-t-3xl border-t border-border bg-card" style={{ maxHeight: "calc(100vh - env(safe-area-inset-top) - 2rem)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
        {title && <div className="flex items-center justify-between px-5 pb-1 pt-3"><h3 className="text-lg font-bold">{title}</h3><Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}><X size={18} /></Button></div>}
        <div className="overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        {!footer && <div className="h-[max(1rem,env(safe-area-inset-bottom))] shrink-0" />}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={"relative h-6 w-11 shrink-0 rounded-full transition " + (on ? "bg-spot-gradient" : "bg-muted")}>
      <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all " + (on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} aria-pressed={active} onClick={onClick} className={"min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 " + (active ? "spot-active-pill border-transparent text-foreground" : "border-border bg-card text-foreground/80")}>
      {children}
    </button>
  );
}

/** Tarjeta de estado: vacío, error, sin permisos, offline, campaña agotada… */
export function StateCard({ icon: I, title, text, action, onAction, secondary, onSecondary, tone = "primary", loading }: { icon: LucideIcon; title: string; text: string; action?: string | undefined; onAction?: (() => void) | undefined; secondary?: string | undefined; onSecondary?: (() => void) | undefined; tone?: "primary" | "live" | "premium" | "muted"; loading?: boolean }) {
  const c = { primary: "text-primary bg-primary/15", live: "text-live bg-live/15", premium: "text-premium bg-premium/15", muted: "text-muted-foreground bg-secondary" }[tone];
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center" role="status">
      <span className={"mx-auto grid h-14 w-14 place-items-center rounded-full " + c}>{loading ? <Loader2 className="animate-spin" /> : <I size={26} />}</span>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-[280px] text-sm text-muted-foreground">{text}</p>
      {action && <Button className="mt-4 w-full max-w-[260px] rounded-full bg-spot-gradient text-foreground" onClick={onAction}>{action}</Button>}
      {secondary && <Button variant="ghost" className="mt-1 w-full max-w-[260px]" onClick={onSecondary}>{secondary}</Button>}
    </div>
  );
}

export const SponsoredTag = ({ label = "Patrocinado" }: { label?: string }) => <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-foreground">{label}</span>;
export const BoostedTag = () => <span className="rounded bg-premium/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">Impulsado</span>;
export function IncognitoTag({ className = "" }: { className?: string }) {
  return <span className={"inline-flex items-center gap-1 rounded-full border border-accent/60 bg-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-foreground " + className}><Ghost size={11} />✱ INCÓGNITO VERIFICADO</span>;
}
export const Trust = ({ children }: { children: ReactNode }) => <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/60 p-3 text-[11px] leading-snug text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />{children}</p>;

const seedBars = (seed: number, n: number) => Array.from({ length: n }, (_, i) => 22 + ((i * 37 + seed * 53) % 70));
/** Forma de onda decorativa y estable. */
export function Waveform({ active, seed = 1, bars = 28, className = "" }: { active?: boolean; seed?: number; bars?: number; className?: string }) {
  return <span aria-hidden="true" className={"flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden " + className}>{seedBars(seed, bars).map((h, i) => <span key={i} className={(active ? "spot-wave-active voice-wave-playing" : "spot-wave-idle")} style={{ height: `${h}%`, width: 2, borderRadius: 3, animationDelay: `${(i % 7) * 60}ms` }} />)}</span>;
}

/** Fila de audio (avatar + onda + duración + play). */
export function AudioRow({ name, img, dur, ago, seed = 1, right }: { name: string; img?: string | undefined; dur: string; ago?: string | undefined; seed?: number; right?: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {img ? <img src={img} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary font-bold">{name[0]}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}{ago && <small className="font-normal text-muted-foreground"> · {ago}</small>}</p>
        <div className="mt-1 flex items-center gap-2">
          <button aria-label={on ? `Pausar audio de ${name}` : `Escuchar audio de ${name}`} onClick={() => setOn(!on)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            {on ? <span className="flex gap-[2px]"><i className="h-3 w-[3px] bg-current" /><i className="h-3 w-[3px] bg-current" /></span> : <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />}
          </button>
          <Waveform active={on} seed={seed} />
          <span className="text-xs text-muted-foreground">{dur}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

/** Cabecera de pantalla completa con botón atrás. */
export function Screen({ title, onBack, children, footer, z = 50, sub }: { title: string; onBack: () => void; children: ReactNode; footer?: ReactNode; z?: number; sub?: string }) {
  const pos = usePos();
  return (
    <div className={pos + " inset-0 mx-auto flex max-w-[520px] flex-col bg-background"} style={{ zIndex: z }}>
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
        <Button variant="ghost" size="icon" aria-label="Volver" onClick={onBack}><svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></Button>
        <div className="min-w-0"><h2 className="truncate text-base font-bold">{title}</h2>{sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}</div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-3">{children}</main>
      {footer && <footer className="shrink-0 border-t border-border bg-background/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">{footer}</footer>}
    </div>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={"animate-pulse rounded-xl bg-secondary " + className} />;
