import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Camera, Check, ChevronRight, CircleCheck, CreditCard, Crown, EyeOff, Flame, IdCard, Loader2, Phone, ScanFace, ShieldCheck, Sparkles, TrendingUp, Users, Zap, Music2, Instagram, Mic, UserRound, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { usePos } from "@/lib/preview-context";
import sevilleNight from "@/assets/seville-night.jpg";
import mePhoto from "@/assets/spotly-laura.jpg";

const verificationOptions = [
  { name: "Documento de identidad", description: "DNI, pasaporte o NIE", icon: IdCard, tag: "Recomendado" },
  { name: "Selfie en tiempo real", description: "Ejemplo sin análisis facial", icon: ScanFace },
  { name: "Redes sociales", description: "Vincula tu Instagram, TikTok, etc.", icon: Music2 },
  { name: "Número de teléfono", description: "Ejemplo sin envío de SMS", icon: Phone },
  { name: "Verificación de creador", description: "Para modelos, artistas y creadores", icon: Sparkles },
] as const;
const verificationTiers = [
  { name: "Básica", description: "Requiere validación real", icon: BadgeCheck },
  { name: "Premium", description: "Requiere validación real", icon: Sparkles },
  { name: "Creador", description: "Para creadores de contenido", icon: Star },
] as const;

