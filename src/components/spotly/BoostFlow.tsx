import { useState, type ReactNode } from "react";
import { ChevronRight, Clock, Crosshair, Droplet, Flame, Heart, Sparkle, UserRound, Globe, Landmark, MapPin, Play, Users, Zap, Ghost, TrendingUp, Eye, UserPlus, BarChart3, Check, ShieldCheck, X, Mic, AudioLines } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import { boostAreas, boostLevels, boostRadii, eur, topNowPriceEur, commerce } from "@/lib/spotlyConfig";
import { addTopNow, useStore } from "@/lib/store";
import { Checkout } from "./Credits";
import { useApp } from "./app-context";
import { useGate } from "./Voice";
import { TopBar } from "./kit";

/* Láminas: 3 Opciones · 4 Niveles · 5 Frecuencia · 6 Público · 7 Resumen y pago · 12 Estadísticas */

function Frame({ title, onBack, children, cta, onCta, center, reference }: { title: string; onBack: () => void; children: ReactNode; cta: string; onCta: () => void; center?: ReactNode; reference?: boolean }) {
  return <div className={"fixed inset-0 z-[55] mx-auto flex max-w-[520px] flex-col bg-background " + (reference ? "boost-reference" : "")}>
    <TopBar title={center ? "" : title} onBack={onBack} border={false} transparent />
    {center && <div className="boost-reference-heading shrink-0 px-7 text-center">{center}</div>}
    <main className={"flex-1 space-y-2.5 overflow-y-auto px-6 pb-3 pt-2 " + (reference ? "boost-reference-main" : "")}>{children}</main>
    <div className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"><Button onClick={onCta} className="h-[3.25rem] w-full rounded-full bg-spot-gradient text-base text-foreground shadow-glow">{cta}</Button></div>
  </div>;
}

function Row({ icon, title, sub, right, active, onClick, tone, compact }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; active?: boolean; onClick?: () => void; tone?: string | undefined; compact?: boolean | undefined }) {
  return <Button variant="secondary" aria-pressed={active} onClick={onClick} className={"boost-option flex h-auto w-full min-w-0 items-center justify-start gap-3 whitespace-normal rounded-xl border px-3 text-left transition " + (compact ? "py-2 " : "py-2.5 ") + (active && !tone ? "boost-option-active " : "") + (active && tone ? "boost-sel " : "") + (tone ? "boost-tone-" + tone : "")}>
    {<span className="boost-option-icon grid h-10 w-10 shrink-0 place-items-center rounded-full">{icon}</span>}
    <span className="min-w-0 flex-1"><strong className={"block leading-tight " + (compact ? "text-[0.8125rem]" : "text-[0.875rem]")}>{title}</strong>{sub && <small className="mt-1 block text-2xs font-normal leading-tight text-muted-foreground">{sub}</small>}</span>{right}
  </Button>;
}
const Toggle = ({ on }: { on: boolean }) => <span className={"relative h-6 w-11 shrink-0 rounded-full transition " + (on ? "boost-toggle-on" : "bg-muted")}><span className={"absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all " + (on ? "left-[1.375rem]" : "left-0.5")} /></span>;
const Radio = ({ on }: { on: boolean }) => <span className={"grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 " + (on ? "boost-radio-on border-transparent text-white" : "border-muted-foreground")}>{on && <Check size={12} />}</span>;

const levels = boostLevels;

