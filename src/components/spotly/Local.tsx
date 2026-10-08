import { useState } from "react";
import { Bookmark, CalendarCheck, Clock, Flame, MapPin, Megaphone, Mic, Minus, Navigation, Pause, Phone, Plus, Store, Trash2, Zap, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, Chip, Screen, SponsoredTag, StateCard, Toggle, Trust, Waveform } from "./kit";
import { Checkout } from "./Credits";
import { useApp } from "./app-context";
import { useGate } from "./Voice";
import { VoiceRecordTile } from "./VoiceRecord";
import { VoiceItem, VoiceThread } from "./VoiceThread";
import { sampleThread } from "@/lib/voice/samples";
import { formatClock, type VoiceClip } from "@/lib/voice/recorder";
import { addOffer, fmtRemaining, removeOffer, setAvailability, setCampaign, useNow, useStore, type Campaign } from "@/lib/store";
import { availabilityMaxSlots, availabilityWindows, campaignBudget, campaignDays, campaignRadii, eur, estimateReach, flashDurations } from "@/lib/spotlyConfig";
import { bizStats, businesses, campaignEligible, fmtDist, type Business } from "@/lib/sampleData";

export const getBiz = (id: string) => businesses.find((b) => b.id === id) ?? businesses[0]!;
const MINE = "carmen";

