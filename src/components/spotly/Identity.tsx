import { useEffect, useRef, useState, type ReactNode } from "react";
import { Asterisk, BadgeCheck, Camera, Check, ChevronRight, Clock, CopyX, Crown, FileWarning, IdCard, Music2, Phone, ScanFace, ShieldCheck, ShieldX, Smartphone, Sparkles, TrendingUp, User, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, Chip, Screen, StateCard, Trust, TopBar } from "./kit";
import { SelfieStep } from "./Selfie";
import { Checkout } from "./Credits";
import { verificationPricesEur, eur } from "@/lib/spotlyConfig";
import { setIdentity, setIdTier, useStore, type IdentityStatus, type IdTier } from "@/lib/store";
import me from "@/assets/spotly-me.jpg";

type Step = "hub" | "intro" | "methods" | "doc" | "selfie" | "phone" | "sms" | "social" | "creator" | "processing" | "result";
type Outcome = Exclude<IdentityStatus, "none" | "pending">;
type Method = "doc" | "selfie" | "social" | "phone" | "creator";

const OUTCOMES: [Outcome, string][] = [["approved", "Aprobada"], ["review", "Revisión manual"], ["rejected", "Rechazada"], ["invalid", "Documento no válido"], ["duplicate", "Posible duplicado"]];
const GESTURES = ["Mira al frente y parpadea", "Gira la cabeza a la derecha", "Gira la cabeza a la izquierda"];
const CHECKS_FULL = ["Documento validado", "Selfie verificado", "Datos comprobados", "Perfil analizado con IA"];
const CHECKS_BASIC = ["Selfie recibido", "Prueba de vida superada", "Persona real confirmada"];
const tierInfo: Record<IdTier, { name: string; sub: string; done: string }> = {
  basic: { name: "Básica", sub: "Selfie en tiempo real · gratis", done: "Hemos comprobado que eres una persona real." },
  premium: { name: "Premium", sub: "Identidad completa · de pago", done: "Tu cuenta ahora está verificada con el asterisco Premium." },
  creator: { name: "Creador", sub: "Premium + creador · de pago", done: "Tu cuenta está verificada. El distintivo Creador se concede tras revisar tu perfil." },
};
const methodsDef: { id: Method; icon: typeof IdCard; title: string; sub: string; tone: string; rec?: boolean; need?: boolean }[] = [
  { id: "doc", icon: IdCard, title: "Documento de identidad", sub: "DNI, pasaporte o NIE", tone: "violet", rec: true, need: true },
  { id: "selfie", icon: ScanFace, title: "Selfie en tiempo real", sub: "Prueba de vida con IA", tone: "pink", need: true },
  { id: "social", icon: Music2, title: "Redes sociales", sub: "Vincula tu Instagram, TikTok, etc.", tone: "cyan" },
  { id: "phone", icon: Smartphone, title: "Número de teléfono", sub: "Verificación por SMS", tone: "cyan", need: true },
  { id: "creator", icon: Sparkles, title: "Verificación de creador", sub: "Para modelos, artistas y creadores", tone: "pink", need: true },
];
const presets: Record<IdTier, Method[]> = { basic: [], premium: ["phone"], creator: ["phone", "creator"] };
/** Métodos disponibles por nivel: Básica solo selfie; el teléfono es exclusivo de Premium/Creador. */
const methodsFor = (t: IdTier): Method[] => (t === "basic" ? ["selfie"] : t === "premium" ? ["doc", "selfie", "phone", "social"] : ["doc", "selfie", "phone", "social", "creator"]);

export const identityLabel: Record<IdentityStatus, [string, string]> = {
  none: ["Sin verificar", "text-muted-foreground"], pending: ["Verificación pendiente", "text-premium"], review: ["En revisión manual", "text-premium"],
  approved: ["Identidad comprobada", "text-primary"], rejected: ["Verificación rechazada", "text-live"], invalid: ["Documento no válido", "text-live"], duplicate: ["Posible duplicidad", "text-live"],
};

