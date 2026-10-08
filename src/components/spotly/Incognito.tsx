import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, EyeOff, Flag, Ghost, Mic, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, IncognitoTag, Screen, Toggle, Trust } from "./kit";
import { Checkout } from "./Credits";
import { useApp } from "./app-context";
import { VoiceReply } from "./Voice";
import { VoiceItem } from "./VoiceThread";
import { sampleThread } from "@/lib/voice/samples";
import { addReport, blockUser, demoShortenIncognito, extendIncognito, fmtRemaining, setIncognito, startIncognito, stopIncognito, useNow, useStore } from "@/lib/store";
import { eur, eurToCredits, incognitoExtensions, incognitoOptions, incognitoWarnMinutes, locationPrecision, priceLabel } from "@/lib/spotlyConfig";
import sevilleNight from "@/assets/seville-night.jpg";

const expireOptions = [["keep", "Conservan el anonimato"], ["archive", "Se archivan"], ["hide", "Dejan de estar disponibles"]] as const;

/** Configurar, activar, gestionar y extender el Incógnito. */
export function IncognitoSheet({ onClose, z = 65 }: { onClose: () => void; z?: number }) {
  const { incognito: inc } = useStore();
  const app = useApp();
  const now = useNow();
  const [sel, setSel] = useState("1h");
  const [buy, setBuy] = useState<null | { kind: "start" | "extend"; id: string }>(null);
  const opt = incognitoOptions.find((o) => o.id === sel)!;
  const remaining = inc.until && now ? inc.until - now : null;
  const ending = inc.active && !inc.permanent && remaining !== null && remaining <= incognitoWarnMinutes * 60_000;
  const prec = locationPrecision.find((p) => p.id === inc.precision)!;
  const buyOpt = buy ? incognitoOptions.find((o) => o.id === buy.id)! : null;

  return (
    <BottomSheet title="👻 Modo Incógnito" onClose={onClose} z={z}>
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-3">
        <IncognitoTag />
        <p className="mt-2 text-xs text-foreground/85">Autor verificado por Spotly. Identidad oculta públicamente. <b>Spotly sabe qué cuenta publica</b>; el resto de personas no.</p>
      </div>

      {inc.active && (
        <div className={"mt-3 rounded-2xl border p-4 " + (ending ? "border-live/60 bg-live/10" : "border-primary/40 bg-primary/10")}>
          <p className="flex items-center gap-2 text-sm font-bold"><Clock size={16} className={ending ? "text-live" : "text-primary"} />{inc.permanent ? "Incógnito permanente activo" : ending ? `Tu Incógnito termina en ${Math.max(1, Math.ceil((remaining ?? 0) / 60000))} min` : "Incógnito activo"}</p>
          {!inc.permanent && <p className="mt-1 text-3xl font-extrabold tabular-nums">{remaining === null ? "—" : fmtRemaining(remaining)}</p>}
          {!inc.permanent && <>
            <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">EXTENDER</p>
            <div className="grid grid-cols-3 gap-2">{incognitoExtensions.map((id) => { const o = incognitoOptions.find((x) => x.id === id)!; return <button key={id} onClick={() => setBuy({ kind: "extend", id })} className="rounded-xl border border-border bg-card py-2 text-center"><strong className="block text-sm">+{o.label.replace(" hora", " h")}</strong><small className="text-3xs text-muted-foreground">{eur(o.priceEur)}</small></button>; })}</div>
          </>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => { demoShortenIncognito(9); toast("Demo: te quedan 9 minutos"); }}>Ver aviso de fin (demo)</Button>
            <Button variant="outline" size="sm" onClick={() => { stopIncognito(); toast("Incógnito desactivado. No hay reembolso del tiempo restante."); }}>Desactivar ahora</Button>
          </div>
        </div>
      )}

      {!inc.active && <>
        <h4 className="mb-2 mt-4 text-sm font-bold">¿Cuánto tiempo?</h4>
        <div className="grid grid-cols-2 gap-2">{incognitoOptions.map((o) => <button key={o.id} onClick={() => setSel(o.id)} aria-pressed={sel === o.id} className={"rounded-xl border p-3 text-left " + (sel === o.id ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card")}><strong className="block text-sm">{o.label}</strong><small className="text-muted-foreground">{eur(o.priceEur)} · {eurToCredits(o.priceEur)} cr</small></button>)}</div>
        <p className="mt-2 text-2xs text-muted-foreground">Precios de ejemplo, configurables desde el servidor.</p>
      </>}

      <h4 className="mb-2 mt-4 text-sm font-bold">Protección de voz</h4>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><ShieldCheck size={18} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-sm">Proteger mi voz</strong><small className="text-muted-foreground">La voz también identifica. Al activarlo se transformará antes de publicar.</small></span>
        <Toggle on={inc.protectVoice} onChange={(v) => setIncognito({ protectVoice: v })} label="Proteger mi voz" />
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">{inc.protectVoice ? "Estado: protegida. El procesado de voz llegará con el servidor; hoy es solo el control." : "Estado: sin proteger. Tu voz original podría reconocerse."}</p>

      <h4 className="mb-2 mt-4 text-sm font-bold">Ubicación pública</h4>
      <div className="space-y-2">{locationPrecision.map((p) => <button key={p.id} onClick={() => setIncognito({ precision: p.id })} aria-pressed={inc.precision === p.id} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (inc.precision === p.id ? "border-primary bg-primary/10" : "border-border bg-card")}><span className="flex-1"><strong className="block text-sm">{p.label}</strong><small className="text-muted-foreground">{p.hint}</small></span>{inc.precision === p.id && <Check size={16} className="text-primary" />}</button>)}</div>
      {prec.id === "exact" && <p className="mt-2 flex items-start gap-2 rounded-xl border border-live/50 bg-live/10 p-3 text-xs"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-live" />Con ubicación exacta, cualquiera que te conozca puede deducir que eres tú. Te recomendamos “Aproximada” o “Solo zona”.</p>}

      <h4 className="mb-2 mt-4 text-sm font-bold">Cuando termine el Incógnito, mis Spots incógnito…</h4>
      <div className="flex flex-wrap gap-2">{expireOptions.map(([k, l]) => <button key={k} onClick={() => setIncognito({ onExpire: k })} aria-pressed={inc.onExpire === k} className={"rounded-full border px-3 py-1.5 text-xs " + (inc.onExpire === k ? "spot-active-pill border-transparent" : "border-border bg-card")}>{l}</button>)}</div>
      <p className="mt-2 text-2xs text-muted-foreground">Tu identidad nunca se revela sola al expirar. Solo tú puedes decidir mostrarla, Spot a Spot.</p>

      <div className="mt-4"><Trust>Incógnito no es impunidad: se puede denunciar, bloquear y moderar cualquier Spot, y Spotly conserva la relación con la cuenta verificada según la política aplicable.</Trust></div>

      {!inc.active
        ? <Button className="mt-4 h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" onClick={() => setBuy({ kind: "start", id: sel })}>Activar Incógnito · {opt.label} · {priceLabel(opt.priceEur)}</Button>
        : <Button variant="secondary" className="mt-4 w-full" onClick={() => { onClose(); app.openIncognitoSpot(); }}><EyeOff size={16} />Ver cómo se ve mi Spot en público</Button>}

      {buy && buyOpt && <Checkout
        title={buy.kind === "start" ? `Incógnito ${buyOpt.label}` : `Extender Incógnito ${buyOpt.label}`}
        kind="digital"
        lines={[{ label: `${buy.kind === "start" ? "Incógnito" : "Extensión"} · ${buyOpt.label}`, eur: buyOpt.priceEur }]}
        onClose={() => setBuy(null)}
        onNeedCredits={() => app.open("wallet")}
        onPaid={() => { if (buy.kind === "start") startIncognito(buy.id); else extendIncognito(buy.id); toast.success(buy.kind === "start" ? "Incógnito activado" : "Incógnito extendido"); }}
      />}
    </BottomSheet>
  );
}

/** Pastilla persistente sobre la barra inferior mientras el Incógnito está activo. */
export function IncognitoBanner({ onOpen }: { onOpen: () => void }) {
  const { incognito: inc } = useStore();
  const now = useNow();
  const remaining = inc.until && now ? inc.until - now : null;
  useEffect(() => {
    if (inc.active && !inc.permanent && remaining !== null && remaining <= 0) {
      stopIncognito(true);
      toast("Tu Incógnito ha terminado. Tu identidad no se ha revelado.");
    }
  }, [inc.active, inc.permanent, remaining]);
  if (!inc.active) return null;
  const ending = !inc.permanent && remaining !== null && remaining <= incognitoWarnMinutes * 60_000;
  return (
    <button onClick={onOpen} className={"fixed inset-x-3 bottom-[calc(4.875rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[496px] items-center gap-2 rounded-full border px-4 py-2 text-left text-xs shadow-glow backdrop-blur " + (ending ? "border-live bg-live/20" : "border-accent/60 bg-card/95")} aria-label="Gestionar Incógnito">
      <Ghost size={16} className={ending ? "text-live" : "text-accent"} />
      <span className="min-w-0 flex-1 truncate font-semibold">{inc.permanent ? "Incógnito permanente" : ending ? `Tu Incógnito termina en ${Math.max(1, Math.ceil((remaining ?? 0) / 60000))} min` : `Incógnito activo · ${remaining === null ? "—" : fmtRemaining(remaining)}`}</span>
      <span className="rounded-full bg-primary px-2.5 py-1 text-3xs font-bold text-primary-foreground">{ending ? "EXTENDER" : "GESTIONAR"}</span>
    </button>
  );
}

/** Nota que se muestra tras la expiración (sin revelar identidad). */
export function IncognitoExpiredNote() {
  const { incognitoNote } = useStore();
  const [hidden, setHidden] = useState(false);
  if (!incognitoNote || hidden) return null;
  return <p className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-border bg-secondary/70 p-3 text-xs"><Ghost size={14} className="mt-0.5 shrink-0 text-accent" /><span className="flex-1">{incognitoNote}</span><button aria-label="Cerrar aviso" onClick={() => setHidden(true)} className="text-muted-foreground">✕</button></p>;
}

/** La voz de ejemplo del Spot incógnito (sin audio): fantasma y «Anónimo», con el diseño de todas las voces. */
const incognitoSample = () => ({ ...sampleThread("incognito:alameda", [{ key: "voz", name: "Anónimo", anon: true, minsAgo: 9, dur: "0:16", likes: 0 }])[0]!, liked: false, replies: 0 });

/** Spot incógnito en el feed. */
export function IncognitoSpotCard() {
  const app = useApp();
  const [reply, setReply] = useState(false);
  return (
    <article className="spot-feed-card mx-3 overflow-hidden rounded-xl bg-card">
      <button className="relative block aspect-[5/3] w-full" onClick={app.openIncognitoSpot} aria-label="Abrir Spot incógnito">
        <img src={sevilleNight} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <span className="absolute left-3 top-3"><IncognitoTag /></span>
        <span className="absolute right-3 top-3 rounded-md bg-background/85 px-2 py-1 text-3xs font-semibold">Zona Alameda · aprox.</span>
        <span className="absolute inset-x-3 bottom-2 flex items-center gap-2 text-left"><span className="grid h-10 w-10 place-items-center rounded-full border border-accent bg-background/80"><Ghost size={18} className="text-accent" /></span><span><strong className="block text-sm">Persona anónima verificada</strong><small className="text-foreground/80">Identidad oculta públicamente · Hace 9 min</small></span></span>
      </button>
      <div className="px-3 pb-3 pt-2">
        <VoiceItem note={incognitoSample()} onReply={() => setReply(true)} />
      </div>
      {reply && <VoiceReply name="esta persona" onClose={() => setReply(false)} />}
    </article>
  );
}

/** Cómo ve el público un Spot incógnito: sin nombre, sin avatar, sin enlace. */
export function IncognitoPublicProfile({ onClose }: { onClose: () => void }) {
  const { blocked } = useStore();
  const [reply, setReply] = useState(false);
  const [report, setReport] = useState(false);
  const isBlocked = blocked.includes("Incógnito #4821");
  return (
    <Screen title="Spot incógnito" sub="Vista pública" onBack={onClose} z={66}>
      <div className="rounded-3xl bg-spot-surface p-6 text-center">
        <span className="mx-auto grid h-24 w-24 place-items-center rounded-full border-2 border-accent bg-background shadow-glow"><Ghost size={44} className="text-accent" /></span>
        <div className="mt-3"><IncognitoTag /></div>
        <p className="mt-3 text-sm">Autor verificado por Spotly.<br />Identidad oculta públicamente.</p>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-bold">Lo que NO se muestra</h3>
      <div className="grid grid-cols-2 gap-2">{["Nombre", "Avatar", "@usuario", "Seguidores", "Enlace al perfil", "Identidad pública"].map((x) => <p key={x} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 text-xs"><EyeOff size={13} className="text-accent" />{x}</p>)}</div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border"><img src={sevilleNight} alt="Foto del Spot" className="aspect-video w-full object-cover" /></div>
      <div className="mt-3"><VoiceItem note={incognitoSample()} onReply={() => setReply(true)} /></div>
      <p className="mt-2 text-xs text-muted-foreground">Ubicación: Zona Alameda (aproximada). Cierran la calle por un rodaje.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={() => setReply(true)}><Mic size={16} />Responder con voz</Button>
        <Button variant="secondary" onClick={() => setReport(true)}><Flag size={16} />Denunciar</Button>
      </div>
      <Button variant="ghost" className="mt-2 w-full" disabled={isBlocked} onClick={() => { blockUser("Incógnito #4821"); toast("Autor incógnito bloqueado. No verás más de sus Spots."); }}><UserX size={16} />{isBlocked ? "Autor bloqueado" : "Bloquear a este autor"}</Button>
      <div className="mt-4"><Trust>Incógnito no es impunidad: Spotly conoce la cuenta autora y aplica las mismas normas, denuncias y moderación que a cualquier Spot.</Trust></div>
      {reply && <VoiceReply name="esta persona" onClose={() => setReply(false)} />}
      {report && <BottomSheet title="¿Por qué denuncias este Spot?" onClose={() => setReport(false)} z={70}>
        {["Spam o engaño", "Acoso o insultos", "Información falsa", "Violencia o peligro"].map((r) => <button key={r} onClick={() => { addReport("Spot incógnito · Alameda", r); setReport(false); toast.success("Denuncia enviada. Spotly la revisará con la cuenta verificada del autor."); }} className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-secondary">{r}</button>)}
      </BottomSheet>}
    </Screen>
  );
}
