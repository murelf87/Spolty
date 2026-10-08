import { useEffect, useState } from "react";
import { ChevronLeft, BadgeCheck, Camera, Check, Heart, Layers, MapPin, Mic, Navigation, Play, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Sheet } from "./Extras";
import sevilleNight from "@/assets/seville-night.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import { BottomSheet } from "./kit";
import { MediaViewer } from "./MediaViewer";
import { VoiceReply } from "./Voice";
import { sampleMedia } from "@/lib/media";
import { api, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import { useMe } from "@/lib/store";
import { FollowButton, PersonAvatar } from "./CloudPeople";
import { AuthorProfile } from "./SpotDetail";

const imgs = [festival, beach, stage, valenciaSunset, sevilleNight, festival];
const photos = [
  { t: "Atardecer en Triana", p: "Sevilla", u: "Laura", d: "300 m", l: 128 },
  { t: "Playa de la Malvarrosa", p: "Valencia", u: "Carlos", d: "2,1 km", l: 96 },
  { t: "Plaza de España", p: "Sevilla", u: "Marta", d: "1,2 km", l: 312 },
  { t: "Castillo de Cullera", p: "Cullera", u: "Sofía", d: "4 km", l: 57 },
  { t: "Calles de Carmona", p: "Carmona", u: "Javi", d: "6 km", l: 74 },
  { t: "Alameda de noche", p: "Sevilla", u: "Ana", d: "800 m", l: 201 },
];
const people = [
  { n: "Laura", d: "300 m", live: true, v: true, i: "Música · Fotografía", image: lauraPhoto },
  { n: "Carlos", d: "450 m", live: true, v: true, i: "Deporte · Playa", image: beach },
  { n: "Marta", d: "1,2 km", live: false, v: false, i: "Gastronomía", image: festival },
  { n: "Sofía", d: "1,8 km", live: false, v: true, i: "Cultura · Arte", image: valenciaSunset },
];
const places = [["Bar El Tremendo", "Tapas · 200 m", "Abierto"], ["Mercado de Triana", "Mercado · 650 m", "Abierto"], ["Sala X", "Música · 1,4 km", "Hoy concierto"]] as const;
const geo: Record<string, string[]> = { Sevilla: ["Sevilla", "Carmona", "Dos Hermanas", "Utrera"], Valencia: ["Valencia", "Cullera", "Gandía", "Sagunto"], Madrid: ["Madrid", "Alcalá", "Getafe"] };
const pins = [[24, 50, "accent", 36], [20, 30, "primary", 28], [72, 58, "primary", 30], [30, 66, "live", 26], [62, 24, "primary", 24]] as const;

const ring = { accent: "border-accent", primary: "border-primary", live: "border-live" };
const dot = { accent: "bg-accent", primary: "bg-primary", live: "bg-live" };
type Photo = (typeof photos)[number];
type Person = (typeof people)[number];

export function ExploreView({ onOpen, mine = false }: { onOpen: (s: Sheet) => void; mine?: boolean }) {
  const [tab, setTab] = useState("Mapa");
  const [layer, setLayer] = useState<"Oscuro" | "Satélite">("Oscuro");
  const [prov, setProv] = useState("Sevilla");
  const [town, setTown] = useState("Sevilla");
  const [picker, setPicker] = useState(false);
  const [filters, setFilters] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [upload, setUpload] = useState(false);
  const [f, setF] = useState({ km: 5, when: "Ahora", only: [] as string[] });
  const [peopleFilter, setPeopleFilter] = useState<"Cerca" | "Nuevos" | "Verificados" | "Online">("Cerca");
  const [place, setPlace] = useState<number | null>(null);
  const km = (d: string) => d.includes("km") ? parseFloat(d.replace(",", ".")) : parseFloat(d) / 1000;
  const shownPhotos = photos.filter((p) => km(p.d) <= f.km && (!f.only.includes("Verificados") || ["Laura", "Sofía", "Carlos"].includes(p.u)));
  const shownPeople = people.filter((p) => km(p.d) <= f.km && (!f.only.includes("Verificados") || p.v) && (!f.only.includes("En directo") || p.live) && (peopleFilter !== "Verificados" || p.v) && (peopleFilter !== "Online" || p.live));

  return (
    <main className="min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))]">
       <header className="px-4 pt-[var(--safe-header)]">
         <Button variant="secondary" onClick={() => onOpen("buscar")} className="flex h-10 w-full justify-start gap-2 rounded-full border border-border bg-secondary text-left"><Mic size={16} className="text-primary" /><span className="text-sm text-muted-foreground">Sevilla</span></Button>
         <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-secondary p-1">
           {["Mapa", "Fotos", "Personas", "Eventos"].map((x) => <Button key={x} size="sm" variant={tab === x ? "default" : "ghost"} onClick={() => x === "Eventos" ? onOpen("eventos") : setTab(x)} className={tab === x ? "spot-active-pill rounded-lg text-xs" : "rounded-lg text-xs text-muted-foreground"}>{x}</Button>)}
         </div>
      </header>

      {tab === "Mapa" && (
         <section className={`relative mx-4 mt-2 h-[min(72vh,42.5rem)] overflow-hidden rounded-xl border border-border ${layer === "Oscuro" ? "bg-spot-surface" : "bg-secondary"}`}>
          {layer === "Satélite" && <img src={imgs[3]} alt="Vista satélite" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
           {layer === "Oscuro" && <div className="spot-neon-map absolute inset-0" aria-hidden="true"><svg viewBox="0 0 360 620" preserveAspectRatio="xMidYMid slice" className="h-full w-full"><g fill="none" stroke="var(--spot-blue)" strokeWidth="1" opacity=".45"><path d="M-30 82 75 95 143 135 264 134 390 205M-20 180 82 196 170 181 250 205 390 252M-20 286 99 272 181 308 253 301 390 335M-20 430 76 407 165 442 256 415 390 458M-20 531 96 497 187 517 278 503 390 550M34-20 47 112 31 220 56 330 30 460 62 650M126-20 114 115 136 242 111 363 142 476 127 650M231-20 218 100 241 235 213 361 247 485 233 650M330-20 311 125 330 235 309 368 337 495 322 650"/><path stroke="var(--spot-fuchsia)" opacity=".8" strokeWidth="1.6" d="M-20 125 86 143 153 153 236 169 390 222M-20 360 77 355 157 386 243 379 390 402M94-20 96 97 82 196 100 272 76 407 96 497 95 650M280-20 272 134 250 205 253 301 256 415 278 503 265 650"/></g><g fill="var(--spot-blue)" opacity=".7"><circle cx="82" cy="196" r="2"/><circle cx="253" cy="301" r="2"/><circle cx="76" cy="407" r="2"/></g></svg></div>}
          {[88, 64, 42, 22].map((s) => <div key={s} className="spot-radar absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: `${s}%`, aspectRatio: "1" }} />)}
           {!mine && <button onClick={() => setPerson(people[0]!)} aria-label="Ver perfil de Laura" className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-accent shadow-glow"><img src={lauraPhoto} alt="Laura, perfil ilustrativo" className="h-full w-full object-cover" /></button>}
           {pins.map(([x, y, c, s], i) => (
              <Button key={i} variant="ghost" aria-label="Ver Spot" onClick={() => setPin(i)} className="absolute flex h-auto -translate-x-1/2 -translate-y-full flex-col items-center p-0" style={{ left: `${x}%`, top: `${y}%` }}><span className={`relative rounded-full border-2 ${ring[c]} ${pin === i ? "ring-2 ring-primary" : ""}`} style={{ width: s + 12, height: s + 12 }}><img src={i === 0 ? lauraPhoto : imgs[i]} alt="" className={`h-full w-full rounded-full object-cover ${i === 0 ? "spot-pulse" : ""}`} />{i < 2 && <BadgeCheck size={14} className="absolute -right-1 -top-1 rounded-full bg-background text-primary" aria-label="Autor verificado de ejemplo" />}</span><span className={`-mt-0.5 h-2 w-2 rotate-45 ${dot[c]}`} /></Button>
          ))}
            {mine && <Button variant="ghost" aria-label="Tu Spot" onClick={() => toast("Tu Spot · Hace 1 min · 1,2K vistas")} className="absolute left-1/2 top-1/2 h-auto -translate-x-1/2 -translate-y-1/2 flex-col p-0"><span className="h-24 w-24 overflow-hidden rounded-full border-[3px] border-accent shadow-glow"><img src={valenciaSunset} alt="" className="h-full w-full object-cover" /></span><span className="mt-1 rounded-full bg-background/90 px-3 py-1 text-3xs font-bold text-foreground shadow-glow">TU SPOT</span></Button>}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <Button size="icon" variant="secondary" aria-label="Cambiar capa" onClick={() => setLayer(layer === "Oscuro" ? "Satélite" : "Oscuro")}><Layers size={18} /></Button>
            <Button size="icon" variant="secondary" aria-label="Mi ubicación" onClick={() => toast("Centrado en tu ubicación")}><Navigation size={18} /></Button>
          </div>
           <Button size="sm" variant="secondary" onClick={() => setFilters(true)} className="absolute left-3 top-3 h-7 rounded-full bg-background/80 px-2 text-3xs font-semibold backdrop-blur"><SlidersHorizontal size={12} className="text-primary" />8 en directo · {layer}</Button>
           {pin !== null ? (
            <div className="absolute inset-x-3 bottom-3 flex gap-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
              <img src={imgs[pin % imgs.length]} alt="" className="h-16 w-16 rounded-lg object-cover" />
               <div className="min-w-0 flex-1"><p className="truncate font-semibold">{photos[pin]?.t}</p><p className="text-xs text-muted-foreground">{photos[pin]?.u} · {photos[pin]?.d}</p>
                 <Button variant="ghost" size="sm" onClick={() => { const selected = photos[pin]; if (selected) setPhoto(selected); }} className="mt-1 h-6 px-0 text-xs text-primary"><Play size={12} />Ver Spot</Button></div>
               <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setPin(null)} className="h-7 w-7"><X size={16} /></Button>
            </div>
           ) : (
              <Button variant="secondary" onClick={() => mine ? toast("Tu Spot · Hace 1 min · 1,2K vistas") : onOpen("ciudad")} className="absolute inset-x-3 bottom-3 h-auto justify-start gap-3 rounded-xl border border-primary/50 bg-background/90 p-2 text-left backdrop-blur"><span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-accent"><img src={mine ? valenciaSunset : imgs[0]} alt="" className="h-full w-full object-cover" /></span><span><strong className="block text-sm">{mine ? "Tu Spot" : town}</strong><span className="block text-xs text-muted-foreground">{mine ? "Hace 1 min · 1,2K vistas" : "246 personas cerca · 8 en directo · Ver muro"}</span></span></Button>
          )}
        </section>
      )}
       {tab === "Mapa" && <div className="mx-4 mt-2 grid grid-cols-5 gap-1">{imgs.slice(0,5).map((img,i) => <Button key={i} variant="ghost" onClick={() => setPin(i)} aria-label={`Spot cercano ${i+1}`} className="aspect-square h-auto overflow-hidden rounded-md p-0"><img src={img} alt="" className="h-full w-full object-cover" /></Button>)}</div>}
       <div className="mx-4 mt-3 flex gap-2 overflow-x-auto">{([["ciudad", "Ciudades y pueblos"], ["comunidades", "Comunidades"], ["eventos", "Eventos"], ["buscar", "Buscar con voz"]] as [Sheet, string][]).map(([k, l]) => <Button key={l} size="sm" variant="secondary" onClick={() => onOpen(k)} className="shrink-0 rounded-full text-xs">{l}</Button>)}<Button size="sm" variant="secondary" onClick={() => setPicker(true)} className="shrink-0 rounded-full text-xs">{town} ▾</Button></div>

      {tab === "Fotos" && (
        <section className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Fotos cerca de ti · {f.km} km</p><Button size="sm" onClick={() => setUpload(true)}><Camera size={16} />Subir</Button></div>
          <div className="mt-3 columns-2 gap-2">
            {shownPhotos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hay fotos a {f.km} km. Amplía la distancia en Filtros.</p>}
            {shownPhotos.map((p) => { const i = photos.indexOf(p); return (
              <button key={p.t} onClick={() => setPhoto(p)} className="relative mb-2 block w-full overflow-hidden rounded-xl">
                <img src={imgs[i % imgs.length]} alt={p.t} loading="lazy" className={`w-full object-cover ${i % 3 === 0 ? "aspect-[3/4]" : "aspect-square"}`} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2 text-left text-2xs"><strong className="block">{p.p}</strong>{p.d}{["Laura", "Sofía", "Carlos"].includes(p.u) && <BadgeCheck size={12} aria-label="Autor verificado de ejemplo" className="ml-1 inline text-primary" />}</span>
              </button>
            ); })}
          </div>
        </section>
      )}

      {tab === "Personas" && (
        <section className="space-y-3 p-4">
          <div className="flex gap-1 overflow-x-auto">{(["Cerca", "Nuevos", "Verificados", "Online"] as const).map(x=><Button key={x} size="sm" variant={peopleFilter===x?"default":"secondary"} onClick={()=>setPeopleFilter(x)} className={peopleFilter===x?"spot-active-pill rounded-full text-xs":"rounded-full text-xs"}>{x === "Online" ? <><span className="h-2 w-2 shrink-0 rounded-full bg-online" aria-hidden="true" />En línea</> : x}</Button>)}</div>
          <CloudPeopleNearby />
          <p className="text-2xs text-muted-foreground">Personas y distintivos de ejemplo</p>
          {shownPeople.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nadie cumple estos filtros. Prueba a quitar alguno.</p>}
          {shownPeople.map((p) => (
            <button key={p.n} onClick={() => setPerson(p)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left">
              <div className="relative h-12 w-12 shrink-0 rounded-full bg-spot-gradient p-[0.125rem]"><img src={p.image} alt="" className="h-full w-full rounded-full object-cover"/>{p.live && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-live" />}</div>
              <div className="flex-1"><p className="flex items-center gap-1 font-semibold">{p.n}{p.v && <BadgeCheck size={14} className="text-primary" />}</p><p className="text-xs text-muted-foreground">{p.d} · {p.i}</p></div>
              <span className="text-xs text-primary">Ver</span>
            </button>
          ))}
        </section>
      )}

      {tab === "Lugares" && (
        <section className="space-y-3 p-4">
          {places.map(([n, c, s], i) => (
            <div key={n} onClick={() => setPlace(i)} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
              <img src={imgs[i % imgs.length]} alt={n} className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex-1"><p className="font-semibold">{n}</p><p className="text-xs text-muted-foreground">{c}</p><p className="text-xs text-primary">{s}</p></div>
              <Button size="icon" variant="secondary" aria-label={`Escuchar ${n}`} onClick={(e) => { e.stopPropagation(); toast(`Audio de ${n}`); }}><Play size={16} /></Button>
            </div>
          ))}
        </section>
      )}

      {picker && (
        <Modal title="Elige zona" onClose={() => setPicker(false)}>
          <p className="text-xs font-semibold text-muted-foreground">PROVINCIA</p>
          <div className="mt-2 flex flex-wrap gap-2">{Object.keys(geo).map((p) => <Chip key={p} on={prov === p} onClick={() => { setProv(p); setTown(geo[p]![0]!); }}>{p}</Chip>)}</div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">MUNICIPIO</p>
          <div className="mt-2 flex flex-wrap gap-2">{(geo[prov] ?? []).map((t) => <Chip key={t} on={town === t} onClick={() => setTown(t)}>{t}</Chip>)}</div>
          <Button className="mt-5 w-full" onClick={() => { setPicker(false); toast.success(`Explorando ${town}`); }}>Ver {town}</Button>
        </Modal>
      )}

      {filters && (
        <Modal title="Filtros" onClose={() => setFilters(false)}>
          <p className="text-sm font-semibold">Distancia: {f.km} km</p>
          <input type="range" min={1} max={50} value={f.km} onChange={(e) => setF({ ...f, km: +e.target.value })} className="mt-2 w-full accent-[var(--primary)]" />
          <p className="mt-4 text-sm font-semibold">Cuándo</p>
          <div className="mt-2 flex gap-2">{["Ahora", "Hoy", "Esta semana"].map((w) => <Chip key={w} on={f.when === w} onClick={() => setF({ ...f, when: w })}>{w}</Chip>)}</div>
          <p className="mt-4 text-sm font-semibold">Mostrar solo</p>
          <div className="mt-2 flex flex-wrap gap-2">{["Verificados", "En directo", "Eventos", "Negocios"].map((o) => <Chip key={o} on={f.only.includes(o)} onClick={() => setF({ ...f, only: f.only.includes(o) ? f.only.filter((x) => x !== o) : [...f.only, o] })}>{o}</Chip>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setF({ km: 5, when: "Ahora", only: [] })}>Limpiar</Button><Button onClick={() => { setFilters(false); toast.success("Filtros aplicados"); }}>Aplicar</Button></div>
        </Modal>
      )}

      {photo && <PhotoDetail p={photo} img={imgs[photos.indexOf(photo) % imgs.length]!} onBack={() => setPhoto(null)} />}
      {person && <PersonDetail p={person} onBack={() => setPerson(null)} />}
      {place !== null && <Modal title={places[place]![0]} onClose={() => setPlace(null)}>
        <img src={imgs[place % imgs.length]} alt={places[place]![0]} className="aspect-video w-full rounded-xl object-cover" />
        <p className="mt-3 text-sm text-muted-foreground">{places[place]![1]} · <span className="text-primary">{places[place]![2]}</span></p>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">LO QUE DICE LA GENTE</p>
        {["Laura · 0:18", "Carlos · 0:32"].map((v) => <button key={v} onClick={() => toast(`Escuchando a ${v.split(" ")[0]}`)} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-secondary p-2 text-left text-sm"><Play size={14} className="text-primary" />{v}</button>)}
        <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => toast("Ruta abierta en el mapa")}><Navigation size={16} />Cómo llegar</Button><Button onClick={() => { setPlace(null); toast.success("Opinión de voz enviada"); }}><Mic size={16} />Opinar con voz</Button></div>
      </Modal>}
      {upload && <UploadPhoto town={town} onClose={() => setUpload(false)} />}
    </main>
  );
}

/** Con la nube: personas reales de tu ciudad y las últimas en llegar a Spotly (encima de las de ejemplo). */
function CloudPeopleNearby() {
  const cloud = useCloud();
  const me = useMe();
  const [city, setCity] = useState<api.ProfileRow[] | null>(null);
  const [fresh, setFresh] = useState<api.ProfileRow[] | null>(null);
  const [open, setOpen] = useState<api.ProfileRow | null>(null);
  useEffect(() => {
    if (!cloud.on) return;
    const uid = cloudUid() ?? undefined;
    void api.discoverPeople(db(), { city: me.city, exclude: uid, limit: 20 }).then(setCity).catch(() => setCity([]));
    void api.discoverPeople(db(), { exclude: uid, limit: 12 }).then(setFresh).catch(() => setFresh([]));
  }, [cloud.on, me.city]);
  if (!cloud.on) return null;
  const row = (p: api.ProfileRow) => (
    <div key={p.id} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button onClick={() => setOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="h-12 w-12 shrink-0 rounded-full bg-spot-gradient p-[0.125rem]"><PersonAvatar p={p} className="h-full w-full text-base" /></div>
        <div className="min-w-0"><p className="truncate font-semibold">{p.display_name || p.username}</p><p className="truncate text-xs text-muted-foreground">@{p.username}{p.city ? ` · ${p.city}` : ""} · {p.spots} Spots</p></div>
      </button>
      <FollowButton id={p.id} />
    </div>
  );
  const others = (fresh ?? []).filter((p) => !(city ?? []).some((c) => c.id === p.id));
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">En {me.city || "tu ciudad"}</h3>
      {!city && <p className="py-3 text-center text-xs text-muted-foreground">Buscando…</p>}
      {city && !city.length && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aún no hay nadie más de {me.city || "tu ciudad"} en Spotly. ¡Invita a tu gente!</p>}
      {city?.map(row)}
      {others.length > 0 && <><h3 className="pt-2 text-sm font-bold">Nuevas en Spotly</h3>{others.map(row)}</>}
      {open && <AuthorProfile name={open.display_name || open.username} id={open.id} avatar={fileUrl(open.avatar_path)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{children}</button>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <BottomSheet title={title} onClose={onClose} z={50}>{children}</BottomSheet>;
}

function PhotoDetail({ p, img, onBack }: { p: Photo; img: string; onBack: () => void }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col overflow-hidden bg-black">
      {/* Foto fullscreen */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
        <img src={img} alt={p.t} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
        {/* Botón atrás */}
        <button onClick={onBack} aria-label="Volver" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm" style={{ top: "var(--safe-header)" }}><ChevronLeft size={24} /></button>
        {/* Acciones laterales derecha */}
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
          <button onClick={() => setLiked(!liked)} aria-label="Me gusta" className="flex flex-col items-center gap-1">
            <Heart size={28} className={liked ? "text-accent" : "text-white"} fill={liked ? "currentColor" : "none"} />
            <span className="text-xs font-bold text-white">{p.l + (liked ? 1 : 0)}</span>
          </button>
          <button onClick={() => toast(`Escuchando la voz de ${p.u}`)} aria-label="Escuchar" className="flex flex-col items-center gap-1">
            <Play size={26} className="text-white" />
            <span className="text-xs font-bold text-white">Escuchar</span>
          </button>
          <button onClick={() => toast.success("Respuesta de voz enviada")} aria-label="Responder con voz" className="flex flex-col items-center gap-1">
            <Mic size={26} className="text-white" />
            <span className="text-xs font-bold text-white">Voz</span>
          </button>
          <button onClick={() => { setSaved(!saved); toast(saved ? "Quitada de guardados" : "Guardada"); }} aria-label="Guardar" className="flex flex-col items-center gap-1">
            <Navigation size={26} className={saved ? "text-primary" : "text-white"} />
            <span className="text-xs font-bold text-white">Enviar</span>
          </button>
        </div>
        {/* Chip ciudad */}
        <div className="absolute bottom-5 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{p.p} · {p.d}
        </div>
      </div>

      {/* Info scrollable */}
      <div className="flex-1 overflow-y-auto bg-background px-4 pb-6 pt-4">
        <h2 className="text-xl font-bold">{p.t}</h2>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} className="text-primary" />{p.p} · {p.d} · por {p.u}</p>
        <p className="mt-3 text-sm text-muted-foreground">Foto con audio de {p.u}. Escucha el contexto y responde con tu voz.</p>
      </div>
    </div>
  );
}

function PersonDetail({ p, onBack }: { p: Person; onBack: () => void }) {
  const [follow, setFollow] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [voice, setVoice] = useState(false);
  const grid = [0, 1, 2, 3, 4, 5].map((i) => imgs[i % imgs.length]!);
  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[520px] overflow-y-auto bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="bg-spot-surface px-4 pb-6 pt-[var(--safe-header)] text-center">
        <div className="text-left"><Button variant="ghost" size="icon" aria-label="Volver" onClick={onBack}><ChevronLeft size={24} /></Button></div>
        <div className="mx-auto h-24 w-24 rounded-full bg-spot-gradient p-[0.1875rem] shadow-glow"><img src={p.image} alt={p.n} className="h-full w-full rounded-full object-cover"/></div>
        <h2 className="mt-3 flex items-center justify-center gap-1 text-xl font-bold">{p.n}{p.v && <BadgeCheck size={18} className="text-primary" />}</h2>
        <p className="text-sm text-muted-foreground">A {p.d} · {p.i}</p>
        {p.live && <p className="mt-1 text-xs text-live">● En directo ahora</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={follow ? "secondary" : "default"} onClick={() => { setFollow(!follow); if (!follow) toast.success(`Sigues a ${p.n}`); }}>{follow ? <Check size={16} /> : <UserPlus size={16} />}{follow ? "Siguiendo" : "Seguir"}</Button>
          <Button variant="secondary" className="whitespace-nowrap px-3" onClick={() => setVoice(true)}><Mic size={16} />Mensaje de voz</Button>
        </div>
      </div>
      <section className="grid grid-cols-3 gap-1 p-1">{grid.map((img, i) => <button key={i} onClick={() => setViewer(i)} aria-label={`Ver foto ${i + 1} de ${p.n}`} className="block overflow-hidden"><img src={img} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform active:scale-95" /></button>)}</section>
      {viewer !== null && <MediaViewer start={viewer} onClose={() => setViewer(null)} items={grid.map((img, k) => {
        const m = sampleMedia.find((x) => x.img === img);
        return { kind: "foto" as const, src: img, caption: m?.caption ?? `Foto de ${p.n}`, place: m?.place ?? "Sevilla", likes: (m?.likes ?? 120) + k * 7 };
      })} />}
      {voice && <VoiceReply name={p.n} mode="message" onClose={() => setVoice(false)} />}
    </div>
  );
}

function UploadPhoto({ town, onClose }: { town: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  return (
    <Modal title={step === 0 ? "Subir foto" : step === 1 ? "Añade tu voz" : "¡Foto publicada!"} onClose={onClose}>
      {step === 0 && <div className="grid grid-cols-2 gap-2">{imgs.map((im, i) => <button key={i} onClick={() => setStep(1)}><img src={im} alt="Elegir" className="aspect-square w-full rounded-xl object-cover" /></button>)}</div>}
      {step === 1 && <div className="text-center"><button aria-label="Grabar" onClick={() => setStep(2)} className="spot-pulse mx-auto grid h-20 w-20 place-items-center rounded-full bg-spot-gradient shadow-glow"><Mic size={32} /></button><p className="mt-3 text-sm text-muted-foreground">Pulsa y cuenta qué se ve · {town}</p></div>}
      {step === 2 && <div className="text-center"><Check className="mx-auto text-primary" size={40} /><p className="mt-2 text-sm">Aparece en el muro de {town} y en Fotos cercanas.</p><Button className="mt-4 w-full" onClick={onClose}>Listo</Button></div>}
    </Modal>
  );
}