/** Marco de pantalla completa de las láminas de verificación. */
function Frame({ title, sub, onBack, children, cta, onCta, disabled, footer, center }: { title?: string; sub?: string; onBack?: (() => void) | undefined; children: ReactNode; cta?: string | undefined; onCta?: (() => void) | undefined; disabled?: boolean; footer?: ReactNode; center?: boolean }) {
  return <div className="boost-reference fixed inset-0 z-[60] mx-auto flex max-w-[520px] flex-col">
    <TopBar title={title ?? ""} onBack={onBack} border={false} transparent />
    <main className={"flex-1 overflow-y-auto px-6 pt-2 " + (cta || footer ? "pb-3 " : "pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem))] ") + (center ? "flex flex-col" : "")}>{sub && <p className="mb-3 text-center text-sm text-muted-foreground">{sub}</p>}{children}</main>
    {(cta || footer) && <div className="shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">{cta && <Button onClick={onCta} disabled={disabled} className="h-[3.25rem] w-full rounded-full bg-spot-gradient text-base text-foreground shadow-glow">{cta}</Button>}{footer}</div>}
  </div>;
}

/** Asterisco de verificación (distintivo público). */
function Star({ size = 40, tone = "pink" }: { size?: number; tone?: "pink" | "blue" }) {
  return <Asterisk size={size} strokeWidth={3.2} style={{ color: tone === "pink" ? "var(--spot-fuchsia)" : "var(--spot-blue)", filter: `drop-shadow(0 0 8px ${tone === "pink" ? "var(--spot-fuchsia)" : "var(--spot-blue)"})` }} />;
}

/** Documento de EJEMPLO (ilustración genérica; no imita ningún documento oficial). */
function SampleCard({ side }: { side: "front" | "back" }) {
  return <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label={`Documento de ejemplo, ${side === "front" ? "anverso" : "reverso"}`}>
    <defs><linearGradient id="sc" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="oklch(0.3 0.09 260)" /><stop offset="1" stopColor="oklch(0.22 0.08 300)" /></linearGradient></defs>
    <rect width="320" height="200" rx="14" fill="url(#sc)" /><rect x="8" y="8" width="304" height="184" rx="10" fill="none" stroke="var(--primary)" strokeOpacity=".35" strokeDasharray="5 4" />
    {side === "front" ? <>
      <circle cx="82" cy="92" r="42" fill="oklch(0.38 0.06 260)" /><circle cx="82" cy="80" r="15" fill="oklch(0.55 0.05 260)" /><path d="M50 128c6-20 58-20 64 0" fill="oklch(0.55 0.05 260)" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="146" y={56 + i * 22} width={i === 0 ? 120 : 150 - i * 14} height="9" rx="4.5" fill="var(--foreground)" opacity={i === 0 ? 0.75 : 0.35} />)}
      <rect x="20" y="152" width="280" height="10" rx="5" fill="var(--foreground)" opacity=".18" /><rect x="20" y="170" width="220" height="10" rx="5" fill="var(--foreground)" opacity=".18" />
    </> : <>
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="24" y={30 + i * 22} width={250 - (i % 3) * 40} height="9" rx="4.5" fill="var(--foreground)" opacity=".28" />)}
      <rect x="24" y="150" width="272" height="30" rx="6" fill="var(--foreground)" opacity=".15" />
    </>}
    <text x="160" y="22" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="2" fill="var(--primary)">DOCUMENTO DE EJEMPLO</text>
  </svg>;
}

/**
 * Flujo de verificación obligatoria (láminas 2–6). Sin proveedor de identidad conectado,
 * el resultado se elige a mano (DEMO) y se rotula como tal: NUNCA se presenta
 * como verificación real ni como infalible. Las fotos elegidas no se envían ni se guardan.
 * Contrato: POST /v1/identity/sessions → { sessionId }, webhook de estado.
 */