/* ---------- Tarjeta de Spot patrocinado (publicidad nativa de voz) ---------- */
export function SponsoredSpot({ b, label = "Patrocinado" }: { b: Business; label?: string }) {
  const app = useApp();
  const { bizAvailability, bizOffers } = useStore();
  const now = useNow();
  const [reserve, setReserve] = useState(false);
  const av = b.mine && bizAvailability?.on && bizAvailability.until > now ? bizAvailability : null;
  const slots = av?.slots ?? b.slots;
  const offer = b.mine ? bizOffers.find((o) => o.endsAt > now) : undefined;
  return (
    <article className="spot-feed-card mx-3 overflow-hidden rounded-2xl bg-card">
      <button className="relative block w-full" onClick={() => app.openBiz(b.id)} aria-label={`Abrir perfil de ${b.name}`}>
        <img src={b.img} alt="" width={1024} height={640} loading="lazy" className="aspect-[16/9] w-full object-cover" />
        <span className="absolute left-3 top-3 flex gap-1.5"><SponsoredTag label={label} />{slots ? <span className="rounded bg-primary px-1.5 py-0.5 text-4xs font-bold text-primary-foreground">DISPONIBLE AHORA</span> : null}</span>
      </button>
      <div className="p-3">
        <div className="flex items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Store size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{b.name}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} />A {fmtDist(b.distM)} · <span className={b.open ? "text-primary" : ""}>{b.open ? "Abierto ahora" : "Cerrado"}</span></p></div></div>
        {(offer || slots) && <p className="mt-2 flex flex-wrap gap-1.5 text-2xs font-semibold">{offer && <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-1 text-live"><Flame size={12} />Oferta activa: {offer.discount}% · {fmtRemaining(offer.endsAt - now)}</span>}{slots ? <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">{slots} huecos {av ? `· próximos ${Math.round((av.until - now) / 60000)} min` : ""}</span> : null}</p>}
        <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-secondary p-1">
          <button aria-label="Escuchar oferta" onClick={() => toast("Oferta de ejemplo: no tiene audio. Las ofertas que graban los negocios se escuchan aquí.")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Volume2 size={15} /></button>
          <span className="shrink-0 text-2xs font-semibold">Escuchar oferta</span><Waveform active={false} seed={b.name.length} /><span className="pr-2 text-xs">{b.voiceDur}</span>
        </div>
        <p className="mt-2 text-sm italic text-foreground/85">“{b.voice}”</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
          <a href={`tel:${b.phone}`} onClick={() => toast(`Llamando a ${b.name}`)} className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-primary/20 text-primary"><Phone size={13} />LLAMAR</a>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.name + " " + b.address)}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-primary/20 text-primary"><Navigation size={13} />CÓMO LLEGAR</a>
          <button onClick={() => setReserve(true)} className="min-h-11 rounded-full bg-spot-gradient">RESERVAR</button>
        </div>
      </div>
      {reserve && <Reserve b={b} onClose={() => setReserve(false)} />}
    </article>
  );
}

function Reserve({ b, onClose }: { b: Business; onClose: () => void }) {
  const [slot, setSlot] = useState("");
  const [pay, setPay] = useState(false);
  const slots = ["+15 min", "+30 min", "+1 h", "+2 h"];
  const gate = useGate({ verified: true, online: true });
  return (
    <BottomSheet title={`Reservar en ${b.name}`} onClose={onClose} z={70}>
      {gate ?? <>
        <p className="text-xs text-muted-foreground">{b.open ? "Elige cuándo quieres ir." : "Ahora está cerrado: reserva para cuando abra."}</p>
        <div className="mt-3 flex flex-wrap gap-2">{slots.map((s) => <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{s}</Chip>)}</div>
        <Button className="mt-4 w-full rounded-full bg-spot-gradient text-foreground" disabled={!slot} onClick={() => setPay(true)}>Continuar</Button>
        <p className="mt-2 text-2xs text-muted-foreground">La reserva no tiene coste en Spotly. El pago del servicio se hace en el local.</p>
      </>}
      {pay && <Checkout title={`Reserva ${slot} · ${b.name}`} kind="physical" lines={[{ label: "Reserva sin coste", eur: 0 }]} onClose={() => setPay(false)} onPaid={() => { toast.success("Reserva iniciada"); onClose(); }} />}
    </BottomSheet>
  );
}

/* ---------- Oferta flash ---------- */
export function FlashOfferCard() {
  const { bizOffers } = useStore();
  const app = useApp();
  const now = useNow();
  const mine = bizOffers.find((o) => o.endsAt > now);
  const b = mine ? getBiz(MINE) : getBiz("salax");
  const title = mine ? `${mine.discount}% de descuento · ${mine.title}` : b.staticOffer!.title;
  const left = mine ? mine.endsAt - now : now ? 43 * 60_000 : 0;
  return (
    <article className="mx-3 overflow-hidden rounded-2xl border border-live/60 bg-gradient-to-br from-live/20 to-card p-4">
      <div className="flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-extrabold text-live"><Flame size={15} />🔥 OFERTA FLASH</span><span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-bold tabular-nums">{left ? fmtRemaining(left) : "—"}</span></div>
      <button onClick={() => app.openBiz(b.id)} className="mt-2 block w-full text-left"><strong className="block text-lg leading-tight">{title}</strong><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Store size={12} />{b.name} · <MapPin size={12} />{fmtDist(b.distM)}</span></button>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
        <a href={`tel:${b.phone}`} className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-background/50"><Phone size={13} />Llamar</a>
        <button onClick={app.goMap} className="min-h-11 rounded-full bg-background/50">Mapa</button>
        <button onClick={() => app.openBiz(b.id)} className="min-h-11 rounded-full bg-spot-gradient">Ver oferta</button>
      </div>
    </article>
  );
}

/* ---------- Perfil de negocio ---------- */
export function BusinessProfile({ id, onBack }: { id: string; onBack: () => void }) {
  const b = getBiz(id);
  const app = useApp();
  const { bizOffers, bizAvailability, bizCampaign } = useStore();
  const now = useNow();
  const [saved, setSaved] = useState(false);
  const [reserve, setReserve] = useState(false);
  const [talk, setTalk] = useState(false);
  const offer = b.mine ? bizOffers.find((o) => o.endsAt > now) : undefined;
  const av = b.mine && bizAvailability?.on && bizAvailability.until > now ? bizAvailability : null;
  const sponsored = b.paidBy === "other" || (b.mine && !!bizCampaign && campaignEligible(bizCampaign, b.distM, new Date()));
  return (
    <Screen title={b.name} sub={`${b.category} · a ${fmtDist(b.distM)}`} onBack={onBack} z={58}
      footer={<div className="grid grid-cols-3 gap-2 text-xs font-semibold">
        <a href={`tel:${b.phone}`} className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-border bg-secondary"><Phone size={14} />Llamar</a>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.name + " " + b.address)}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-border bg-secondary"><Navigation size={14} />Cómo llegar</a>
        <button onClick={() => setReserve(true)} className="min-h-12 rounded-full bg-spot-gradient"><CalendarCheck size={14} className="mr-1 inline" />Reservar</button>
      </div>}>
      <div className="relative overflow-hidden rounded-2xl"><img src={b.img} alt={b.name} className="aspect-[16/9] w-full object-cover" /><span className="absolute left-3 top-3 flex gap-1.5">{sponsored && <SponsoredTag />}{av && <span className="rounded bg-primary px-1.5 py-0.5 text-4xs font-bold text-primary-foreground">DISPONIBLE AHORA</span>}</span><Button variant="icon" size="icon" aria-label={saved ? "Quitar de guardados" : "Guardar negocio"} onClick={() => { setSaved(!saved); toast(saved ? "Quitado de guardados" : "Negocio guardado"); }} className="absolute right-3 top-3 bg-background/75"><Bookmark size={16} fill={saved ? "currentColor" : "none"} /></Button></div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (b.open ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>{b.open ? "Abierto ahora" : "Cerrado"}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={12} />{b.hours}</span></p>
      <p className="mt-2 text-sm text-foreground/90">{b.about}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{b.address}</p>
      {offer && <div className="mt-3 rounded-xl border border-live/50 bg-live/10 p-3 text-sm"><b className="flex items-center gap-1 text-live"><Flame size={14} />OFERTA FLASH · {offer.discount}%</b>{offer.title} · termina en {fmtRemaining(offer.endsAt - now)}</div>}
      {av && <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm"><b className="text-primary">Tengo disponibilidad ahora</b><br />{av.slots} huecos · próximos {Math.max(1, Math.round((av.until - now) / 60000))} min</div>}
      {b.staticOffer && !b.mine && <div className="mt-3 rounded-xl border border-live/50 bg-live/10 p-3 text-sm"><b className="flex items-center gap-1 text-live"><Flame size={14} />OFERTA FLASH</b>{b.staticOffer.title}</div>}
      <h3 className="mb-2 mt-4 text-sm font-bold">Mensaje de voz del negocio</h3>
      <VoiceItem note={{ ...sampleThread(`biz-voz:${b.id}`, [{ key: "voz", name: b.name, img: b.img, minsAgo: 180, dur: b.voiceDur, likes: 0 }])[0]!, liked: false, replies: 0 }} />
      <div className="mb-2 mt-4 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Lo que dice la gente</h3><Button size="sm" variant="secondary" onClick={() => setTalk(true)}><Mic size={14} />Opinar con voz</Button></div>
      <VoiceThread threadId={`biz:${b.id}`} seed={sampleThread(`biz:${b.id}`, [{ key: "a", name: "Laura", minsAgo: 1440, dur: "0:11", likes: 0 }, { key: "b", name: "Carlos", minsAgo: 4320, dur: "0:07", likes: 0 }])} root={{ name: b.name, atMs: 0, durationMs: 0 }} composerOpen={talk} onComposerClose={() => setTalk(false)} emptyText="Aún no hay opiniones. Sé la primera voz." />
      <p className="mt-1 text-2xs text-muted-foreground">El pago de publicidad da visibilidad, no una mejor reputación.</p>
      {b.mine && <Button variant="secondary" className="mt-4 w-full" onClick={() => { onBack(); app.open("local"); }}><Store size={16} />Gestionar mi negocio</Button>}
      {reserve && <Reserve b={b} onClose={() => setReserve(false)} />}
    </Screen>
  );
}

/* ---------- Panel de negocio (Spotly Local) ---------- */
type Tab = "Resumen" | "Campañas" | "Ofertas" | "Disponibilidad";
export function LocalDashboard({ onBack }: { onBack: () => void }) {
  const { demo } = useStore();
  /* Las herramientas para negocios aún no tienen servidor ni cobro: con una cuenta real se explican sin fingir. */
  if (!demo) return (
    <Screen title="Spotly Local" sub="Para negocios" onBack={onBack} z={52}>
      <StateCard icon={Store} tone="premium" title="Para negocios, muy pronto" text="Campañas por radio y horario, ofertas flash con tu voz y disponibilidad en tiempo real para tu local. Llegarán con la facturación a negocios y los pagos de App Store y Google Play." action="Entendido" onAction={onBack} />
      <div className="mt-4"><Trust>Lo pagado siempre irá marcado como «Patrocinado» y Spotly solo medirá lo que puede medir: impresiones, reproducciones y clics.</Trust></div>
    </Screen>
  );
  return <LocalDashboardDemo onBack={onBack} />;
}

function LocalDashboardDemo({ onBack }: { onBack: () => void }) {
  const b = getBiz(MINE);
  const { bizCampaign: c, bizOffers, bizAvailability: av } = useStore();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("Resumen");
  const [wizard, setWizard] = useState(false);
  if (wizard) return <CampaignWizard onBack={() => setWizard(false)} onDone={() => { setWizard(false); setTab("Campañas"); }} />;
  return (
    <Screen title="Spotly Local" sub={b.name} onBack={onBack} z={52}>
      <div className="relative overflow-hidden rounded-2xl"><img src={b.img} alt="" className="h-28 w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" /><span className="absolute bottom-2 left-3 flex items-center gap-2"><Store className="text-primary" size={20} /><span><strong className="block">{b.name}</strong><small className="text-muted-foreground">Llega a quien está cerca, ahora</small></span></span></div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{(["Resumen", "Campañas", "Ofertas", "Disponibilidad"] as Tab[]).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}</div>

      {tab === "Resumen" && <>
        <div className="mt-2 grid grid-cols-2 gap-2">{bizStats.kpis.map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-card p-3"><strong className="block text-xl">{v}</strong><small className="text-2xs text-muted-foreground">{k}</small></div>)}</div>
        <Bars title="Rendimiento por horario" data={bizStats.byHour} />
        <Bars title="Rendimiento por radio" data={bizStats.byRadius} />
        <div className="mt-3"><Trust>Cifras de ejemplo. Spotly solo mide lo que puede medir: impresiones, reproducciones y clics. No afirma que alguien haya visitado físicamente el local.</Trust></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => setWizard(true)}><Megaphone size={16} />Nueva campaña</Button><Button variant="secondary" onClick={() => setTab("Ofertas")}><Flame size={16} />Oferta flash</Button></div>
      </>}

      {tab === "Campañas" && (c ? <CampaignCard c={c} onNew={() => setWizard(true)} /> : <div className="mt-2"><StateCard icon={Megaphone} title="Aún no tienes campañas" text="Llega a quienes buscan tu tipo de negocio cerca, en tu horario y con tu presupuesto." action="Crear campaña comercial" onAction={() => setWizard(true)} /></div>)}
      {tab === "Ofertas" && <OffersTab offers={bizOffers} now={now} />}
      {tab === "Disponibilidad" && <AvailabilityTab av={av} now={now} />}
    </Screen>
  );
}

function Bars({ title, data }: { title: string; data: readonly (readonly [string, number])[] }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">{title} <span className="text-3xs font-normal text-muted-foreground">(ejemplo)</span></p>
      <div className="mt-3 flex items-end gap-2">
        {data.map(([l, v]) => (
          <div key={l} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-3xs tabular-nums text-muted-foreground">{v}%</span>
            <div className="w-full rounded-t bg-spot-gradient" style={{ height: Math.max(6, Math.round(v * 0.9)) }} />
            <span className="text-3xs text-muted-foreground">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const statusMeta = { active: ["Activa", "text-primary"], paused: ["En pausa", "text-premium"], exhausted: ["Presupuesto agotado hoy", "text-live"], ended: ["Finalizada", "text-muted-foreground"] } as const;
function CampaignCard({ c, onNew }: { c: Campaign; onNew: () => void }) {
  const r = campaignRadii.find((x) => x.id === c.radiusId)!;
  const now = new Date();
  const elig = campaignEligible(c, getBiz(MINE).distM, now);
  const [m, cls] = statusMeta[c.status];
  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between"><strong>Campaña · {getBiz(MINE).category}</strong><span className={"text-xs font-bold " + cls}>{m}</span></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">{[["Radio", r.label], ["Horario", `${c.from}–${c.to}`], ["Días", c.days.join(" ")], ["Presupuesto", `${eur(c.budgetPerDay)}/día × ${c.totalDays} días`]].map(([k, v]) => <div key={k} className="rounded-lg bg-secondary p-2"><dt className="text-3xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
        {c.status === "active" && <p className="mt-2 text-xs text-muted-foreground">{elig ? "Ahora mismo tu anuncio es elegible y aparece como Patrocinado en búsquedas y feed." : "Ahora estás fuera de tu horario o días: el anuncio no se muestra."}</p>}
        {c.status === "exhausted" && <p className="mt-2 text-xs text-live">Has gastado el presupuesto de hoy. Mañana se reactiva automáticamente.</p>}
        {c.status === "ended" && <p className="mt-2 text-xs text-muted-foreground">Campaña finalizada. Ya no se muestra.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(c.status === "active" || c.status === "paused") && <Button variant="secondary" onClick={() => { setCampaign({ ...c, status: c.status === "active" ? "paused" : "active" }); toast(c.status === "active" ? "Campaña en pausa" : "Campaña reactivada"); }}>{c.status === "active" ? "Pausar" : "Reanudar"}</Button>}
          {c.status === "active" && <Button variant="outline" onClick={() => { setCampaign({ ...c, status: "exhausted" }); toast("Demo: presupuesto agotado"); }}>Simular agotada</Button>}
          {c.status !== "ended" && <Button variant="outline" onClick={() => { setCampaign({ ...c, status: "ended" }); toast("Campaña finalizada"); }}>Finalizar</Button>}
          <Button onClick={onNew}>Nueva campaña</Button>
        </div>
      </div>
      <Trust>El anuncio solo se distribuye a personas elegibles dentro de estas condiciones, respetando sus permisos. El negocio nunca recibe la identidad ni la ubicación individual de las personas.</Trust>
    </div>
  );
}

function CampaignWizard({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [radius, setRadius] = useState("2");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("21:00");
  const [days, setDays] = useState<string[]>(campaignDays.slice(0, 5));
  const [budget, setBudget] = useState<number>(campaignBudget.defaultPerDay);
  const [nDays, setNDays] = useState<number>(7);
  const [pay, setPay] = useState(false);
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const gate = useGate({ verified: true, mic: step === 0 });
  const b = getBiz(MINE);
  const total = budget * nDays;
  const [lo, hi] = estimateReach(budget);
  const rad = campaignRadii.find((x) => x.id === radius)!;
  const titles = ["Mensaje de voz", "Radio de la campaña", "Horario y días", "Presupuesto", "Vista previa del anuncio"];
  const can = [!!clip, true, days.length > 0 && from < to, true, true][step]!;
  const preview: Business = { ...b, voice: "Tu mensaje de voz sonará aquí.", voiceDur: clip ? formatClock(clip.durationMs) : "0:00" };
  return (
    <Screen title={titles[step]!} sub={`Crear campaña comercial · paso ${step + 1} de 5`} onBack={() => (step === 0 ? onBack() : setStep(step - 1))} z={60}
      footer={<Button className="h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" disabled={!can || !!gate} onClick={() => (step < 4 ? setStep(step + 1) : setPay(true))}>{step < 4 ? "Continuar" : `Contratar · ${eur(total)}`}</Button>}>
      {gate ?? <>
        {step === 0 && <div className="text-center"><p className="text-sm text-muted-foreground">Menos escribir, más hablar: graba tu oferta en menos de 30 segundos.</p><VoiceRecordTile maxSeconds={30} onChange={setClip} /></div>}
        {step === 1 && <><div className="spot-neon-map relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-border"><span className="spot-radar absolute aspect-square rounded-full bg-accent/10 transition-all" style={{ width: `${20 + campaignRadii.findIndex((x) => x.id === radius) * 15}%` }} /><span className="relative grid h-12 w-12 place-items-center rounded-full bg-spot-gradient shadow-glow"><Store size={20} /></span><span className="absolute bottom-2 rounded-full bg-background/80 px-3 py-1 text-xs font-bold">{rad.label} alrededor de {b.name}</span></div><div className="mt-4 grid grid-cols-3 gap-2">{campaignRadii.map((x) => <button key={x.id} onClick={() => setRadius(x.id)} aria-pressed={radius === x.id} className={"min-h-11 rounded-xl border text-sm font-semibold " + (radius === x.id ? "spot-active-pill border-transparent" : "border-border bg-card")}>{x.label}</button>)}</div></>}
        {step === 2 && <><div className="grid grid-cols-2 gap-3">{([["Desde", from, setFrom], ["Hasta", to, setTo]] as const).map(([l, v, set]) => <label key={l} className="text-xs text-muted-foreground">{l}<input type="time" value={v} onChange={(e) => set(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground" /></label>)}</div>{from >= to && <p className="mt-2 text-xs text-live">La hora de inicio debe ser anterior a la de fin.</p>}<p className="mb-2 mt-4 text-sm font-semibold">Días</p><div className="flex justify-between">{campaignDays.map((d) => <button key={d} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} aria-pressed={days.includes(d)} aria-label={`Día ${d}`} className={"grid h-11 w-11 place-items-center rounded-full border text-sm font-bold " + (days.includes(d) ? "spot-active-pill border-transparent" : "border-border bg-card")}>{d}</button>)}</div><div className="mt-3 flex gap-2"><Button variant="secondary" size="sm" onClick={() => setDays(campaignDays.slice(0, 5))}>Lunes–Viernes</Button><Button variant="secondary" size="sm" onClick={() => setDays([...campaignDays])}>Todos</Button></div></>}
        {step === 3 && <><p className="text-sm font-semibold">Presupuesto diario</p><div className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-card p-3"><Button variant="icon" size="icon" aria-label="Menos" onClick={() => setBudget(Math.max(campaignBudget.minPerDay, budget - campaignBudget.step))}><Minus size={16} /></Button><strong className="text-3xl tabular-nums">{eur(budget)}</strong><Button variant="icon" size="icon" aria-label="Más" onClick={() => setBudget(Math.min(campaignBudget.maxPerDay, budget + campaignBudget.step))}><Plus size={16} /></Button></div><input aria-label="Presupuesto diario" type="range" min={campaignBudget.minPerDay} max={campaignBudget.maxPerDay} step={campaignBudget.step} value={budget} onChange={(e) => setBudget(+e.target.value)} className="mt-3 w-full accent-[var(--primary)]" /><p className="mb-2 mt-4 text-sm font-semibold">Duración</p><div className="flex gap-2">{campaignBudget.days.map((d) => <Chip key={d} active={nDays === d} onClick={() => setNDays(d)}>{d} días</Chip>)}</div><div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm"><p className="flex justify-between"><span className="text-muted-foreground">Total</span><strong>{eur(total)}</strong></p><p className="mt-1 flex justify-between"><span className="text-muted-foreground">Impresiones estimadas al día</span><strong>{lo.toLocaleString("es-ES")}–{hi.toLocaleString("es-ES")}</strong></p></div><p className="mt-2 text-2xs text-muted-foreground">Estimación orientativa; no es una garantía de resultados.</p></>}
        {step === 4 && <><SponsoredSpotPreview b={preview} /><div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card text-sm">{[["Radio", rad.label], ["Horario", `${from}–${to}`], ["Días", days.join(" ")], ["Presupuesto", `${eur(budget)}/día × ${nDays}`], ["Total", eur(total)]].map(([k, v]) => <p key={k} className="flex justify-between p-3"><span className="text-muted-foreground">{k}</span><strong>{v}</strong></p>)}</div><div className="mt-3"><Trust>Se mostrará siempre como “Patrocinado”. Pagar da visibilidad, no significa “mejor {b.category.toLowerCase()}”.</Trust></div></>}
      </>}
      {pay && <Checkout title={`Campaña hiperlocal · ${rad.label} · ${nDays} días`} kind="ads" lines={[{ label: `${eur(budget)}/día × ${nDays} días`, eur: total }]} onClose={() => setPay(false)}
        onPaid={() => { setCampaign({ id: "c" + Date.now(), radiusId: radius, from, to, days, budgetPerDay: budget, totalDays: nDays, message: clip ? formatClock(clip.durationMs) : "0:00", status: "active", startedAt: Date.now() }); toast.success("Campaña creada"); onDone(); }} />}
    </Screen>
  );
}

function SponsoredSpotPreview({ b }: { b: Business }) {
  return <div className="pointer-events-none select-none" aria-label="Vista previa del anuncio"><SponsoredSpot b={b} /></div>;
}

function OffersTab({ offers, now }: { offers: { id: string; title: string; discount: number; endsAt: number }[]; now: number }) {
  const [discount, setDiscount] = useState(30);
  const [dur, setDur] = useState(60);
  const [round, setRound] = useState(0);
  const gate = useGate({ verified: true, mic: true });
  const live = offers.filter((o) => o.endsAt > now);
  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-2xl border border-live/50 bg-live/5 p-4">
        <p className="flex items-center gap-2 font-bold"><Flame className="text-live" size={18} />Nueva oferta flash</p>
        <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">DESCUENTO</p><div className="flex gap-2">{[10, 20, 30, 40, 50].map((d) => <Chip key={d} active={discount === d} onClick={() => setDiscount(d)}>{d}%</Chip>)}</div>
        <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">DURACIÓN</p><div className="flex flex-wrap gap-2">{flashDurations.map((d) => <Chip key={d} active={dur === d} onClick={() => setDur(d)}>{d >= 60 ? `${d / 60} h` : `${d} min`}</Chip>)}</div>
        <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">MENSAJE DE VOZ (opcional)</p>
        {gate ?? <VoiceRecordTile key={round} variant="row" maxSeconds={20} />}
        <Button className="mt-4 w-full" onClick={() => { addOffer({ title: `durante ${dur >= 60 ? dur / 60 + " h" : dur + " min"}`, discount, endsAt: Date.now() + dur * 60_000 }); setRound((n) => n + 1); toast.success("Oferta flash publicada"); }}><Zap size={16} />Publicar oferta flash</Button>
      </div>
      {live.length === 0 ? <StateCard icon={Flame} tone="muted" title="Sin ofertas activas" text="Las ofertas flash aparecen en el feed y en las búsquedas cercanas." /> : live.map((o) => <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-live/15 text-live"><Flame size={18} /></span><span className="flex-1"><strong className="block text-sm">{o.discount}% {o.title}</strong><small className="text-muted-foreground">Termina en {fmtRemaining(o.endsAt - now)}</small></span><Button variant="ghost" size="icon" aria-label="Retirar oferta" onClick={() => { removeOffer(o.id); toast("Oferta retirada"); }}><Trash2 size={16} /></Button></div>)}
    </div>
  );
}

function AvailabilityTab({ av, now }: { av: { on: boolean; slots: number; until: number; radiusKm: number } | null; now: number }) {
  const [slots, setSlots] = useState(3);
  const [win, setWin] = useState(90);
  const [rad, setRad] = useState(2);
  const on = !!av?.on && av.until > now;
  const ended = !!av?.on && av.until <= now;
  return (
    <div className="mt-2 space-y-3">
      <div className={"rounded-2xl border p-4 " + (on ? "border-primary bg-primary/10" : "border-border bg-card")}>
        <div className="flex items-center justify-between"><strong>TENGO DISPONIBILIDAD AHORA</strong><Toggle on={on} label="Tengo disponibilidad ahora" onChange={(v) => { if (v) { setAvailability({ on: true, slots, until: Date.now() + win * 60_000, radiusKm: rad }); toast.success("Ahora apareces como disponible"); } else { setAvailability(null); toast("Disponibilidad retirada"); } }} /></div>
        {on ? <p className="mt-2 text-sm">{av!.slots} huecos · próximos {Math.max(1, Math.round((av!.until - now) / 60000))} min · radio {av!.radiusKm} km</p> : <p className="mt-2 text-xs text-muted-foreground">Si alguien busca “peluquería disponible ahora” y tu campaña es compatible, podrás aparecer destacado.</p>}
        {ended && <p className="mt-2 text-xs text-muted-foreground">Tu ventana de disponibilidad ha terminado.</p>}
      </div>
      {!on && <div className="rounded-2xl border border-border bg-card p-4"><p className="text-sm font-semibold">Huecos disponibles</p><div className="mt-2 flex items-center justify-center gap-5"><Button variant="icon" size="icon" aria-label="Menos huecos" onClick={() => setSlots(Math.max(1, slots - 1))}><Minus size={16} /></Button><strong className="text-3xl tabular-nums">{slots}</strong><Button variant="icon" size="icon" aria-label="Más huecos" onClick={() => setSlots(Math.min(availabilityMaxSlots, slots + 1))}><Plus size={16} /></Button></div><p className="mb-2 mt-4 text-sm font-semibold">Ventana</p><div className="flex flex-wrap gap-2">{availabilityWindows.map((w) => <Chip key={w} active={win === w} onClick={() => setWin(w)}>{w} min</Chip>)}</div><p className="mb-2 mt-4 text-sm font-semibold">Radio</p><div className="flex flex-wrap gap-2">{campaignRadii.slice(1, 5).map((x) => <Chip key={x.id} active={rad === x.km} onClick={() => setRad(x.km)}>{x.label}</Chip>)}</div></div>}
    </div>
  );
}

