import { useState } from "react";
import { BadgeCheck, Calendar, CheckCircle2, ChevronRight, Play, Plus, Share2, EyeOff, MapPin, Mic, Music, Radio, ShieldCheck, Sparkles, Trophy, Users, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { useApp } from "./app-context";
import { useStore } from "@/lib/store";
import sevilleNight from "@/assets/seville-night.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";

/* ---------- Comunidades de voz ---------- */
const communities = [
  { name: "Música en directo", icon: Music, members: "12,4K", live: 3 },
  { name: "Gastronomía local", icon: Utensils, members: "8,1K", live: 1 },
  { name: "Deporte y quedadas", icon: Trophy, members: "5,7K", live: 0 },
  { name: "Cultura y barrio", icon: Sparkles, members: "3,9K", live: 2 },
];

function LiveRoom({ room, onLeave }: { room: string; onLeave: () => void }) {
  const [hand, setHand] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div><span className="rounded bg-live px-2 py-0.5 text-[10px] font-bold">● EN DIRECTO</span><h2 className="mt-1 font-bold">{room}</h2><small className="text-muted-foreground">24 escuchando</small></div>
        <Button variant="outline" size="sm" onClick={onLeave}>Salir</Button>
      </header>
      <main className="flex-1 overflow-y-auto p-5">
        <p className="text-xs font-bold tracking-wider text-muted-foreground">HABLANDO</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {["Laura", "Carlos", ...(speaking ? ["Tú"] : [])].map((n, i) => (
            <div key={n} className="text-center"><span className={i === 0 ? "spot-pulse mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient text-lg font-bold shadow-glow" : "mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient text-lg font-bold"}>{n[0]}</span><small className="mt-1 block">{n}</small></div>
          ))}
        </div>
        <p className="mt-8 text-xs font-bold tracking-wider text-muted-foreground">ESCUCHANDO</p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {["Marta", "Sergio", "Ana", "Pablo", "Lucía", "Diego", "Eva", "Iván"].map((n) => (
            <div key={n} className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary font-semibold">{n[0]}</span><small className="mt-1 block text-[10px] text-muted-foreground">{n}</small></div>
          ))}
        </div>
      </main>
      <footer className="flex items-center justify-around border-t border-border p-4 pb-8">
        {speaking ? (
          <button onClick={() => setMuted(!muted)} aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"} className={muted ? "grid h-16 w-16 place-items-center rounded-full bg-secondary" : "spot-pulse grid h-16 w-16 place-items-center rounded-full bg-spot-gradient shadow-glow"}><Mic size={26} /></button>
        ) : (
          <Button onClick={() => { setHand(!hand); toast.success(hand ? "Has bajado la mano" : "Has pedido la palabra"); if (!hand) setTimeout(() => { setSpeaking(true); toast.success("Te han dado la palabra"); }, 2000); }} variant={hand ? "secondary" : "primary"}><Mic size={18} />{hand ? "Esperando turno…" : "Pedir la palabra"}</Button>
        )}
        {speaking && <Button variant="outline" onClick={() => { setSpeaking(false); setHand(false); setMuted(true); }}>Volver a escuchar</Button>}
      </footer>
    </div>
  );
}