export function BoostFlow({ onBack, onDone, preview }: { onBack: () => void; onDone: (boosted: boolean) => void; preview?: string | undefined }) {
  const [step, setStep] = useState(0);
  const app = useApp();
  const { incognito } = useStore();
  const incog = incognito.active;
  const [payOpen, setPayOpen] = useState(false);
  const gate = useGate({ verified: true, online: true });
  const [boost, setBoost] = useState(true);
  const [lvl, setLvl] = useState(2);
  const [top, setTop] = useState(true);
  const [freq, setFreq] = useState(2);
  const [scope, setScope] = useState(0);
  const [radius, setRadius] = useState(2);
  const [area, setArea] = useState(0);
  const [schedule, setSchedule] = useState("Ahora");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [audienceFromOptions, setAudienceFromOptions] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const L = levels[lvl]!;
  const total = L.priceEur + (boost && top ? topNowPriceEur : 0);
  const back = () => step === 0 ? onBack() : step === 3 && audienceFromOptions ? (setAudienceFromOptions(false), setStep(0)) : setStep(step - 1);
  const radii = boostRadii.map((r) => r.label);
  const areaIcons = [Crosshair, MapPin, Landmark, Globe] as const;
  const areas = boostAreas.map((a, i) => [a === "Solo mi ciudad" ? "Solo mi ciudad (Sevilla)" : a === "Provincia" ? "Provincia (Sevilla)" : a, areaIcons[i]!] as const);

  if (step === 0) return <Frame title="Publicar tu Spot" onBack={back} cta="Continuar" reference onCta={() => boost ? setStep(1) : onDone(false)}>
    <div className="boost-preview relative overflow-hidden rounded-lg">{preview ? <img src={preview} alt="Vista previa de tu Spot" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-card text-primary"><AudioLines size={72}/></div>}<Button variant="ghost" aria-label="Ver vista previa del Spot" onClick={() => setPreviewOpen(true)} className="absolute inset-0 h-full w-full rounded-none bg-transparent hover:bg-background/10"><span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-accent bg-background/75 shadow-glow"><Play size={32} fill="currentColor" /></span></Button><Button variant="secondary" onClick={onBack} className="absolute bottom-2 right-2 h-8 rounded-full border-border bg-background/80 px-3 text-xs text-foreground">Editar</Button></div>
    <p className="pt-2 text-[0.9375rem] font-semibold">¿Cómo quieres publicar?</p>
    <Row tone="public" onClick={() => incog ? app.open("incognito") : toast("Publicarás en abierto: gratis y visible para todos en Spotly")} icon={<Users size={20} fill="currentColor" />} title={<>Público <span className="font-normal">(Gratis)</span></>} sub="Para todos en Spotly" />
    <Row tone={incog ? "violet" : undefined} onClick={() => app.open("incognito")} icon={<Ghost size={20} fill="currentColor" />} title="Modo Incógnito" sub={incog ? "Activo · toca para gestionar" : "Oculta tu identidad"} right={<Toggle on={incog} />} />
    {incog && <Row active={incognito.protectVoice} icon={<ShieldCheck size={18}/>} title="Voz protegida" sub={incognito.protectVoice ? "Se transformará antes de publicar" : "Sin proteger · cámbialo en Incógnito"} onClick={() => app.open("incognito")} right={<ChevronRight size={20}/>} />}
    <Row tone={boost ? "pink" : undefined} onClick={() => setBoost(!boost)} icon={<Sparkle size={24} fill="currentColor" />} title={<>Impulsar <span className="font-normal text-xs">(más alcance)</span></>} sub="Aparece más veces en el scroll" right={<Toggle on={boost} />} />
    <Row compact tone="flat" onClick={() => { setAudienceFromOptions(true); setStep(3); }} icon={<UserRound size={19} fill="currentColor" />} title="Público objetivo" sub={scope === 0 && area === 0 && radius === 2 ? "Cerca de ti, ciudad, provincia..." : `${scope === 0 && area === 0 ? radii[radius] : "Global"} · ${areas[area]?.[0] ?? "Sevilla"}`} right={<ChevronRight size={20} className="text-foreground" />} />
    <Row compact tone="flat" onClick={() => setScheduleOpen(true)} icon={<Clock size={20} />} title="Programar publicación" sub={schedule === "Ahora" ? "Ahora o más tarde" : schedule} right={<ChevronRight size={20} className="text-foreground" />} />
    {previewOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-background/95 p-5" role="dialog" aria-label="Vista previa de tu Spot"><Button variant="ghost" size="icon" aria-label="Cerrar vista previa" className="absolute right-5 top-[max(3rem,env(safe-area-inset-top))]" onClick={() => setPreviewOpen(false)}><X /></Button>{preview ? <img src={preview} alt="Tu Spot ampliado" className="max-h-[70vh] w-full max-w-md rounded-lg object-contain" /> : <div className="flex items-center gap-3 text-primary"><Mic size={42}/><AudioLines size={90}/></div>}<p className="absolute bottom-16 text-center text-sm text-muted-foreground">Vista previa · el audio de este Spot aún es una demostración.</p></div>}
    {scheduleOpen && <div className="fixed inset-0 z-[70] flex items-end bg-background/75" onClick={() => setScheduleOpen(false)}><div className="w-full rounded-t-lg border-t border-border bg-card p-4 pb-[max(2rem,env(safe-area-inset-bottom))]" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><h3 className="font-bold">Programar publicación</h3><Button variant="ghost" size="icon" aria-label="Cerrar" onClick={()=>setScheduleOpen(false)}><X size={18}/></Button></div><p className="mb-3 text-xs text-muted-foreground">Solo planificación visual; no se publicará automáticamente.</p>{["Ahora","En 1 hora","Esta tarde","Mañana"].map(choice=><Button key={choice} variant="ghost" className="w-full justify-between text-foreground" onClick={()=>{setSchedule(choice);setScheduleOpen(false)}}>{choice}{schedule===choice&&<Check size={16} className="text-primary"/>}</Button>)}</div></div>}
  </Frame>;

  if (step === 1) return <Frame title="" onBack={back} cta="Siguiente" reference onCta={() => setStep(2)} center={<><Zap size={52} fill="currentColor" className="mx-auto text-accent boost-bolt" /><h2 className="mt-2 text-[1.375rem] font-semibold">Impulsar tu Spot</h2><p className="mx-auto mt-2 max-w-[18.125rem] text-[0.8125rem] leading-snug text-muted-foreground">Aparece más veces en el scroll y llega a nuevas personas reales</p></>}>
    {levels.map((l, i) => <Row key={l.id} tone={["plain", "t2", "t5", "t10"][i]!} active={lvl === i} onClick={() => {setLvl(i);setFreq(i)}} icon={i === 0 ? <Droplet size={24} /> : i === 1 ? <MapPin size={19} fill="currentColor"/> : i === 2 ? <Flame size={20} fill="currentColor"/> : <Zap size={21} fill="currentColor"/>} title={<span className="flex flex-wrap items-center gap-2">{l.label}{l.hot && <span className="boost-popular -mt-3 ml-1 rounded-sm px-2 py-1 text-3xs">Más popular</span>}</span>} sub={<>{l.sub}{l.priceEur > 0 && <span className="mt-1 block text-accent"><b>{eur(l.priceEur)}</b><span className="text-muted-foreground"> · {l.minutes} min</span></span>}</>} right={<Radio on={lvl === i} />} />)}
    <Row tone={top ? "top" : undefined} active={top} onClick={() => setTop(!top)} icon={<Heart size={20} fill="currentColor"/>} title="Entrar en la zona superior" sub={<>Aparece en “Ahora en Spotly”<span className="mt-1 block font-bold text-accent">+{eur(topNowPriceEur)}</span></>} right={<Toggle on={top} />} />
  </Frame>;

  if (step === 2) return <Frame title="" onBack={back} cta="Siguiente" onCta={() => setStep(3)} center={<><TrendingUp size={36} className="mx-auto text-primary" /><h2 className="mt-2 text-2xl font-bold">Ajusta la frecuencia</h2><p className="mt-1 text-sm text-muted-foreground">Elige cuántas veces quieres aparecer en el scroll durante el periodo seleccionado</p></>}>
    <div className="rounded-2xl border border-border bg-card p-4">
      <input aria-label="Frecuencia" type="range" min={0} max={3} value={freq} onChange={e => { setFreq(+e.target.value); setLvl(+e.target.value); }} className="w-full accent-[var(--primary)]" />
      <div className="mt-1 flex justify-between text-2xs text-muted-foreground">{["Menos", "Normal", "Más", "Máxima"].map((x, i) => <span key={x} className={freq === i ? "font-bold text-foreground" : ""}>{x}</span>)}</div>
    </div>
    {[["Frecuencia estimada", `x${levels[freq]!.mult} veces más`], ["Duración", `${L.minutes || 30} minutos`], ["Zona", scope === 0 && area === 0 ? `Sevilla (${radii[radius]})` : areas[area]?.[0] ?? "Sevilla"], ["Presupuesto", eur(total)]].map(([k, v]) => <div key={k} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="text-muted-foreground">{k}</span><strong className="text-primary">{v}</strong></div>)}
    <p className="rounded-xl border border-border bg-secondary p-3 text-2xs text-muted-foreground">Tu Spot se mostrará más veces a personas de tu zona. No garantizamos una posición fija, pero aumentamos considerablemente tus oportunidades de aparecer.</p>
  </Frame>;

  if (step === 3) return <Frame title="¿A quién quieres llegar?" onBack={back} cta={audienceFromOptions ? "Guardar público" : "Siguiente"} onCta={() => { setStep(audienceFromOptions ? 0 : 4); setAudienceFromOptions(false); }}>
    <div className="grid grid-cols-2 rounded-full border border-border bg-card p-1">{["Cercanos", "Global"].map((x, i) => <Button key={x} variant="ghost" onClick={() => setScope(i)} className={"h-9 rounded-full text-sm " + (scope === i ? "spot-active-pill text-foreground" : "text-muted-foreground")}>{x}</Button>)}</div>
    <div className="spot-neon-map relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-border bg-card">
      <div className="absolute inset-0 opacity-40" style={{backgroundImage:"linear-gradient(25deg,transparent 47%,var(--spot-blue) 49%,transparent 51%),linear-gradient(150deg,transparent 48%,var(--spot-fuchsia) 50%,transparent 52%)",backgroundSize:"75px 82px"}}/><span className="spot-radar absolute aspect-square rounded-full bg-accent/10 transition-all" style={{ width: `${30 + radius * 18}%` }} /><span className="spot-radar absolute aspect-square w-[30%] rounded-full" />
      {[[18, 22], [70, 18], [80, 60], [25, 70], [55, 80]].map(([x, y], i) => <MapPin key={i} size={16} className="absolute text-accent" style={{ left: `${x}%`, top: `${y}%` }} />)}
      <span className="relative text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-spot-gradient shadow-glow"><MapPin /></span><strong className="mt-1 block text-lg">Sevilla</strong></span>
    </div>
    <div className="grid grid-cols-4 gap-2">{radii.map((r, i) => <Button key={r} variant="secondary" onClick={() => setRadius(i)} className={"h-8 rounded-full px-0 text-xs " + (radius === i ? "spot-active-pill text-foreground" : "border border-border bg-card")}>{r}</Button>)}</div>
    {areas.map(([a, I], i) => <Row key={a} active={area === i} onClick={() => {setArea(i);setScope(i === 0 ? 0 : 1)}} icon={<I size={16} />} title={a} right={<Radio on={area === i} />} />)}
  </Frame>;

  if (step === 4) return <Frame title="Resumen y pago" onBack={back} cta={total === 0 ? "Publicar gratis" : "Impulsar ahora · " + eur(total)} onCta={() => (gate ? undefined : total === 0 ? setStep(5) : setPayOpen(true))}>
    {gate}
    <div className="relative overflow-hidden rounded-2xl"><img src={festival} alt="" className="aspect-[16/8] w-full object-cover" /><span className="absolute inset-0 grid place-items-center"><Play className="text-foreground" fill="currentColor" /></span><span className="absolute bottom-2 right-2 rounded bg-background/70 px-1.5 text-xs">0:32</span></div>
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
      {[[Zap, "Impulso seleccionado", `${L.id === "n" ? "Normal" : L.id} visibilidad`], [Clock, "Duración", `${L.minutes || 30} minutos · ${schedule}`], [MapPin, "Zona", scope === 0 && area === 0 ? `Sevilla (${radii[radius]})` : areas[area]?.[0] ?? "Sevilla"], [Flame, "Zona superior", top ? "Sí (+" + eur(topNowPriceEur) + ")" : "No"], [Ghost, "Modo Incógnito", incog ? "Sí" : "No"]].map(([I, k, v]) => { const Ic = I as typeof Zap; return <p key={k as string} className="flex items-center gap-3"><Ic size={18} className="text-primary" /><span><span className="block">{k as string}</span><small className="text-muted-foreground">{v as string}</small></span></p>; })}
      <p className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span>{eur(total)}</span></p>
    </div>
    <p className="text-xs text-muted-foreground">Verás el precio exacto y elegirás la forma de pago en el siguiente paso. Pagar da más distribución, nunca reputación. Máx. {commerce.frequencyCapPerUserPerDay} impactos por persona y día.</p>
    {payOpen && <Checkout title={`Impulso ${L.id === "n" ? "Normal" : L.id}${top ? " + Top" : ""}`} kind="digital" lines={[{ label: `Impulso ${L.label}`, eur: L.priceEur }, ...(boost && top ? [{ label: "Zona superior · Ahora en Spotly", eur: topNowPriceEur }] : [])]} onClose={() => setPayOpen(false)} onNeedCredits={() => app.open("wallet")} onPaid={() => { if (top && boost) addTopNow("Tu Spot", 60); setStep(5); }} />}
  </Frame>;

  return <Frame title="Resultados de tu impulso" onBack={() => setStep(4)} cta="Volver al Inicio" onCta={() => onDone(true)}>
    <img src={festival} alt="" className="aspect-[16/7] w-full rounded-lg object-cover" /><p className="text-xs text-muted-foreground">Cifras ilustrativas · sin datos reales de alcance.</p>
    <div className="grid grid-cols-2 gap-2">{[[BarChart3, "128.4K", "Impresiones"], [Play, "24.1K", "Reproducciones"], [UserPlus, "1.2K", "Nuevos seguidores"], [Eye, "842", "Visitas al perfil"]].map(([I, v, k]) => { const Ic = I as typeof Eye; return <div key={k as string} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"><Ic size={18} className="text-primary" /><span><strong className="block">{v as string}</strong><small className="text-2xs text-muted-foreground">{k as string}</small></span></div>; })}</div>
    <div className="rounded-2xl border border-border bg-card p-3"><svg viewBox="0 0 300 110" className="w-full"><defs><linearGradient id="bf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".7" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs><path d="M0 100 L20 92 L40 95 L60 80 L80 84 L100 70 L120 74 L140 60 L160 64 L180 48 L200 52 L220 36 L240 40 L260 22 L280 18 L300 6 L300 110 L0 110Z" fill="url(#bf)" /><path d="M0 100 L20 92 L40 95 L60 80 L80 84 L100 70 L120 74 L140 60 L160 64 L180 48 L200 52 L220 36 L240 40 L260 22 L280 18 L300 6" fill="none" stroke="var(--accent)" strokeWidth="2" /></svg><p className="mt-1 text-center text-xs text-muted-foreground">Alcance durante el periodo de impulso</p></div>
  </Frame>;
}