export function Verification({ onBack }: { onBack: () => void }) {
  const { identity, idTier } = useStore();
  const [step, setStep] = useState<Step>(identity === "none" ? "intro" : "hub");
  const [tier, setTier] = useState<IdTier>("premium");
  const [methods, setMethods] = useState<Method[]>(["doc", "selfie", ...presets.premium]);
  const [showExplain, setShowExplain] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [passport, setPassport] = useState(false);
  const [side, setSide] = useState<"front" | "back">("front");
  const [img, setImg] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
    const [social, setSocial] = useState<Record<string, string>>({ Instagram: "", TikTok: "", YouTube: "", X: "" });
  const [cat, setCat] = useState("");
  const [about, setAbout] = useState("");
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("approved");
  const [sheet, setSheet] = useState<null | "phone" | "recovery">(null);
  const [pay, setPay] = useState(false);
  const [paid, setPaid] = useState<IdTier[]>([]);
  const CHECKS = tier === "basic" ? CHECKS_BASIC : CHECKS_FULL;
  const file = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const [selfieManual, setSelfieManual] = useState(false);
  const [selfieKey, setSelfieKey] = useState(0);

  const queue: Step[] = [...(tier !== "basic" ? (["doc"] as Step[]) : []), "selfie", ...(tier !== "basic" && methods.includes("phone") ? (["phone", "sms"] as Step[]) : []), ...(tier !== "basic" && methods.includes("social") ? (["social"] as Step[]) : []), ...(tier === "creator" && methods.includes("creator") ? (["creator"] as Step[]) : [])];
  const full: Step[] = tier === "basic" ? ["intro", ...queue] : ["intro", "methods", ...queue];
  const idx = full.indexOf(step);

  useEffect(() => () => { urls.current.forEach(URL.revokeObjectURL); }, []);
  useEffect(() => { if (step === "sms" && wait > 0) { const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); } return undefined; }, [step, wait]);
  useEffect(() => {
    if (step !== "processing") return undefined;
    if (progress < CHECKS.length) { const t = setTimeout(() => setProgress(progress + 1), 650); return () => clearTimeout(t); }
    const t = setTimeout(() => { setIdentity(outcome); setIdTier(tier); setStep("result"); }, 700);
    return () => clearTimeout(t);
  }, [step, progress, outcome, tier]);

  const goNext = () => { const i = queue.indexOf(step); if (i >= 0 && i < queue.length - 1) setStep(queue[i + 1]!); else { setIdentity("pending"); setProgress(0); setStep("processing"); } };
  const goBack = () => { if (step === "hub" || step === "intro" || step === "result" || step === "processing") onBack(); else setStep(full[idx - 1] ?? "intro"); };
  const toggle = (m: Method) => setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const retry = () => { setSelfieKey((k) => k + 1); setImg({ front: null, back: null }); setIdentity("none"); setStep("doc"); };

  const pick = (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) { toast.error("Usa una foto JPG o PNG."); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("La foto supera los 10 MB."); return; }
    const u = URL.createObjectURL(f); urls.current.push(u);
    setImg((v) => ({ ...v, [side]: u })); if (file.current) file.current.value = "";
  };

  const [ist, icls] = identityLabel[identity];
  const docReady = !!img.front && (passport || !!img.back);
  const socialReady = Object.values(social).some((v) => v.trim().length >= 2);

  if (step === "hub" || (step === "result" && identity !== "approved")) return (
    <Screen title={step === "hub" ? "Tu verificación" : "Resultado"} sub="Cuentas de personas reales" onBack={goBack} z={60}>
      {step === "hub" && <>
        <div className="rounded-2xl border border-border bg-card p-5 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary">{identity === "approved" ? <BadgeCheck size={30} className="text-primary" /> : <ShieldCheck size={30} className="text-muted-foreground" />}</span><h3 className={"mt-3 text-lg font-bold " + icls}>{ist}</h3><p className="mt-1 text-sm text-muted-foreground">{identity === "approved" ? "Spotly ha comprobado internamente tu identidad. Puedes publicar, responder y comprar." : identity === "review" || identity === "pending" ? "Estamos revisando tu identidad. Mientras tanto puedes escuchar y explorar." : "Todavía no puedes publicar ni responder."}</p>{identity !== "approved" && identity !== "review" && identity !== "pending" && <Button className="mt-4 rounded-full bg-spot-gradient text-foreground" onClick={() => setStep("intro")}>{identity === "none" ? "Empezar verificación" : "Reintentar"}</Button>}</div>
        <Explain />
        <div className="mt-4 space-y-2">
          {identity === "approved" && idTier === "basic" && <Button className="h-14 w-full justify-start gap-3 bg-spot-gradient text-white" onClick={() => { setTier("premium"); setStep("intro"); }}><Asterisk size={18} />Mejorar a Premium: documento, teléfono y asterisco</Button>}
          {idTier !== "basic" && <Button variant="secondary" className="h-14 w-full justify-start gap-3" onClick={() => setSheet("phone")}><Phone size={18} className="text-primary" />Cambiar mi teléfono</Button>}
          <Button variant="secondary" className="h-14 w-full justify-start gap-3" onClick={() => setSheet("recovery")}><UserCog size={18} className="text-primary" />Recuperar mi cuenta</Button>
        </div>
      </>}


      {step === "result" && <>
        {identity === "review" && <StateCard icon={Clock} tone="premium" title="Revisión manual" text="Una persona del equipo revisará tu caso en 24–48 h. Mientras, puedes escuchar y explorar." action="Entendido" onAction={onBack} />}
        {identity === "rejected" && <StateCard icon={ShieldX} tone="live" title="No hemos podido verificarte" text="Los datos no coinciden o la imagen no era clara. La verificación automática no es infalible: puedes reintentar o pedir revisión manual." action="Reintentar" onAction={retry} secondary="Pedir revisión manual" onSecondary={() => { setIdentity("review"); toast("Solicitud enviada"); }} />}
        {identity === "invalid" && <StateCard icon={FileWarning} tone="live" title="Documento no válido" text="No hemos podido leer tu documento o está caducado. Prueba con otro o repite la foto con mejor luz." action="Probar con otro documento" onAction={retry} secondary="Volver" onSecondary={onBack} />}
        {identity === "duplicate" && <StateCard icon={CopyX} tone="premium" title="Posible cuenta duplicada" text="Parece que ya existe una cuenta verificada con estos datos. Puedes recuperar la anterior o pedir revisión." action="Recuperar mi cuenta" onAction={() => { setStep("hub"); setSheet("recovery"); }} secondary="Pedir revisión" onSecondary={() => { setIdentity("review"); toast("Solicitud enviada"); onBack(); }} />}
      </>}
      {sheet === "phone" && <PhoneChange onClose={() => setSheet(null)} />}
      {sheet === "recovery" && <Recovery onClose={() => setSheet(null)} />}
    </Screen>
  );

  /* ---- Lámina 2 · Tipos de verificación ---- */
  if (step === "intro") return (
    <Frame onBack={onBack} cta={tier === "basic" ? "Empezar verificación" : paid.includes(tier) ? "Empezar verificación" : `Continuar · ${eur(verificationPricesEur[tier])}`} onCta={() => { setIdTier(tier); if (tier === "basic") { setMethods(["selfie"]); setStep("selfie"); } else { setMethods(["doc", "selfie", ...presets[tier]]); if (paid.includes(tier)) setStep("methods"); else setPay(true); } }}
      footer={<><button onClick={onBack} className="mt-2 w-full text-center text-xs font-semibold text-muted-foreground">Ahora no · solo escuchar y explorar</button><p className="mt-2 text-center text-[0.75rem] text-muted-foreground"><span className="text-emerald-400">Tu información</span> está protegida y encriptada</p><p className="text-center text-3xs text-muted-foreground">DEMO: en esta versión no se envía ni se guarda ningún dato.</p></>}>
      <div className="spot-rise text-center" style={{ animationDelay: ".05s" }}><span className="flex justify-center"><Star size={22} /></span><h1 className="-mt-1 text-[1.6875rem] font-bold">Verificación Premium</h1><p className="mx-auto mt-2 max-w-[14.375rem] text-[0.9375rem] leading-snug text-muted-foreground">Demuestra que eres real y destaca en Spotly</p></div>
      <ul className="mx-auto mt-4 max-w-[20.625rem] space-y-2.5">{([[Asterisk, "Asterisco verificado en tu perfil", "b"], [TrendingUp, "Más visibilidad y alcance", "b"], [Sparkles, "Acceso a funciones exclusivas", "b"], [Users, "Mayor confianza de la comunidad", "p"], [ShieldCheck, "Protección frente a suplantaciones", "p"]] as const).map(([I, t, c], i) => <li key={t} className="spot-rise flex items-center gap-3 text-[0.8125rem]" style={{ animationDelay: `${0.15 + i * 0.07}s` }}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: c === "b" ? "var(--spot-blue)" : "var(--spot-fuchsia)", color: c === "b" ? "var(--spot-blue)" : "var(--spot-fuchsia)", boxShadow: `0 0 10px ${c === "b" ? "var(--spot-blue)" : "var(--spot-fuchsia)"}55` }}><I size={16} /></span>{t}</li>)}</ul>
      <div className="mx-auto mt-5 grid max-w-[22.5rem] grid-cols-3 items-end gap-2" role="radiogroup" aria-label="Tipo de verificación">
        {(["basic", "premium", "creator"] as IdTier[]).map((k) => { const on = tier === k; const prem = k === "premium"; return (
          <button key={k} role="radio" aria-checked={on} onClick={() => setTier(k)} className={"relative flex flex-col items-center rounded-2xl border px-2 pb-4 pt-5 text-center transition " + (prem ? "-mt-3 pb-7 pt-7 " : "") + (on ? "border-transparent shadow-glow " : "border-border opacity-90 ") + (prem ? "bg-gradient-to-b from-[oklch(0.25_0.12_310)] to-[oklch(0.17_0.08_290)]" : "bg-card/70")} style={on ? { background: `linear-gradient(var(--card), var(--card)) padding-box, linear-gradient(135deg, var(--spot-blue), var(--spot-fuchsia)) border-box` } : undefined}>
            {prem && <span className="absolute inset-x-2 -top-3 rounded-full bg-[var(--spot-fuchsia)] py-0.5 text-4xs font-bold text-white">Popular</span>}
            <span className="grid h-12 w-12 place-items-center rounded-full bg-background/40">{k === "creator" ? <Crown size={28} className="text-premium" fill="currentColor" /> : <Star size={30} tone={prem ? "pink" : "blue"} />}</span>
            <strong className="mt-2 text-[0.9375rem]">{tierInfo[k].name}</strong><small className="mt-1 text-2xs leading-tight text-muted-foreground">{tierInfo[k].sub}</small><span className="mt-1.5 rounded-full bg-background/50 px-2 py-0.5 text-2xs font-bold">{verificationPricesEur[k] === 0 ? "Gratis" : eur(verificationPricesEur[k])}</span>
            {prem && <span className="absolute inset-x-2 -bottom-3 rounded-full bg-[var(--spot-fuchsia)] py-1 text-4xs font-bold tracking-wide text-white">RECOMENDADO</span>}
          </button>); })}
      </div>
      <button onClick={() => setShowExplain(!showExplain)} className="mx-auto mt-6 block text-xs font-semibold text-primary">{showExplain ? "Ocultar" : "¿En qué se diferencia de la identidad interna y de Premium?"}</button>
      {showExplain && <><Explain /><div className="mt-3"><Trust>Tus datos legales nunca se muestran. La verificación automática no es infalible: si nos equivocamos, puedes pedir revisión manual.</Trust></div></>}
    {pay && <Checkout title={`Verificación ${tierInfo[tier].name}`} kind="digital" lines={[{ label: `Verificación ${tierInfo[tier].name} · pago único`, eur: verificationPricesEur[tier] }]} onClose={() => setPay(false)} onPaid={() => { setPaid((p) => [...p, tier]); setPay(false); setStep("methods"); }} />}
    </Frame>
  );

  /* ---- Lámina 3 · Selección de método ---- */
  if (step === "methods") return (
    <Frame onBack={goBack} cta="Continuar" onCta={() => setStep("doc")}>
      <h1 className="mt-2 text-center text-[1.5rem] font-bold">¿Cómo quieres verificarte?</h1>
      <p className="mx-auto mb-4 mt-2 max-w-[17.5rem] text-center text-[0.8125rem] leading-snug text-muted-foreground">Elige el método que prefieras. Puedes combinar varios para aumentar la confianza.</p>
      <div className="space-y-2.5">{methodsDef.filter((m) => methodsFor(tier).includes(m.id)).map((m, i) => { const on = methods.includes(m.id); const col = m.tone === "cyan" ? "var(--spot-blue)" : m.tone === "pink" ? "var(--spot-fuchsia)" : "oklch(0.66 0.2 285)"; return (
        <button key={m.id} aria-pressed={on} onClick={() => { if (m.need) toast("Este método es necesario para activar tu cuenta"); else toggle(m.id); }} className={"spot-rise relative flex w-full items-center gap-3.5 rounded-2xl border p-3 text-left transition " + (on ? "border-transparent shadow-glow" : "border-border")} style={{ animationDelay: `${i * 0.06}s`, background: on ? "linear-gradient(110deg, oklch(0.17 0.06 275), oklch(0.2 0.09 300)) padding-box, linear-gradient(110deg, var(--spot-blue), var(--spot-fuchsia)) border-box" : "color-mix(in oklab, var(--spot-blue) 6%, var(--background))" }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2" style={{ borderColor: col, color: col, background: "color-mix(in oklab, " + col + " 14%, var(--background))" }}><m.icon size={22} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-[0.9375rem] leading-tight">{m.title}</strong><small className="mt-0.5 block text-[0.75rem] text-muted-foreground">{m.sub}{m.need ? " · necesario" : ""}</small></span>
          {m.rec && <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-r from-[oklch(0.6_0.26_302)] to-[var(--spot-fuchsia)] px-2.5 py-0.5 text-3xs font-bold text-white">Recomendado</span>}
          {on ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={14} /></span> : <ChevronRight size={20} className="shrink-0 text-foreground" />}
        </button>); })}</div>
      <p className="mt-3 text-center text-2xs text-muted-foreground">«{tierInfo[tier].name}» incluye documento, selfie y teléfono{tier === "creator" ? " y revisión de creador" : ""}. Las redes sociales son opcionales.</p>
    </Frame>
  );

  /* ---- Lámina 4 · Verificación de documento ---- */
  if (step === "doc") return (
    <Frame onBack={goBack} title="Verifica tu identidad" cta="Continuar" disabled={!docReady} onCta={goNext}>
      <p className="mx-auto mb-3 max-w-[18.125rem] text-center text-[0.8125rem] leading-snug text-muted-foreground">Sube fotos de tu documento de identidad. Aceptamos DNI, pasaporte o NIE.</p>
      <input ref={file} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Seleccionar foto del documento" onChange={(e) => pick(e.target.files?.[0])} />
      <button onClick={() => file.current?.click()} aria-label={`Subir foto del ${side === "front" ? "anverso" : "reverso"}`} className="relative mx-auto block aspect-[1.6] w-full overflow-hidden rounded-2xl border border-primary/40 shadow-glow">
        {img[side] ? <img src={img[side]!} alt={`Tu documento, ${side === "front" ? "anverso" : "reverso"}`} className="h-full w-full object-cover" /> : <SampleCard side={side} />}
        {!img[side] && <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-background/80 px-3 py-1 text-2xs font-semibold"><Camera size={12} className="mr-1 inline" />Toca para subir tu foto</span>}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-3">{(passport ? (["front"] as const) : (["front", "back"] as const)).map((k) => <button key={k} aria-pressed={side === k} onClick={() => { setSide(k); if (!img[k]) window.setTimeout(() => file.current?.click(), 0); }} className={"relative overflow-hidden rounded-xl border-2 p-1 " + (side === k ? "border-primary shadow-glow" : "border-border")}><span className="block aspect-[1.6] overflow-hidden rounded-lg">{img[k] ? <img src={img[k]!} alt="" className="h-full w-full object-cover" /> : <SampleCard side={k} />}</span><span className="block py-1 text-2xs font-semibold">{k === "front" ? "Anverso" : "Reverso"}</span>{img[k] && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"><Check size={14} /></span>}</button>)}</div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={passport} onChange={(e) => { setPassport(e.target.checked); setSide("front"); }} className="accent-[var(--primary)]" />Mi documento es un pasaporte (solo una cara)</label>
      <ul className="mt-3 space-y-2 text-[0.8125rem]">{["Foto nítida y completa", "Sin brillos ni cortes", "Formato JPG o PNG", "Máx. 10 MB"].map((x) => <li key={x} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"><Check size={12} /></span>{x}</li>)}</ul>
      <p className="mt-3 text-2xs text-muted-foreground">DEMO: la foto se queda en tu dispositivo; no se envía ni se guarda.</p>
    </Frame>
  );

  /* ---- Lámina 5 · Selfie en tiempo real (cámara real + detección local) ---- */
  if (step === "selfie") return (
    <Frame onBack={goBack} center>
      <SelfieStep key={selfieKey} onDone={(_f, manual) => { setSelfieManual(manual); if (manual && outcome === "approved") setOutcome("review"); goNext(); }} />
    </Frame>
  );

  if (step === "phone") return (
    <Frame onBack={goBack} title="Tu teléfono" cta="Enviar código" disabled={phone.replace(/\D/g, "").length < 9} onCta={() => { setWait(30); setStep("sms"); }}>
      <p className="mb-3 text-sm text-muted-foreground">Te enviaremos un código por SMS. Un teléfono, una cuenta.</p>
      <label className="block text-xs text-muted-foreground">Número de teléfono<div className="mt-1 flex gap-2"><span className="grid h-12 place-items-center rounded-xl border border-border bg-card px-3 text-sm">🇪🇸 +34</span><input type="tel" inputMode="tel" autoFocus value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} placeholder="600 000 000" className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-base text-foreground" /></div></label>
      {phone && phone.replace(/\D/g, "").length < 9 && <p className="mt-2 text-xs text-live">Introduce los 9 dígitos.</p>}
      <p className="mt-3 text-2xs text-muted-foreground">DEMO: no se envía ningún SMS real.</p>
    </Frame>
  );

  if (step === "sms") return (
    <Frame onBack={goBack} title="Código SMS" cta="Continuar" disabled={code.length < 6} onCta={goNext}>
      <p className="mb-3 text-sm text-muted-foreground">Introduce el código de 6 cifras enviado a +34 {phone}.</p>
      <input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" aria-label="Código SMS" className="h-14 w-full rounded-xl border border-border bg-card text-center text-2xl tracking-[0.5em] text-foreground" />
      <div className="mt-3 flex items-center justify-between text-xs"><button className="text-primary disabled:text-muted-foreground" disabled={wait > 0} onClick={() => { setWait(30); toast("Código reenviado"); }}>{wait > 0 ? `Reenviar en ${wait} s` : "Reenviar código"}</button><button className="text-muted-foreground" onClick={() => { setStep("phone"); setCode(""); }}>Cambiar número</button></div>
      <p className="mt-3 text-2xs text-muted-foreground">DEMO: sirve cualquier código de 6 cifras.</p>
    </Frame>
  );

  if (step === "social") return (
    <Frame onBack={goBack} title="Redes sociales" cta="Continuar" disabled={!socialReady} onCta={goNext}>
      <p className="mb-3 text-sm text-muted-foreground">Vincula al menos una cuenta. Sirve para reforzar la confianza; no se publica nada.</p>
      <div className="space-y-2.5">{Object.keys(social).map((n) => <label key={n} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 pl-3 text-sm"><span className="w-20 shrink-0 font-semibold">{n}</span><input value={social[n]} onChange={(e) => setSocial({ ...social, [n]: e.target.value.replace(/\s/g, "") })} placeholder="@tu_usuario" aria-label={`Usuario de ${n}`} className="h-10 min-w-0 flex-1 rounded-lg bg-background px-3 text-foreground" /></label>)}</div>
      <p className="mt-3 text-2xs text-muted-foreground">DEMO: no se conecta ninguna red. En producción se comprobará que la cuenta es tuya (OAuth o código en la bio).</p>
    </Frame>
  );

  if (step === "creator") return (
    <Frame onBack={goBack} title="Verificación de creador" cta="Continuar" disabled={!cat || about.trim().length < 10} onCta={goNext}>
      <p className="mb-3 text-sm text-muted-foreground">Cuéntanos a qué te dedicas. Una persona del equipo lo revisa; el distintivo Creador es aparte de tu identidad.</p>
      <div className="flex flex-wrap gap-2">{["Modelo", "Artista", "Músico", "Creador de contenido", "Deportista", "Otro"].map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} maxLength={300} placeholder="Enlace a tu portfolio o una descripción de tu trabajo (mín. 10 caracteres)" aria-label="Sobre tu trabajo" className="mt-3 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm text-foreground" />
      <p className="mt-2 text-2xs text-muted-foreground">DEMO: no se envía nada.</p>
    </Frame>
  );

  /* ---- Lámina 6 · Proceso y resultado ---- */
  if (step === "processing") return (
    <Frame center>
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="spot-pin-glow grid h-28 w-28 place-items-center rounded-3xl border-2 border-[var(--spot-fuchsia)]/70 bg-card/60"><Star size={64} /></span>
        <h1 className="mt-6 text-[1.5rem] font-bold">{progress < CHECKS.length ? "Verificando..." : "Casi listo…"}</h1>
        <ul className="mt-5 w-full max-w-[16.25rem] space-y-3" aria-live="polite">{CHECKS.map((c, i) => <li key={c} className={"flex items-center gap-3 text-[0.9375rem] transition-opacity " + (i < progress ? "opacity-100" : "opacity-30")}><span className={"grid h-6 w-6 place-items-center rounded-full " + (i < progress ? "bg-emerald-500 text-white" : "border border-muted-foreground")}>{i < progress && <Check size={14} />}</span>{c}</li>)}</ul>
        <div className="mt-8 w-full rounded-xl border border-dashed border-border p-3 text-left"><p className="text-2xs font-semibold text-muted-foreground">DEMO · ELIGE EL RESULTADO A VER (sin proveedor de identidad conectado)</p><div className="mt-2 flex flex-wrap gap-1.5">{OUTCOMES.map(([k, l]) => <Chip key={k} active={outcome === k} onClick={() => setOutcome(k)}>{l}</Chip>)}</div></div>
      </div>
    </Frame>
  );

  return (
    <Frame cta="Continuar" onCta={onBack}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="spot-pin-glow grid h-28 w-28 place-items-center rounded-full border-2 border-[var(--spot-fuchsia)]/70 bg-card/60"><Star size={64} /></span>
        <h1 className="mt-6 text-[1.5625rem] font-bold">¡Verificación completada!</h1>
        <p className="mt-2 max-w-[16.25rem] text-[0.875rem] leading-snug text-muted-foreground">{tierInfo[idTier].done}</p>
        <p className="mt-6 flex items-center gap-1.5 text-[0.75rem] text-emerald-400"><BadgeCheck size={14} />Identidad comprobada · interna, nadie ve tus datos legales</p>
      </div>
    </Frame>
  );
}

function Explain() {
  const rows = [[ShieldCheck, "Identidad comprobada", "Interna. Solo Spotly la conoce. Nadie ve tus datos legales."], [BadgeCheck, "Distintivos públicos", "Creador, personaje o negocio. Son aparte y se solicitan por separado."], [Sparkles, "Premium", "Suscripción con funciones extra. No es verificación."]] as const;
  return <div className="mt-4 space-y-2">{rows.map(([I, t, d], i) => <div key={t} className="flex gap-3 rounded-xl border border-border bg-card p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary"><I size={16} /></span><span><strong className="block text-sm">{"ABC"[i]}) {t}</strong><small className="text-muted-foreground">{d}</small></span></div>)}</div>;
}

function PhoneChange({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<"new" | "code" | "done">("new");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  return (
    <BottomSheet title="Cambiar mi teléfono" onClose={onClose} z={70}>
      {s === "new" && <><p className="text-sm text-muted-foreground">Confirmaremos el número nuevo con un SMS. Tu identidad no cambia.</p><input type="tel" value={n} onChange={(e) => setN(e.target.value.replace(/[^\d ]/g, ""))} placeholder="Nuevo número" aria-label="Nuevo número" className="mt-3 h-12 w-full rounded-xl border border-border bg-card px-3 text-foreground" /><Button className="mt-3 w-full" disabled={n.replace(/\D/g, "").length < 9} onClick={() => setS("code")}>Enviar código</Button></>}
      {s === "code" && <><input inputMode="numeric" maxLength={6} value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ""))} placeholder="Código de 6 cifras" aria-label="Código" className="h-12 w-full rounded-xl border border-border bg-card px-3 text-center tracking-widest text-foreground" /><Button className="mt-3 w-full" disabled={c.length < 6} onClick={() => setS("done")}>Confirmar</Button></>}
      {s === "done" && <StateCard icon={Check} title="Teléfono actualizado" text="Demostración: el cambio real se hará en el servidor con reverificación." action="Listo" onAction={onClose} />}
    </BottomSheet>
  );
}

function Recovery({ onClose }: { onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <BottomSheet title="Recuperar mi cuenta" onClose={onClose} z={70}>
      {sent ? <StateCard icon={Clock} tone="premium" title="Solicitud enviada" text="Revisaremos tu caso con verificación de identidad. Te avisaremos en 24–48 h." action="Cerrar" onAction={onClose} /> : <>
        <p className="mb-2 text-sm text-muted-foreground">¿Qué ha pasado?</p>
        <div className="space-y-2">{["He perdido el acceso a mi teléfono", "Creo que otra persona usa mi cuenta", "Ya tenía una cuenta y me dice que hay duplicidad"].map((r) => <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r} className={"w-full rounded-xl border p-3 text-left text-sm " + (reason === r ? "border-primary bg-primary/10" : "border-border")}>{r}</button>)}</div>
        <Button className="mt-3 w-full" disabled={!reason} onClick={() => setSent(true)}>Enviar solicitud</Button>
      </>}
    </BottomSheet>
  );
}