function CreateCommunity({ onDone }: { onDone: (name: string) => void }) {
  const [step, setStep] = useState<"rec" | "listening" | "review">("rec");
  return (
    <div className="text-center">
      {step !== "review" ? (<>
        <h3 className="mt-6 text-2xl font-bold">Crea tu comunidad con tu voz</h3>
        <p className="mt-2 text-sm text-muted-foreground">Di el nombre y de qué va</p>
        <button onClick={() => { if (step === "rec") setStep("listening"); else setStep("review"); }} aria-label={step === "rec" ? "Grabar" : "Detener"} className={step === "listening" ? "spot-pulse mx-auto mt-10 grid h-28 w-28 place-items-center rounded-full bg-spot-gradient shadow-glow" : "mx-auto mt-10 grid h-28 w-28 place-items-center rounded-full bg-spot-gradient shadow-glow"}><Mic size={44} /></button>
        <p className="mt-5 text-sm text-muted-foreground">{step === "listening" ? "Escuchando… toca para terminar" : "Toca para empezar"}</p>
      </>) : (<>
        <h3 className="mt-4 text-xl font-bold">Esto es lo que he entendido</h3>
        <div className="mt-5 space-y-2 text-left">
          {[["Nombre", "Runners de Triana"], ["Tema", "Deporte y quedadas"], ["Zona", "Sevilla · 5 km"], ["Acceso", "Pública"]].map(([a, b]) => <div key={a} className="rounded-xl border border-border bg-card p-3"><small className="text-muted-foreground">{a}</small><strong className="block text-sm">{b}</strong></div>)}
        </div>
        <Button className="mt-5 w-full" onClick={() => onDone("Runners de Triana")}>Crear comunidad</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep("rec")}><Mic size={16} />Volver a grabar</Button>
      </>)}
    </div>
  );
}

