import { useState } from "react";
import { BadgeCheck, Bookmark, Calendar, CheckCircle2, ChevronLeft, Eye, EyeOff, Flame, Heart, MapPin, Navigation, Pause, Play, Mic, Music, Radio, Share2, ShieldCheck, Sparkles, Trophy, Users, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
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
  { title: "Concierto flamenco en Triana", when: "Hoy · 21:00", place: "Sevilla · Triana", filter: "Hoy", img: stage },
  { title: "Mercado de productores", when: "Sábado · 10:00", place: "Sevilla · Alameda", filter: "Fin de semana", img: valenciaSunset },
  { title: "Ruta al atardecer", when: "Domingo · 19:30", place: "Valencia · Malvarrosa", filter: "Fin de semana", img: beach },
  { title: "Feria de barrio", when: "12 de octubre", place: "Sevilla · Macarena", filter: "Próximos", img: festival },
];

export function Events({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState("Hoy");
  const [going, setGoing] = useState<string[]>([]);
  const [detail, setDetail] = useState<(typeof events)[number] | null>(null);
  const [creating, setCreating] = useState(0);
  const list = events.filter((e) => e.filter === filter);
  if (detail) {
    const isGoing = going.includes(detail.title);
    return (
      <div className="fixed inset-0 z-[60] mx-auto flex max-w-[520px] flex-col overflow-hidden bg-black">
        {/* Foto fullscreen */}
        <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
          <img src={detail.img} alt={detail.title} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
          {/* Botón atrás */}
          <button onClick={() => setDetail(null)} aria-label="Volver" className="absolute left-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white" style={{ top: "max(2.75rem, calc(env(safe-area-inset-top) + 0.5rem))" }}><ChevronLeft size={22} /></button>
          {/* Acciones laterales derecha */}
          <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
            <button onClick={() => { setGoing((g) => isGoing ? g.filter((t) => t !== detail.title) : [...g, detail.title]); toast.success(isGoing ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); }} aria-label="Asistiré" className="flex flex-col items-center gap-1">
              <Heart size={28} className={isGoing ? "text-accent" : "text-white"} fill={isGoing ? "currentColor" : "none"} />
              <span className="text-xs font-bold text-white">{48 + (isGoing ? 1 : 0)}</span>
            </button>
            <button onClick={() => toast.success("Enlace del evento copiado")} aria-label="Compartir" className="flex flex-col items-center gap-1">
              <Share2 size={26} className="text-white" />
              <span className="text-xs font-bold text-white">Enviar</span>
            </button>
            <button onClick={() => toast("Evento guardado")} aria-label="Guardar" className="flex flex-col items-center gap-1">
              <Bookmark size={26} className="text-white" />
              <span className="text-xs font-bold text-white">Guardar</span>
            </button>
          </div>
          {/* Chip lugar */}
          <div className="absolute bottom-5 left-3">
            <div className="mb-1 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm" style={{ width: "fit-content" }}>
              <MapPin size={12} />{detail.place}
            </div>
          </div>
        </div>

        {/* Info scrollable */}
        <div className="flex-1 overflow-y-auto bg-background px-4 pb-28 pt-4">
          <p className="flex items-center gap-2 text-xs text-primary"><Calendar size={13} />{detail.when}</p>
          <h2 className="mt-1 text-2xl font-bold">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">{detail.place}</p>
          <div className="mt-4 flex items-center gap-2"><div className="flex -space-x-2">{[lauraPhoto, beach, festival, stage].map((image,i) => <span key={image} className="relative h-8 w-8 rounded-full border-2 border-background"><img src={image} alt="" className="h-full w-full rounded-full object-cover"/>{i < 2 && <BadgeCheck size={11} aria-label="Asistente verificado de ejemplo" className="absolute -right-1 -top-1 rounded-full bg-background text-primary"/>}</span>)}</div><span className="text-xs text-muted-foreground">{48 + (isGoing ? 1 : 0)} asistirán · 2 distintivos de ejemplo</span></div>
          <button onClick={() => toast("Reproduciendo la presentación de voz")} className="mt-4 flex w-full items-center gap-2 rounded-xl border border-border bg-secondary p-3 text-left text-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Mic size={16} /></span>Escucha al organizador · 0:22</button>
          <Button variant="outline" className="mt-3 w-full" onClick={() => toast.success("Pregunta de voz enviada al organizador")}><Mic size={16} />Preguntar con tu voz</Button>
        </div>

        {/* Footer */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={isGoing ? "secondary" : "default"} onClick={() => { setGoing((g) => isGoing ? g.filter((t) => t !== detail.title) : [...g, detail.title]); toast.success(isGoing ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); }}>{isGoing ? "Ya asistes" : "Asistiré"}</Button>
            <Button variant="secondary" onClick={() => toast.success("Enlace del evento copiado")}>Compartir</Button>
          </div>
        </div>
      </div>
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
      <Button className="mb-3 w-full" onClick={() => setCreating(1)}><Mic size={16} />Crear evento con tu voz</Button>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {["Hoy", "Fin de semana", "Próximos"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? "rounded-lg bg-primary px-1 py-2 text-xs font-semibold text-primary-foreground" : "px-1 py-2 text-xs text-muted-foreground"}>{f}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hay eventos en este periodo.</p>}
        {list.map((e) => {
          const isGoing = going.includes(e.title);
          return (
            <article key={e.title} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button className="block w-full text-left" onClick={() => setDetail(e)}><img src={e.img} alt={e.title} width={1024} height={1280} loading="lazy" className="aspect-[16/9] w-full object-cover" /></button>
              <div className="p-4">
                <p className="flex items-center gap-2 text-xs text-primary"><Calendar size={13} />{e.when}</p>
                <button onClick={() => setDetail(e)} className="mt-1 text-left font-semibold">{e.title} ›</button>
                <p className="text-xs text-muted-foreground">{e.place}</p>
                <button onClick={() => toast("Reproduciendo la presentación de voz")} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-border bg-secondary p-2 text-left text-xs text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><Mic size={15} /></span>
                  Escucha al organizador · 0:22
                </button>
                <Button className="mt-3 w-full" variant={isGoing ? "secondary" : "primary"} onClick={() => { setGoing((g) => isGoing ? g.filter((t) => t !== e.title) : [...g, e.title]); toast.success(isGoing ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); }}>
                  {isGoing ? "Ya asistes" : "Asistiré"}
                </Button>
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

export function CityWall({ onBack, mine = false }: { onBack: () => void; mine?: boolean }) {
  const [place, setPlace] = useState(places[0]!);
  const [tab, setTab] = useState("Todos");
  const [selectingCity, setSelectingCity] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const cityPhotos = [festival, valenciaSunset, sevilleNight, stage, beach, festival, valenciaSunset, sevilleNight, stage, beach, festival, valenciaSunset];
  const photoCounts = ["1,2K", "842", "1,1K", "654", "854", "376", "924", "563", "717", "623", "448", "302"];
  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[520px] overflow-y-auto bg-background pb-20">
      <header className="flex items-center gap-2 px-4 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]"><Button size="icon" variant="ghost" onClick={onBack} aria-label="Volver"><ChevronLeft /></Button><div><h1 className="text-xl font-bold">{place.name}</h1><p className="text-xs text-muted-foreground">{place.name === "Sevilla" ? "124K Spots · 83K personas" : `${place.people} Spots · ${place.people} personas`}</p></div><Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setSelectingCity(true)} aria-label="Elegir ciudad">⌄</Button></header>
      <div className="mt-5 flex gap-1.5 overflow-x-auto px-4 pb-2">
        {["Todos", "Fotos", "Vídeos", "Voz", "En directo"].map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "secondary"} onClick={() => setTab(t)} className={`shrink-0 rounded-full text-xs ${tab === t ? "spot-active-pill" : ""}`}>{t}</Button>)}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1.5 px-3">
        {mine && place.name === "Sevilla" && <Button variant="ghost" onClick={() => setSelectedSpot(-1)} className="relative h-auto overflow-hidden rounded-lg p-0"><img src={valenciaSunset} alt="Tu Spot" className="aspect-[3/4] w-full object-cover" /><span className="absolute left-1 top-1 rounded bg-live px-1 text-[9px] font-bold text-primary-foreground">TÚ · NUEVO</span></Button>}
        {cityPhotos.filter((_, i) => tab !== "En directo" || i % 3 === 0).filter((_, i) => tab !== "Voz" || i % 2 === 0).map((img, i) => <Button key={`${tab}-${i}`} variant="ghost" onClick={() => setSelectedSpot(i)} className="relative h-auto overflow-hidden rounded-lg border border-border p-0"><img src={place.name === "Sevilla" ? img : i % 3 === 0 ? place.img : img} alt={`Spot ${i + 1} en ${place.name}`} loading="lazy" className="aspect-[3/4] w-full object-cover" /><span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1 pt-6 text-[10px]"><Heart size={11} fill="currentColor" className="text-live" />{photoCounts[i]} <Mic size={10} className="ml-auto" /></span></Button>)}
      </div>
      {selectingCity && <div className="fixed inset-0 z-50 flex items-end bg-background/80" onClick={() => setSelectingCity(false)}><div className="w-full rounded-t-xl bg-card p-4 pb-10" onClick={(e) => e.stopPropagation()}><p className="mb-3 text-sm font-bold">Ciudades y pueblos</p>{places.map((p) => <Button key={p.name} variant={p.name === place.name ? "default" : "ghost"} onClick={() => { setPlace(p); setTab("Todos"); setSelectingCity(false); }} className="mb-1 w-full justify-start">{p.name}</Button>)}</div></div>}
      {selectedSpot !== null && <div className="fixed inset-0 z-50 flex items-end bg-background/80" onClick={() => setSelectedSpot(null)}><div className="mx-auto w-full max-w-[520px] rounded-t-2xl border-t border-primary bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}><img src={selectedSpot === -1 ? valenciaSunset : cityPhotos[selectedSpot % cityPhotos.length]} alt="Spot seleccionado" className="aspect-video w-full rounded-lg object-cover" /><p className="mt-3 font-semibold">{selectedSpot === -1 ? "Tu Spot" : `Spot en ${place.name}`}</p><p className="text-xs text-muted-foreground">{place.name} · Hace 5 min</p><div className="mt-3 flex gap-2"><Button onClick={() => toast("Reproduciendo Spot de voz")}><Mic size={16} />Escuchar Spot</Button><Button variant="secondary" onClick={() => setSelectedSpot(null)}>Cerrar</Button></div></div></div>}
    </div>
  );
}

/* ---------- Búsqueda por voz ---------- */
const suggestions = ["Dónde hay música en directo esta noche", "Sitios tranquilos cerca del río", "Qué está pasando ahora en Triana"];

export function VoiceSearch({ onBack }: { onBack: () => void }) {
  const [openR, setOpenR] = useState<{ t: string; d: string } | null>(null); const [playR, setPlayR] = useState(false);
  const [kind, setKind] = useState<"Lugares" | "Creadores">("Lugares");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [listening, setListening] = useState(false);
  const [query, setQuery] = useState("");
  const [distance, setDistance] = useState(5);
  const [when, setWhen] = useState("Ahora");
  const results = query ? [
    { t: "Sala Malandar · música en directo", d: "1,2 km · empieza a las 21:30" },
    { t: "Terraza Alameda · ambiente tranquilo", d: "800 m · 14 personas ahora" },
    { t: "Quedada abierta en Triana", d: "2,1 km · 6 en directo" },
  ] : [];
  return (
    <Shell title="Buscar con la voz" onBack={onBack}>
      <div className="rounded-2xl bg-spot-surface p-6 text-center">
        <button onClick={() => { if (listening) { setListening(false); setQuery(suggestions[0]!); toast.success("Búsqueda entendida"); } else { setListening(true); setQuery(""); } }} className={listening ? "spot-pulse mx-auto grid h-28 w-28 place-items-center rounded-full bg-spot-gradient shadow-glow" : "mx-auto grid h-28 w-28 place-items-center rounded-full bg-spot-gradient"} aria-label={listening ? "Detener búsqueda por voz" : "Buscar con la voz"}>
          <Mic size={46} />
        </button>
        <p className="mt-4 text-sm text-muted-foreground">{listening ? "Escuchando… pulsa otra vez al terminar" : query ? `«${query}»` : "Pulsa y di lo que buscas"}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">{(["Lugares", "Creadores"] as const).map(x => <Button key={x} size="sm" variant={kind===x?"default":"ghost"} onClick={()=>{setKind(x);setOpenR(null)}} className="rounded-md">{x}</Button>)}</div>
      {kind === "Creadores" && <div className="mt-4"><Button size="sm" variant={onlyVerified?"default":"secondary"} onClick={()=>setOnlyVerified(v=>!v)} className="rounded-full"><BadgeCheck size={15}/>Solo verificados</Button><p className="mt-2 text-[11px] text-muted-foreground">Perfiles y sellos de ejemplo</p></div>}
      <h3 className="mt-6 text-sm font-bold">Filtros</h3>
      <label className="mt-2 block text-xs text-muted-foreground">Distancia: {distance} km
        <input type="range" min={1} max={30} value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
      </label>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {["Ahora", "Hoy", "Esta semana"].map((w) => <button key={w} onClick={() => setWhen(w)} className={when === w ? "rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" : "py-2 text-xs text-muted-foreground"}>{w}</button>)}
      </div>

      {kind === "Creadores" && <div className="mt-5 space-y-2">{[{name:"Laura",image:lauraPhoto,verified:true,topic:"Música · Sevilla",distance:"300 m"},{name:"Carlos",image:beach,verified:true,topic:"Deporte · Sevilla",distance:"450 m"},{name:"Marta",image:festival,verified:false,topic:"Gastronomía · Sevilla",distance:"1,2 km"}].filter(x=>!onlyVerified||x.verified).map(x=><Button key={x.name} variant="secondary" onClick={()=>setOpenR({t:x.name,d:`${x.topic} · ${x.distance}${x.verified?' · Verificado de ejemplo':''}`})} className="flex h-auto min-h-16 w-full justify-start gap-3 rounded-lg border border-border p-2 text-left"><img src={x.image} alt="" className="h-11 w-11 rounded-full object-cover"/><span className="min-w-0 flex-1"><strong className="flex items-center gap-1 text-sm">{x.name}{x.verified&&<BadgeCheck size={14} className="text-primary"/>}</strong><small className="block text-xs text-muted-foreground">{x.topic} · {x.distance}</small></span></Button>)}</div>}
      {kind === "Lugares" && !query && (
        <>
          <h3 className="mt-6 text-sm font-bold">Prueba a decir</h3>
          <div className="mt-2 space-y-2">
            {suggestions.map((s) => <button key={s} onClick={() => setQuery(s)} className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm hover:border-primary">«{s}»</button>)}
          </div>
        </>
      )}

      {kind === "Lugares" && query && (
        <>
          <h3 className="mt-6 text-sm font-bold">Resultados · {when} · {distance} km</h3>
          <div className="mt-2 space-y-2">
            {results.map((r) => (
              <button key={r.t} onClick={() => setOpenR(r)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><Flame size={18} /></span>
                <span className="flex-1"><strong className="block text-sm">{r.t}</strong><small className="text-muted-foreground">{r.d}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      {openR && <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur-sm" onClick={() => { setOpenR(null); setPlayR(false); }}><div className="mx-auto w-full max-w-[520px] rounded-t-3xl border-t border-border bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <h3 className="text-lg font-bold">{openR.t}</h3><p className="text-sm text-muted-foreground">{openR.d}</p>
        {kind === "Creadores" ? <><p className="mt-3 text-xs text-muted-foreground">Presentación de voz · ejemplo</p><Button variant="secondary" onClick={() => setPlayR(!playR)} className="mt-2 w-full justify-start"><span className="text-primary">{playR ? <Pause size={16}/> : <Play size={16}/>}</span>{playR ? "Pausar presentación" : "Escuchar presentación"}</Button><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => toast("Seguimiento de ejemplo")}>Seguir</Button><Button onClick={() => toast("Mensaje de voz de ejemplo")}><Mic size={16}/>Mensaje de voz</Button></div></> : <><Button variant="secondary" onClick={() => setPlayR(!playR)} className="mt-4 w-full justify-start"><span className="text-primary">{playR ? <Pause size={16}/> : <Play size={16}/>}</span>{playR ? "Pausar ejemplo" : "Escuchar lo que se dice ahí"}</Button><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => toast("Ruta de ejemplo en el mapa")}><MapPin size={16} />Cómo llegar</Button><Button onClick={() => toast("Respuesta de voz de ejemplo")}><Mic size={16} />Responder</Button></div></>}
      </div></div>}
    </Shell>
  );
}

/* ---------- Privacidad e incógnito ---------- */
export function Privacy({ onBack }: { onBack: () => void }) {
  const [incognito, setIncognito] = useState<number | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false); const [blocked, setBlocked] = useState(["Usuario_spam23", "Pedro R.", "Fiesta Promo SL"]);
  const [toggles, setToggles] = useState({ ubicacion: true, mensajes: true, escuchas: false });
  const set = (k: keyof typeof toggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));
  const labels: [keyof typeof toggles, string, string][] = [
    ["ubicacion", "Mostrar mi ubicación aproximada", "Nunca se muestra tu dirección exacta"],
    ["mensajes", "Permitir notas de voz de cualquiera", "Si lo desactivas, solo te escriben quienes sigues"],
    ["escuchas", "Mostrar quién escucha mis Spots", "Tu lista de oyentes será visible"],
  ];
  return (
    <Shell title="Privacidad" onBack={onBack}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          {incognito ? <EyeOff className="text-accent" /> : <Eye className="text-primary" />}
          <div className="flex-1">
            <strong className="block text-sm">Modo incógnito</strong>
            <small className="text-muted-foreground">{incognito ? `Activo durante ${incognito} h` : "Navega sin aparecer en el mapa"}</small>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 4, 24].map((h) => <button key={h} onClick={() => { setIncognito(h); toast.success(`Modo incógnito activado ${h} h`); }} className={incognito === h ? "rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground" : "rounded-xl border border-border py-2 text-sm text-muted-foreground"}>{h} h</button>)}
        </div>
        {incognito && <Button variant="outline" className="mt-3 w-full" onClick={() => { setIncognito(null); toast("Modo incógnito desactivado"); }}>Desactivar</Button>}
      </div>

      <div className="mt-4 space-y-2">
        {labels.map(([k, title, desc]) => (
          <button key={k} onClick={() => set(k)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left">
            <span className="flex-1"><strong className="block text-sm">{title}</strong><small className="text-muted-foreground">{desc}</small></span>
            <span className={toggles[k] ? "h-6 w-11 rounded-full bg-primary p-1" : "h-6 w-11 rounded-full bg-secondary p-1"}>
              <span className={toggles[k] ? "block h-4 w-4 translate-x-5 rounded-full bg-primary-foreground transition" : "block h-4 w-4 rounded-full bg-muted-foreground transition"} />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-spot-surface p-4">
        <ShieldCheck className="shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">Spotly nunca comparte tu ubicación exacta. Puedes bloquear y denunciar a cualquier persona desde su perfil.</p>
      </div>
      <Button variant="outline" className="mt-4 w-full" onClick={() => setBlockedOpen(true)}><Users size={18} />Personas bloqueadas ({blocked.length})</Button>
      {blockedOpen && <Shell title="Personas bloqueadas" onBack={() => setBlockedOpen(false)}>
        {blocked.length ? <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">{blocked.map((b) => <div key={b} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-bold">{b[0]}</span><span className="flex-1 text-sm">{b}</span><Button size="sm" variant="outline" onClick={() => { setBlocked(blocked.filter((x) => x !== b)); toast(`${b} desbloqueado`); }}>Desbloquear</Button></div>)}</div>
          : <p className="py-16 text-center text-sm text-muted-foreground">No has bloqueado a nadie.</p>}
        <p className="mt-4 text-xs text-muted-foreground">Las personas bloqueadas no pueden escucharte, enviarte notas de voz ni verte en el mapa.</p>
      </Shell>}
    </Shell>
  );
}