export function Verification({ onBack }: { onBack: () => void }) {
  const pos = usePos();
  const [step, setStep] = useState<"intro" | "method" | "document" | "selfie" | "phone" | "social" | "creator" | "processing" | "complete">("intro");
  const [tier, setTier] = useState(1);
  const [method, setMethod] = useState(0);
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const [pose, setPose] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [social, setSocial] = useState<string[]>([]);
  useEffect(() => {
    if (step !== "processing") return;
    const timeout = window.setTimeout(() => setStep("complete"), 1700);
    return () => window.clearTimeout(timeout);
  }, [step]);
  const goBack = () => {
    if (step === "intro" || step === "complete") onBack();
    else if (step === "method") setStep("intro");
    else if (step === "processing") setStep("selfie");
    else setStep("method");
  };
  const begin = () => {
    if (method === 0) setStep("document");
    else if (method === 1) setStep("selfie");
    else if (method === 2) setStep("social");
    else if (method === 3) setStep("phone");
    else setStep("creator");
  };
  const titles = { intro: "Verificación · demostración", method: "¿Cómo quieres verificarte?", document: "Documento · ejemplo", selfie: "Selfie · ejemplo", phone: "Número de teléfono · ejemplo", social: "Redes sociales · ejemplo", creator: "Creador · ejemplo", processing: "Mostrando resultado…", complete: "Demostración completada" };
  return <div className={`${pos} inset-0 z-50 mx-auto flex w-full max-w-[520px] flex-col bg-background text-foreground`}>
    <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]"><Button variant="ghost" size="icon" onClick={goBack} aria-label="Volver"><ArrowLeft size={20}/></Button><h2 className="text-base font-bold">{titles[step]}</h2></header>
    <main className="flex-1 overflow-y-auto px-4 pb-4">
      {step === "intro" && <div className="flex min-h-full flex-col text-center"><div className="mt-4 flex justify-center"><Sparkles size={32} className="text-accent"/></div><h3 className="mt-3 text-2xl font-bold">Verificación Premium</h3><p className="mt-1 text-sm text-muted-foreground">Vista de ejemplo. No verifica tu identidad ni concede distintivos.</p><div className="mx-auto mt-5 w-full max-w-xs space-y-2 text-left">{[[BadgeCheck,"Asterisco verificado en tu perfil"],[TrendingUp,"Más visibilidad y alcance"],[CircleCheck,"Acceso a funciones exclusivas"],[Users,"Mayor confianza de la comunidad"],[ShieldCheck,"Protección frente a suplantaciones"]].map(([Icon,text]) => {const I = Icon as typeof BadgeCheck; return <div key={text as string} className="flex items-center gap-3 text-sm"><I size={17} className="shrink-0 text-primary"/>{text as string}</div>})}</div><div className="mt-7 grid grid-cols-3 gap-2">{verificationTiers.map((item,i)=><Button key={item.name} variant="secondary" onClick={()=>setTier(i)} className={"relative flex h-32 min-w-0 flex-col whitespace-normal rounded-lg border px-1 text-center " + (tier === i ? "border-accent bg-accent/10 shadow-glow" : "border-border bg-card")}><item.icon size={30} className={i === 1 ? "text-accent" : "text-primary"}/><strong className="mt-2 text-xs">{item.name}</strong><small className="mt-1 text-[10px] font-normal text-muted-foreground">{item.description}</small></Button>)}</div><p className="mt-3 text-xs text-muted-foreground">{verificationTiers[tier]?.description}</p><p className="mt-auto pt-5 text-[11px] text-muted-foreground">Vista de ejemplo · ningún documento ni dato se envía</p></div>}
      {step === "method" && <><p className="mb-4 text-center text-xs text-muted-foreground">Elige el método que prefieras. Puedes combinar varios para aumentar la confianza.</p><div className="space-y-2">{verificationOptions.map((item,i)=><Button key={item.name} variant="secondary" onClick={()=>setMethod(i)} className={"flex h-auto min-h-16 w-full items-center justify-start gap-3 whitespace-normal rounded-lg border p-3 text-left " + (method === i ? "border-primary bg-primary/10" : "border-border bg-card")}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><item.icon size={22}/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{item.name}{"tag" in item && <small className="rounded bg-accent/20 px-1 text-[9px] text-accent">{item.tag}</small>}</span><small className="block text-xs text-muted-foreground">{item.description}</small></span><ChevronRight size={16} className="shrink-0 text-muted-foreground"/></Button>)}</div></>}
      {step === "document" && <><p className="mb-4 text-center text-xs text-muted-foreground">Sube fotos de tu documento de identidad. Aceptamos DNI, pasaporte o NIE.</p><div className="mx-auto max-w-sm rounded-lg border border-primary/50 bg-card p-4"><div className="flex aspect-[1.65] items-center gap-4 rounded-md border border-border bg-secondary p-4"><div className="h-20 w-16 overflow-hidden rounded-md"><img src={mePhoto} alt="Ejemplo de retrato en un documento" className="h-full w-full object-cover"/></div><div className="space-y-2"><div className="h-2 w-28 rounded-full bg-muted"/><div className="h-2 w-20 rounded-full bg-muted"/><div className="h-2 w-24 rounded-full bg-muted"/><small className="text-[10px] text-muted-foreground">Documento ilustrativo</small></div></div></div><div className="mt-3 grid grid-cols-2 gap-3">{[["Anverso",front,()=>setFront(true)],["Reverso",back,()=>setBack(true)]].map(([label,done,action])=><Button key={label as string} variant="secondary" onClick={action as () => void} className="flex h-24 flex-col rounded-lg border border-border bg-card text-xs"><IdCard size={28} className={done ? "text-primary" : "text-muted-foreground"}/>{label as string}{done && <Check size={15} className="text-primary"/>}</Button>)}</div><div className="mt-5 space-y-2">{["Foto nítida y completa","Sin brillos ni cortes","Formato JPG o PNG","Máx. 10 MB"].map(x=><p key={x} className="flex items-center gap-2 text-sm"><CircleCheck size={15} className="text-primary"/>{x}</p>)}</div><p className="mt-4 text-xs text-muted-foreground">Toca cada cara para simular la captura. No se abre la cámara ni se almacenan documentos.</p></>}
      {step === "selfie" && <div className="text-center"><p className="text-xs text-muted-foreground">Mira a la cámara y sigue las instrucciones.</p><div className="relative mx-auto mt-6 h-72 w-56 overflow-hidden rounded-[48%] border-[3px] border-primary shadow-glow"><img src={mePhoto} alt="Ejemplo de selfie" className="h-full w-full object-cover"/><span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs text-primary">En vivo · ejemplo</span></div><p className="mt-5 text-sm font-medium">{["Parpadea y gira la cabeza","Gira la cabeza a la derecha","Sonríe hacia la cámara"][pose]}</p><div className="mt-3 flex justify-center gap-2">{[0,1,2].map(i=><span key={i} className={"h-2 w-2 rounded-full " + (pose===i ? "bg-primary" : "bg-muted")}/>)}</div><Button variant="secondary" onClick={()=>setPose((pose+1)%3)} className="mt-5 rounded-full"><Camera size={16}/>Simular gesto</Button><p className="mt-5 text-xs text-muted-foreground">No se accede a la cámara ni se hace reconocimiento facial.</p></div>}
      {step === "phone" && <div className="space-y-4"><p className="text-sm text-muted-foreground">Introduce tu número para ver el paso de confirmación. No se enviará ningún SMS.</p><label className="block text-xs">Número de teléfono<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="600 000 000" className="mt-1 w-full rounded-lg border border-border bg-card p-3 text-foreground"/></label><label className="block text-xs">Código de ejemplo<input type="text" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="000000" className="mt-1 w-full rounded-lg border border-border bg-card p-3 text-foreground"/></label><p className="text-xs text-muted-foreground">El código es ilustrativo; cualquier combinación de seis cifras permite ver la siguiente pantalla.</p></div>}
      {step === "social" && <><p className="mb-4 text-sm text-muted-foreground">Vinculación visual. No se accede a tus cuentas.</p>{[["Instagram",Instagram],["TikTok",Music2],["Spotly",Mic]].map(([name,Icon])=>{const I=Icon as typeof Mic;return <Button key={name as string} variant="secondary" className="mb-2 h-14 w-full justify-between rounded-lg border border-border" onClick={()=>setSocial(social.includes(name as string) ? social.filter(x=>x!==name) : [...social,name as string])}><span className="flex items-center gap-3"><I size={19} className="text-primary"/>{name as string}</span>{social.includes(name as string)?<Check size={17} className="text-primary"/>:<ChevronRight size={17}/>}</Button>})}</>}
      {step === "creator" && <div className="space-y-4 text-center"><Star size={55} className="mx-auto text-premium"/><h3 className="text-xl font-bold">Creador verificado</h3><p className="text-sm text-muted-foreground">Esta categoría distingue a artistas y creadores. La comprobación de actividad y autoría se añadirá en una fase posterior.</p></div>}
      {step === "processing" && <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><Loader2 size={68} className="animate-spin text-accent"/><h3 className="mt-5 text-xl font-bold">Preparando ejemplo…</h3><p className="mt-3 text-sm text-muted-foreground">No se están validando datos ni usando inteligencia artificial.</p></div>}
      {step === "complete" && <div className="flex min-h-[65vh] flex-col items-center justify-center text-center"><div className="grid h-24 w-24 place-items-center rounded-full bg-spot-gradient shadow-glow"><Sparkles size={48}/></div><h3 className="mt-6 text-2xl font-bold">¡Vista completada!</h3><p className="mt-3 max-w-xs text-sm text-muted-foreground">Esto solo muestra cómo sería el recorrido. No se ha iniciado ninguna solicitud ni se ha verificado tu cuenta: falta elegir un proveedor de identidad.</p><div className="mt-6 w-full space-y-2 text-left">{["No se han recogido documentos","No se ha analizado ningún selfie","Tu perfil sigue sin verificar"].map(x=><p key={x} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs"><ShieldCheck size={16} className="text-primary"/>{x}</p>)}</div></div>}
    </main>
    {step !== "processing" && <footer className="shrink-0 border-t border-border bg-background/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"><Button className="w-full rounded-full bg-spot-gradient" disabled={(step==="document" && (!front || !back)) || (step==="phone" && (phone.trim().length<9 || code.length<6))} onClick={()=>{if(step==="intro")setStep("method");else if(step==="method")begin();else if(step==="document")setStep("selfie");else if(step==="complete")onBack();else setStep("processing")}}>{step==="intro"?"Ver cómo funciona":step==="method"?"Continuar":step==="document"?"Continuar con selfie":step==="complete"?"Volver al perfil":"Ver resultado de ejemplo"}</Button></footer>}
  </div>;
}

const levels = [["Básico", "x2", 20, "≈ 1.000 personas"], ["Plus", "x5", 50, "≈ 3.500 personas"], ["Máximo", "x10", 100, "≈ 9.000 personas"]] as const;
const packs = [["100", "0,99 €"], ["550", "4,99 €"], ["1.200", "9,99 €"]] as const;

export function Wallet({ onBack }: { onBack: () => void }) {
  const [credits, setCreditsRaw] = useState(250);
  const [hist, setHist] = useState<[string, number][]>([["Impulso x2 · Feria de Triana", -20], ["Recarga 550 créditos", 550], ["Incógnito 1 h", -30]]);
  const setCredits = (v: number | ((n: number) => number), label?: string) => { const next = typeof v === "function" ? v(credits) : v; if (label) setHist((h) => [[label, next - credits], ...h]); setCreditsRaw(next); };
  const [pk, setPk] = useState("1.200");
  const [view, setView] = useState<"wallet" | "boost" | "premium">("wallet");
  const [b, setB] = useState({ step: 0, lvl: 1, freq: "24 h", aud: "Cerca (5 km)" });
  const lv = levels[b.lvl]!;
  const cost = lv[2] * (b.freq === "24 h" ? 1 : b.freq === "3 días" ? 2.5 : 5);

  if (view === "premium") return (
    <Shell title="Spotly Premium" onBack={() => setView("wallet")}>
      <div className="rounded-3xl border border-premium/50 bg-spot-surface p-6 text-center"><Crown size={48} className="mx-auto text-premium" /><h3 className="mt-3 text-2xl font-bold">Premium</h3><p className="text-sm text-muted-foreground">Premium no es verificación: son funciones extra.</p></div>
      <div className="mt-5 space-y-2 text-sm">{["Sin anuncios", "Ver quién escuchó tus Spots", "Audios de hasta 3 min", "Incógnito ilimitado", "200 créditos al mes"].map((x) => <p key={x} className="flex gap-2"><Check size={16} className="text-premium" />{x}</p>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2">{[["Mensual", "4,99 €"], ["Anual", "39,99 €"]].map(([p, v]) => <button key={p} onClick={() => toast("El pago se activará en la fase de backend")} className="rounded-2xl border border-border bg-card p-4 hover:border-premium"><strong className="block">{p}</strong><span className="text-premium">{v}</span></button>)}</div>
    </Shell>
  );

  if (view === "boost") return (
    <Shell title={["Impulsar Spot", "Nivel de impulso", "Duración y público", "Confirmar pago", "¡Impulsado!"][b.step]!} onBack={() => b.step === 0 || b.step === 4 ? (setView("wallet"), setB({ ...b, step: 0 })) : setB({ ...b, step: b.step - 1 })}>
      {b.step === 0 && <><img src={sevilleNight} alt="Tu Spot" className="aspect-video w-full rounded-2xl object-cover" /><p className="mt-3 font-semibold">Noche en la Alameda</p><p className="text-xs text-muted-foreground">1,2K escuchas · publicado hace 2 h</p><div className="mt-4 space-y-2">{["Aparece en la franja “Ahora en Spotly”", "Más alcance en Cerca y Para todos", "Destacado en el mapa"].map((x) => <p key={x} className="flex gap-2 text-sm"><Zap size={16} className="text-primary" />{x}</p>)}</div><Button className="mt-6 w-full" onClick={() => setB({ ...b, step: 1 })}>Elegir impulso</Button></>}
      {b.step === 1 && <><div className="space-y-3">{levels.map(([n, m, c, r], i) => <button key={n} onClick={() => setB({ ...b, lvl: i })} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${b.lvl === i ? "border-primary bg-card shadow-glow" : "border-border bg-card"}`}><span className="text-2xl font-extrabold text-primary">{m}</span><span className="flex-1"><strong className="block">{n}</strong><small className="text-muted-foreground">{r}</small></span><span className="text-sm font-semibold">{c} cr</span></button>)}</div><Button className="mt-6 w-full" onClick={() => setB({ ...b, step: 2 })}>Continuar</Button></>}
      {b.step === 2 && <><p className="text-sm font-semibold">Duración</p><div className="mt-2 grid grid-cols-3 gap-2">{["24 h", "3 días", "7 días"].map((f) => <button key={f} onClick={() => setB({ ...b, freq: f })} className={`rounded-xl py-3 text-sm ${b.freq === f ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{f}</button>)}</div><p className="mt-5 text-sm font-semibold">Público</p><div className="mt-2 space-y-2">{["Cerca (5 km)", "Toda la ciudad", "Seguidores"].map((a) => <button key={a} onClick={() => setB({ ...b, aud: a })} className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm ${b.aud === a ? "border-primary" : "border-border"}`}>{a}{b.aud === a && <Check size={16} className="text-primary" />}</button>)}</div><Button className="mt-6 w-full" onClick={() => setB({ ...b, step: 3 })}>Revisar</Button></>}
      {b.step === 3 && <><div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">{[["Nivel", `${lv[0]} ${lv[1]}`], ["Duración", b.freq], ["Público", b.aud], ["Total", `${cost} créditos`], ["Saldo tras pago", `${credits - cost} créditos`]].map(([k, v]) => <p key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><strong>{v}</strong></p>)}</div>{credits < cost && <p className="mt-3 text-center text-sm text-live">Créditos insuficientes</p>}<Button className="mt-6 w-full" onClick={() => { if (credits < cost) { setView("wallet"); setB({ ...b, step: 0 }); return; } setCredits(credits - cost, `Impulso ${lv[1]} · ${b.freq}`); setB({ ...b, step: 4 }); }}>{credits < cost ? "Recargar créditos" : `Pagar ${cost} créditos`}</Button></>}
      {b.step === 4 && <div className="pt-6 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-spot-gradient shadow-glow"><Zap size={40} /></div><h3 className="mt-4 text-2xl font-bold">Spot impulsado {lv[1]}</h3><p className="text-sm text-muted-foreground">{b.aud} · {b.freq}</p><div className="mt-6 grid grid-cols-3 gap-2">{[[TrendingUp, "+340%", "Alcance"], [Users, "2,1K", "Escuchas"], [Flame, "86", "Nuevos"]].map(([I, v, l]) => { const Ic = I as typeof Zap; return <div key={String(l)} className="rounded-xl border border-border bg-card p-3"><Ic size={18} className="mx-auto text-primary" /><strong className="block">{String(v)}</strong><small className="text-muted-foreground">{String(l)}</small></div>; })}</div><p className="mt-2 text-[11px] text-muted-foreground">Estimación de ejemplo</p><Button className="mt-6 w-full" onClick={() => { setView("wallet"); setB({ ...b, step: 0 }); }}>Listo</Button></div>}
    </Shell>
  );

  return (
    <Shell title="Wallet y créditos" onBack={onBack}>
      <div className="rounded-2xl bg-spot-gradient p-5 shadow-glow"><p className="text-sm opacity-90">Saldo disponible</p><p className="text-4xl font-extrabold">{credits} <span className="text-base font-semibold">créditos</span></p></div>
      <Button className="mt-4 w-full" onClick={() => setView("boost")}><Zap size={18} />Impulsar un Spot</Button>
      <h3 className="mt-6 font-bold">Créditos Spotly</h3><p className="text-xs text-muted-foreground">Usa créditos para impulsar, modo incógnito, zona superior, seguidores y más.</p>
      <div className="mt-2 space-y-2">{([["500", "10% extra", "4,99 €", false], ["1.200", "20% extra", "9,99 €", true], ["3.000", "30% extra", "19,99 €", false]] as const).map(([c, x, p, hot]) => <button key={c} onClick={() => setPk(c)} className={"relative flex w-full items-center justify-between rounded-2xl border p-4 text-left " + (pk === c ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card")}>{hot && <span className="absolute -top-2 right-3 rounded bg-spot-gradient px-2 py-0.5 text-[10px] font-semibold">Más popular</span>}<span><strong className="block">{c} créditos</strong><small className="text-muted-foreground">({x})</small></span><strong>{p}</strong></button>)}</div>
      <button className="mt-3 w-full rounded-full bg-spot-gradient py-3.5 font-semibold shadow-glow" onClick={() => { setCredits((v) => v + Number(pk.replace(".", "")), `Recarga ${pk} créditos`); toast.success(`+${pk} créditos añadidos (demo)`); }}>Comprar créditos</button>
      <div className="mt-6 space-y-2">{([[EyeOff, "Modo Incógnito · 1 h", 30], [Flame, "Destacar en Hot Spots", 50]] as const).map(([I, t, c]) => <button key={t} onClick={() => { if (credits < c) { toast.error("Créditos insuficientes"); return; } setCredits((v) => v - c, t); toast.success(`${t} activado`); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left"><I className="text-accent" /><span className="flex-1 text-sm font-medium">{t}</span><small className="text-primary">{c} cr</small></button>)}</div>
      <button onClick={() => setView("premium")} className="mt-6 flex w-full items-center gap-3 rounded-xl border border-premium/50 bg-card p-4 text-left"><Crown className="text-premium" /><div className="flex-1"><strong className="block text-sm">Spotly Premium</strong><small className="text-muted-foreground">Más funciones, sin anuncios</small></div><span className="text-sm text-premium">Ver ›</span></button>
      <h3 className="mt-6 font-bold">Movimientos</h3>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">{hist.slice(0, 6).map(([t, v], i) => <p key={i} className="flex items-center justify-between p-3 text-sm"><span>{t}</span><strong className={v > 0 ? "text-primary" : "text-muted-foreground"}>{v > 0 ? "+" : ""}{v} cr</strong></p>)}</div>
    </Shell>
  );
}