export function Communities({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [joined, setJoined] = useState<string[]>(["Música en directo"]);
  const [room, setRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<"Descubrir" | "Mis comunidades">("Descubrir");
  const [inner, setInner] = useState<"Salas" | "Spots" | "Miembros">("Salas");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string[]>([]);
  const all = [...communities, ...created.map((name) => ({ name, icon: Trophy, members: "1", live: 0 }))];

  if (creating) return <Shell title="Nueva comunidad" onBack={() => setCreating(false)}><CreateCommunity onDone={(n) => { setCreated((c) => [...c, n]); setJoined((j) => [...j, n]); setCreating(false); setTab("Mis comunidades"); toast.success("¡Comunidad creada!"); }} /></Shell>;

  if (open) {
    const c = all.find((x) => x.name === open)!;
    const isJoined = joined.includes(c.name);
    return (
      <Shell title={c.name} onBack={() => setOpen(null)}>
        <div className="relative overflow-hidden rounded-2xl">
          <img src={festival} alt="" width={1024} height={1280} className="h-28 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="-mt-8 relative flex items-end gap-3 px-2">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-background bg-spot-gradient"><c.icon size={26} /></span>
          <div className="flex-1 pb-1"><strong className="block">{c.name}</strong><small className="text-muted-foreground">{c.members} miembros · {c.live} en directo</small></div>
        </div>
        <Button className="mt-4 w-full" variant={isJoined ? "secondary" : "primary"} onClick={() => { setJoined((j) => isJoined ? j.filter((n) => n !== c.name) : [...j, c.name]); toast.success(isJoined ? "Has salido de la comunidad" : "Te has unido a la comunidad"); }}>
          {isJoined ? "Miembro ✓ · Salir" : "Unirme"}
        </Button>
        <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
          {(["Salas", "Spots", "Miembros"] as const).map((t) => <button key={t} onClick={() => setInner(t)} className={inner === t ? "rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground" : "py-1.5 text-xs text-muted-foreground"}>{t}</button>)}
        </div>
        {inner === "Salas" && <div className="mt-4 space-y-2">
          {["Quedada de esta noche", "Recomendaciones del barrio"].map((r, i) => (
            <button key={r} onClick={() => i === 0 ? setRoom(r) : toast.success("Te avisaremos a las 20:00")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary">
              <span className={i === 0 ? "spot-pulse grid h-10 w-10 place-items-center rounded-full bg-live/20 text-live" : "grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"}><Mic size={18} /></span>
              <span className="flex-1"><strong className="block text-sm">{r}</strong><small className="text-muted-foreground">{i === 0 ? "En directo · 24 escuchando" : "Programada · 20:00"}</small></span>
              <span className="text-xs text-primary">{i === 0 ? "Entrar" : "Avisarme"}</span>
            </button>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setRoom("Mi sala")}><Radio size={16} />Abrir una sala de voz</Button>
        </div>}
        {inner === "Spots" && <div className="mt-4 grid grid-cols-3 gap-1">
          {[festival, stage, beach, sevilleNight, valenciaSunset, festival].map((img, i) => <button key={i} onClick={() => toast("Reproduciendo Spot")} className="relative"><img src={img} alt="Spot de la comunidad" width={1024} height={1280} loading="lazy" className="aspect-square w-full rounded-lg object-cover" /><Mic size={12} className="absolute bottom-1 right-1" /></button>)}
        </div>}
        {inner === "Miembros" && <div className="mt-4 space-y-2">
          {["Laura · Admin", "Carlos", "Marta", "Sergio"].map((m) => <div key={m} className="flex items-center gap-3 rounded-xl bg-card p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-spot-gradient font-bold">{m[0]}</span><span className="flex-1 text-sm">{m} <ShieldCheck size={13} className="inline text-primary" /></span></div>)}
        </div>}
        {room && <LiveRoom room={room} onLeave={() => setRoom(null)} />}
      </Shell>
    );
  }

  const list = tab === "Descubrir" ? all : all.filter((c) => joined.includes(c.name));
  return (
    <Shell title="Comunidades" onBack={onBack}>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {(["Descubrir", "Mis comunidades"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={tab === t ? "rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground" : "py-1.5 text-xs text-muted-foreground"}>{t}</button>)}
      </div>
      <div className="mt-4 space-y-2">
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aún no te has unido a ninguna comunidad.</p>}
        {list.map((c) => (
          <button key={c.name} onClick={() => { setOpen(c.name); setInner("Salas"); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"><img src={[stage, festival, beach, sevilleNight][all.indexOf(c) % 4]} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-primary"><c.icon size={11} /></span></span>
            <span className="flex-1"><strong className="block text-sm">{c.name}</strong><small className="text-muted-foreground">{c.members} miembros{c.live > 0 ? ` · ${c.live} en directo` : ""}</small></span>
            {c.live > 0 && <span className="rounded-md bg-live px-2 py-1 text-[10px] font-bold">EN DIRECTO</span>}
            {joined.includes(c.name) && <CheckCircle2 size={18} className="text-primary" />}
          </button>
        ))}
      </div>
      <Button className="mt-5 w-full" onClick={() => setCreating(true)}><Mic size={18} />Crear comunidad con tu voz</Button>
    </Shell>
  );
}

/* ---------- Eventos locales ---------- */
const events = [
  { title: "Concierto flamenco en Triana", when: "Hoy · 21:00", place: "Sevilla · Triana", filter: "Hoy", img: stage, going: 48, org: "Peña Triana", dur: "0:22" },
  { title: "Quedada de guitarras", when: "Hoy · 19:00", place: "Sevilla · Alameda", filter: "Hoy", img: festival, going: 17, org: "Laura", dur: "0:18" },
  { title: "Mercado de productores", when: "Sábado · 10:00", place: "Sevilla · Alameda", filter: "Fin de semana", img: valenciaSunset, going: 92, org: "Mercado Alameda", dur: "0:31" },
  { title: "Ruta al atardecer", when: "Domingo · 19:30", place: "Valencia · Malvarrosa", filter: "Fin de semana", img: beach, going: 35, org: "Carlos", dur: "0:25" },
  { title: "Feria de barrio", when: "12 de octubre", place: "Sevilla · Macarena", filter: "Próximos", img: sevilleNight, going: 210, org: "Vecinos Macarena", dur: "0:40" },
];
const eventTabs = ["Hoy", "Fin de semana", "Próximos"] as const;
const bars = [6, 12, 8, 16, 10, 18, 7, 14, 20, 9, 15, 6, 12, 17, 8, 13, 5, 11, 16, 7];

function AudioPill({ dur, org }: { dur: string; org: string }) {
  const [on, setOn] = useState(false);
  return (
    <button onClick={() => setOn((v) => !v)} aria-label={on ? "Pausar presentación" : "Escuchar presentación del organizador"} className="flex w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-2 pr-3 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-spot-gradient text-white shadow-glow">{on ? <span className="flex gap-0.5"><i className="h-3 w-0.5 rounded bg-white" /><i className="h-3 w-0.5 rounded bg-white" /></span> : <Play size={15} className="ml-0.5 fill-white" />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex h-5 items-center gap-[2px]" aria-hidden>{bars.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 60}ms` }} className={`w-[3px] rounded-full ${on ? "spot-pulse bg-primary" : "bg-primary/45"}`} />)}</span>
        <small className="block truncate text-[11px] text-muted-foreground">Escucha a {org}</small>
      </span>
      <span className="text-xs font-semibold tabular-nums text-primary">{dur}</span>
    </button>
  );
}

export function Events({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState("Hoy");
  const [going, setGoing] = useState<string[]>([]);
  const [detail, setDetail] = useState<(typeof events)[number] | null>(null);
  const [creating, setCreating] = useState(0);
  const list = events.filter((e) => e.filter === filter);
  if (detail) {
    const isGoing = going.includes(detail.title);
    return (
      <Shell title="Evento" onBack={() => setDetail(null)}>
        <img src={detail.img} alt={detail.title} className="aspect-video w-full rounded-2xl object-cover" />
        <p className="mt-4 flex items-center gap-2 text-xs text-primary"><Calendar size={13} />{detail.when}</p>
        <h2 className="mt-1 text-2xl font-bold">{detail.title}</h2>
        <p className="text-sm text-muted-foreground">{detail.place}</p>
        <div className="mt-4 flex items-center gap-2"><div className="flex -space-x-2">{[lauraPhoto, beach, festival, stage].map((image,i) => <span key={image} className="relative h-8 w-8 rounded-full border-2 border-background"><img src={image} alt="" className="h-full w-full rounded-full object-cover"/>{i < 2 && <BadgeCheck size={11} aria-label="Asistente verificado de ejemplo" className="absolute -right-1 -top-1 rounded-full bg-background text-primary"/>}</span>)}</div><span className="text-xs text-muted-foreground">{detail.going + (isGoing ? 1 : 0)} asistirán · 2 distintivos de ejemplo</span></div>
        <button onClick={() => toast("Reproduciendo la presentación de voz")} className="mt-4 flex w-full items-center gap-2 rounded-xl border border-border bg-secondary p-3 text-left text-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Mic size={16} /></span>Escucha al organizador · {detail.dur}</button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={isGoing ? "secondary" : "primary"} onClick={() => { setGoing((g) => isGoing ? g.filter((t) => t !== detail.title) : [...g, detail.title]); toast.success(isGoing ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); }}>{isGoing ? "Ya asistes" : "Asistiré"}</Button>
          <Button variant="secondary" onClick={() => toast.success("Enlace del evento copiado")}>Compartir</Button>
        </div>
        <Button variant="outline" className="mt-2 w-full" onClick={() => toast.success("Pregunta de voz enviada al organizador")}><Mic size={16} />Preguntar con tu voz</Button>
      </Shell>
    );
  }
  if (creating) {
    return (
      <Shell title="Crear evento" onBack={() => setCreating(0)}>
        {creating === 1 && <div className="pt-8 text-center"><p className="text-sm text-muted-foreground">Cuenta qué es, dónde y cuándo</p><button aria-label="Grabar evento" onClick={() => setCreating(2)} className="spot-pulse mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full bg-spot-gradient shadow-glow"><Mic size={40} /></button><p className="mt-4 text-xs text-muted-foreground">Pulsa para grabar tu audio-flyer</p></div>}
        {creating === 2 && <div className="space-y-3"><div className="rounded-2xl border border-border bg-card p-4 text-sm"><p className="text-xs text-muted-foreground">Detectado en tu audio</p><p className="mt-2"><strong>Qué:</strong> Quedada de guitarras</p><p><strong>Dónde:</strong> Alameda de Hércules</p><p><strong>Cuándo:</strong> Sábado · 19:00</p></div><Button className="w-full" onClick={() => setCreating(3)}>Publicar evento</Button><Button variant="ghost" className="w-full" onClick={() => setCreating(1)}>Volver a grabar</Button></div>}
        {creating === 3 && <div className="pt-10 text-center"><CheckCircle2 size={56} className="mx-auto text-primary" /><h3 className="mt-3 text-xl font-bold">¡Evento publicado!</h3><p className="text-sm text-muted-foreground">Aparece en Eventos, en el mapa y en el muro de Sevilla.</p><Button className="mt-6 w-full" onClick={() => setCreating(0)}>Listo</Button></div>}
      </Shell>
    );
  }
  return (
    <Shell title="Eventos cerca" onBack={onBack}>
      <button onClick={() => setCreating(1)} className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-spot-gradient p-4 text-left text-white shadow-glow">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur"><Mic size={20} /></span>
        <span className="flex-1"><strong className="block text-sm">Crear evento con tu voz</strong><small className="text-xs text-white/80">Cuenta qué, dónde y cuándo en 30 s</small></span>
        <Plus size={20} className="opacity-90" />
      </button>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={12} className="text-primary" />Cerca de ti · Sevilla y alrededores</p>
      <div role="tablist" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-secondary/60 p-1">
        {eventTabs.map((f) => {
          const n = events.filter((e) => e.filter === f).length;
          return (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={filter === f ? "spot-active-pill rounded-xl px-1 py-2 text-xs font-semibold" : "rounded-xl px-1 py-2 text-xs text-muted-foreground"}>
              {f}<span className={filter === f ? "ml-1 opacity-80" : "ml-1 opacity-60"}>{n}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-4">
        {list.length === 0 && <div className="rounded-2xl border border-dashed border-border py-10 text-center"><Calendar size={28} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">No hay eventos en este periodo.</p></div>}
        {list.map((e) => {
          const isGoing = going.includes(e.title);
          return (
            <article key={e.title} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <button className="relative block w-full text-left" onClick={() => setDetail(e)} aria-label={`Ver ${e.title}`}>
                <img src={e.img} alt="" width={1024} height={640} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur"><Calendar size={12} className="text-primary" />{e.when}</span>
                <span className="absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-medium text-white/90"><MapPin size={12} />{e.place}</span>
              </button>
              <div className="space-y-3 p-4">
                <button onClick={() => setDetail(e)} className="flex w-full items-center justify-between gap-2 text-left"><h3 className="text-base font-bold leading-snug">{e.title}</h3><ChevronRight size={18} className="shrink-0 text-muted-foreground" /></button>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users size={13} className="text-primary" />{e.going + (isGoing ? 1 : 0)} asistirán</p>
                <AudioPill dur={e.dur} org={e.org} />
                <div className="flex gap-2">
                  <Button className="flex-1" variant={isGoing ? "secondary" : "primary"} onClick={() => { setGoing((g) => isGoing ? g.filter((t) => t !== e.title) : [...g, e.title]); toast.success(isGoing ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); }}>
                    {isGoing ? <><CheckCircle2 size={16} />Ya asistes</> : "Asistiré"}
                  </Button>
                  <Button variant="outline" aria-label="Compartir evento" onClick={() => toast.success("Enlace del evento copiado")}><Share2 size={16} /></Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

/* ---------- Muro de ciudad / pueblo ---------- */
const places = [
  { name: "Sevilla", people: "246", live: "8", img: sevilleNight },
  { name: "Valencia", people: "188", live: "5", img: valenciaSunset },
  { name: "Carmona", people: "34", live: "1", img: festival },
  { name: "Cullera", people: "21", live: "0", img: beach },
];

/* ---------- Privacidad ---------- */
export function Privacy({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const { incognito, blocked, perms } = useStore();
  const [toggles, setToggles] = useState({ ubicacion: true, mensajes: true, escuchas: false, viaje: false, traduccion: false, transcripcion: false });
  const set = (k: keyof typeof toggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));
  const labels: [keyof typeof toggles, string, string][] = [
    ["ubicacion", "Mostrar mi ubicación aproximada", "Nunca se muestra tu dirección exacta"],
    ["mensajes", "Permitir notas de voz de cualquiera", "Si lo desactivas, solo te escriben quienes sigues"],
    ["escuchas", "Mostrar quién escucha mis Spots", "Tu lista de oyentes será visible"],
  ];
  const voiceLabels: [keyof typeof toggles, string, string][] = [
    ["viaje", "Modo viaje", "Descubre Spots de la ciudad a la que viajas, sin cambiar tu zona real"],
    ["traduccion", "Traducción de voz", "Escucha Spots en otro idioma (necesita servicio de traducción)"],
    ["transcripcion", "Transcripción con IA", "Muestra el texto de las notas de voz (necesita servicio de transcripción)"],
  ];
  return (
    <Shell title="Privacidad" onBack={onBack}>
      <button onClick={() => app.open("incognito")} className="flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-card p-4 text-left">
        <EyeOff className="text-accent" /><span className="flex-1"><strong className="block text-sm">Modo Incógnito</strong><small className="text-muted-foreground">{incognito.active ? "Activo · toca para gestionar" : "Oculta tu identidad pública por tiempo"}</small></span><span className="text-muted-foreground">›</span>
      </button>
      <div className="mt-4 space-y-2">
        {labels.map(([k, title, desc]) => (
          <button key={k} role="switch" aria-checked={toggles[k]} onClick={() => set(k)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left">
            <span className="flex-1"><strong className="block text-sm">{title}</strong><small className="text-muted-foreground">{desc}</small></span>
            <span className={toggles[k] ? "h-6 w-11 rounded-full bg-primary p-1" : "h-6 w-11 rounded-full bg-secondary p-1"}>
              <span className={toggles[k] ? "block h-4 w-4 translate-x-5 rounded-full bg-primary-foreground transition" : "block h-4 w-4 rounded-full bg-muted-foreground transition"} />
            </span>
          </button>
        ))}
      </div>
      <h3 className="mb-2 mt-5 text-sm font-bold">Voz y viajes <span className="ml-1 rounded-full bg-premium/20 px-2 py-0.5 text-[10px] font-bold text-premium">Vista previa</span></h3>
      <div className="space-y-2">
        {voiceLabels.map(([k, title, desc]) => (
          <button key={k} role="switch" aria-checked={toggles[k]} onClick={() => { set(k); toast(!toggles[k] ? `${title} activado (preferencia guardada; el servicio se conectará con el backend)` : `${title} desactivado`); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left">
            <span className="flex-1"><strong className="block text-sm">{title}</strong><small className="text-muted-foreground">{desc}</small></span>
            <span className={toggles[k] ? "h-6 w-11 rounded-full bg-primary p-1" : "h-6 w-11 rounded-full bg-secondary p-1"}>
              <span className={toggles[k] ? "block h-4 w-4 translate-x-5 rounded-full bg-primary-foreground transition" : "block h-4 w-4 rounded-full bg-muted-foreground transition"} />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-spot-surface p-4">
        <ShieldCheck className="shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">Tus datos legales nunca se muestran. Spotly nunca comparte tu ubicación exacta ni tu identidad con los negocios.</p>
      </div>
      <Button variant="outline" className="mt-4 w-full" onClick={() => app.open("permisos")}><MapPin size={18} />Permisos ({Object.values(perms).filter(Boolean).length}/4 activos)</Button>
      <Button variant="outline" className="mt-2 w-full" onClick={() => app.open("seguridad")}><Users size={18} />Bloqueos y denuncias ({blocked.length})</Button>
    </Shell>
  );
}
