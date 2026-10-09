import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Bookmark, Camera, ChevronLeft, ChevronRight, Compass, Flame, Heart, Image as ImageIcon, List, LayoutGrid, MapPin, Mic, MoreHorizontal, Music, Play, Plus, Search, Share2, SlidersHorizontal, Tag, Users, CalendarPlus, X, Check, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, Chip, Screen, StateCard, Trust } from "./kit";
import { useApp } from "./app-context";
import { useGate } from "./Voice";
import { listenToVoices, threadGroups, VoiceRow, VoiceThread } from "./VoiceThread";
import { useCurrentVoice } from "@/lib/voice/player";
import { useThread } from "@/lib/voice/notes";
import { sampleThread } from "@/lib/voice/samples";
import { clockToMs } from "@/lib/voice/notes";
import { seededPeaks, detachClip } from "@/lib/voice/recorder";
import { LocationOff } from "./Status";
import { SpainMap, spainCities } from "./SpainMap";
import { PlaceBrowser } from "./Places";
import { isCapital, municipiosOf, norm, provinceOfPlace, searchPlaces, type Province } from "@/lib/geo";
import { toggleFollow, useStore, useMe } from "@/lib/store";
import { videoFor } from "@/lib/media";
import { useCloud } from "@/lib/cloud";
import { publishSpot, useCloudFeed } from "@/lib/spots";
import { cloudErrorText } from "@/lib/cloud";
import { spotData } from "./spotData";
import { SpotDetail, type SpotInfo } from "./SpotDetail";
import { VoiceRecordTile } from "./VoiceRecord";
import type { VoiceClip } from "@/lib/voice/recorder";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import night from "@/assets/seville-night.jpg";
import sunset from "@/assets/valencia-sunset.jpg";
import salon from "@/assets/spotly-salon.jpg";
import laura from "@/assets/spotly-laura.jpg";
import me from "@/assets/spotly-me.jpg";

/* Contrato de datos (ver docs/BACKEND_CONTRACT.md → Fotos): Place, Photo, PhotoFilters. */
type Kind = "ciudad" | "pueblo";
export const geo: Record<string, { name: string; kind: Kind }[]> = {
  Sevilla: [{ name: "Sevilla", kind: "ciudad" }, { name: "Dos Hermanas", kind: "ciudad" }, { name: "Carmona", kind: "pueblo" }, { name: "Osuna", kind: "pueblo" }, { name: "Estepa", kind: "pueblo" }],
  Málaga: [{ name: "Málaga", kind: "ciudad" }, { name: "Ronda", kind: "pueblo" }, { name: "Mijas", kind: "pueblo" }],
  Cádiz: [{ name: "Cádiz", kind: "ciudad" }, { name: "Tarifa", kind: "pueblo" }, { name: "Vejer", kind: "pueblo" }],
  Valencia: [{ name: "Valencia", kind: "ciudad" }, { name: "Cullera", kind: "pueblo" }, { name: "Gandía", kind: "ciudad" }],
  Madrid: [{ name: "Madrid", kind: "ciudad" }, { name: "Alcalá", kind: "ciudad" }, { name: "Chinchón", kind: "pueblo" }],
  Barcelona: [{ name: "Barcelona", kind: "ciudad" }, { name: "Sitges", kind: "pueblo" }],
  Girona: [{ name: "Tossa de Mar", kind: "pueblo" }],
};
const placeInfo: Record<string, { photos: string; people: string; img: string }> = {
  Sevilla: { photos: "124K", people: "12,4K", img: night }, Madrid: { photos: "324K", people: "31K", img: festival }, Barcelona: { photos: "198K", people: "19K", img: beach },
  Valencia: { photos: "142K", people: "14K", img: sunset }, Málaga: { photos: "96K", people: "9,1K", img: beach }, Ronda: { photos: "8,4K", people: "1,2K", img: stage },
  Cádiz: { photos: "64K", people: "6K", img: sunset }, Cullera: { photos: "5,1K", people: "800", img: sunset }, "Tossa de Mar": { photos: "6,3K", people: "940", img: sunset },
};
const provOf = (town: string) => Object.entries(geo).find(([, l]) => l.some((t) => t.name === town))?.[0] ?? provinceOfPlace(town)?.n ?? "Sevilla";
const kindOf = (town: string): Kind => Object.values(geo).flat().find((t) => t.name === town)?.kind ?? (isCapital(town) ? "ciudad" : "pueblo");
const info = (town: string) => placeInfo[town] ?? { photos: "1,2K", people: "210", img: festival };

const cats = ["Playas", "Naturaleza", "Ciudades", "Gastronomía", "Fiestas", "Deportes", "Cultura", "Atardeceres", "Vida nocturna", "Planes", "Arte", "Arquitectura"] as const;
type Cat = (typeof cats)[number];
type Ctype = "Todo" | "Fotos" | "Vídeos" | "Reels";
type Photo = { id: number; img: string; town: string; dist: number; author: string; verified: boolean; likes: number; dur: string; mins: number; caption: string; cat: Cat; type: Exclude<Ctype, "Todo">; mine?: boolean };
const imgs = [festival, stage, beach, night, sunset, salon, laura];
const towns = ["Sevilla", "Sevilla", "Carmona", "Sevilla", "Valencia", "Dos Hermanas", "Osuna", "Sevilla", "Cullera", "Estepa", "Málaga", "Sevilla", "Ronda", "Cádiz", "Madrid", "Sevilla", "Tarifa", "Carmona", "Madrid", "Barcelona", "Tossa de Mar", "Ronda", "Sitges", "Valencia"];
const authors = ["Laura", "Carlos", "Marta", "Sofía", "Javi", "Ana"];
const captions = ["Atardecer desde el puente", "Música en la calle", "Mercado a rebosar", "Terraza tranquila", "Plaza llena", "Fachadas de barrio", "Feria de noche", "Callejón con historia"];
const dists = [0.3, 0.8, 6, 1.2, 2.1, 12, 9, 0.5, 4, 14, 1.9, 2.5, 20, 30, 40, 1.1, 50, 7, 42, 45, 48, 21, 44, 3.5];
const baseAll: Photo[] = towns.map((town, i) => ({
  id: i, img: imgs[i % imgs.length]!, town, dist: dists[i]!, author: authors[i % authors.length]!, verified: i % 4 !== 3, likes: 120 + ((i * 197) % 1900), dur: `0:${String(8 + ((i * 7) % 22)).padStart(2, "0")}`,
  mins: 3 + ((i * 11) % 90), caption: captions[i % captions.length]!, cat: cats[(i * 5) % cats.length]!, type: i % 6 === 2 ? "Vídeos" : i % 6 === 5 ? "Reels" : "Fotos",
}));

type Filters = { type: Ctype; km: number; cats: Cat[]; when: "Cualquiera" | "Hoy" | "Esta semana" | "Este mes"; order: "Más recientes" | "Más populares" };
const noFilters: Filters = { type: "Todo", km: 50, cats: [], when: "Cualquiera", order: "Más recientes" };
const whenMax = { Cualquiera: Infinity, Hoy: 24 * 60, "Esta semana": 7 * 24 * 60, "Este mes": 30 * 24 * 60 } as const;
const fmtKm = (k: number) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toString().replace(".", ",")} km`);
const fmtN = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}K` : `${n}`);
const applyFilters = (l: Photo[], f: Filters) => {
  let r = l.filter((p) => (f.type === "Todo" || p.type === f.type) && p.dist <= f.km && (!f.cats.length || f.cats.includes(p.cat)) && p.mins <= whenMax[f.when]);
  r = r.sort((a, b) => (f.order === "Más populares" ? b.likes - a.likes : a.mins - b.mins));
  return r;
};
const activeCount = (f: Filters) => (f.type !== "Todo" ? 1 : 0) + (f.km < 50 ? 1 : 0) + f.cats.length + (f.when !== "Cualquiera" ? 1 : 0) + (f.order !== "Más recientes" ? 1 : 0);

type Mode = "Explorar" | "Para ti" | "Cerca" | "Mapa" | "Lista";
type Layout = "Cuadrícula" | "Lista";

export function PhotoWall({ onBack, initialPlace }: { onBack: () => void; initialPlace?: string | undefined }) {
  const app = useApp();
  const { perms, offline, following, demo } = useStore();
  const me = useMe();
  const [mode, setMode] = useState<Mode>("Explorar");
  const [place, setPlace] = useState<string | null>(initialPlace && initialPlace !== "Triana" ? initialPlace : null);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [upload, setUpload] = useState(false);
  const [mine, setMine] = useState<Photo[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat | null>(null);
  const all = useMemo(() => [...mine, ...baseAll], [mine]);

  const searchHits = q.trim() ? searchPlaces(q, 8).map((h) => h.name).filter((n, i, a) => a.indexOf(n) === i) : [];
  const nf = activeCount(filters);
  const tabs: Mode[] = ["Explorar", "Para ti", "Cerca", "Mapa", "Lista"];

  const header = (
    <>
      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-secondary px-3.5"><Search size={16} className="text-primary" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ciudad, pueblo…" aria-label="Buscar ciudad o pueblo" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />{q && <button aria-label="Borrar búsqueda" onClick={() => setQ("")}><X size={15} /></button>}</label>
        <Button variant="secondary" size="icon" className="relative h-11 w-11 rounded-full" aria-label="Filtros avanzados" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={17} />{nf > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-live px-1 text-4xs font-bold">{nf}</span>}</Button>
      </div>
      {searchHits.length > 0 && <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">{searchHits.map((n) => <button key={n} onClick={() => { setPlace(n); setQ(""); }} className="flex w-full items-center gap-3 p-3 text-left text-sm"><MapPin size={15} className="text-primary" />{n}<small className="ml-auto text-muted-foreground">{kindOf(n)} · {provOf(n)}</small></button>)}</div>}
      {q.trim() && searchHits.length === 0 && <p className="mt-2 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No encontramos “{q}”. Prueba con otra ciudad o pueblo.</p>}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist">{tabs.map((t) => <Chip key={t} active={mode === t} onClick={() => setMode(t)}>{t}</Chip>)}</div>
    </>
  );

  return (
    <Screen title="Explorar fotos" sub="Fotos con voz de ciudades y pueblos" onBack={onBack} z={50}>
      {header}
      <div className="mt-3">
        {!offline && (mode === "Explorar" || mode === "Para ti" || mode === "Lista") && <RealPhotos title={mode === "Explorar" ? "Recientes en Spotly" : undefined} />}
        {!offline && mode === "Cerca" && perms.location && <RealPhotos city={me.city} title={`En ${me.city}`} />}
        {offline ? <StateCard icon={Camera} tone="muted" title="Sin conexión" text="Verás lo último que cargó. No podemos traer fotos nuevas ahora." action="Reintentar" onAction={() => toast.error("Sigues sin conexión")} />
          : mode === "Explorar" ? <ExploreHome cats={cats.slice(0, 4)} all={all} onPlace={setPlace} onCat={(c) => { setCat(c); }} onOpen={setOpen} onUpload={() => setUpload(true)} onMode={setMode} onStory={(s) => (s === "mine" ? setUpload(true) : setPlace(s))} />
          : mode === "Para ti" ? <Feed all={all} filters={filters} onOpen={setOpen} following={following} />
          : mode === "Cerca" ? (perms.location ? <Grid list={applyFilters(all.filter((p) => p.dist <= 5), filters)} onOpen={setOpen} empty="No hay fotos cerca con estos filtros." onClear={() => setFilters(noFilters)} /> : <LocationOff />)
          : mode === "Mapa" ? <PhotoMap all={all} onPlace={setPlace} onOpen={setOpen} />
          : <ListView list={applyFilters(all, filters)} onOpen={setOpen} />}
      </div>
      <Button className="mt-4 w-full rounded-full bg-spot-gradient text-foreground" onClick={() => setUpload(true)}><Camera size={16} />Subir una foto con mi voz</Button>
      <div className="mt-3"><Trust>{demo ? "El contenido lo publican personas verificadas. Los rankings y “Tendencias” salen de la actividad real; lo impulsado se marca como tal." : "Las fotos de la comunidad son Spots con voz. Las marcadas «ejemplo» son de muestra y sus cifras no son reales."}</Trust></div>

      {cat && <CategorySheet cat={cat} all={all} onClose={() => setCat(null)} onOpen={(p) => { setCat(null); setOpen(p); }} />}
      {place && <PlacePage place={place} all={all} filters={filters} onBack={() => setPlace(null)} onOpen={setOpen} onPick={() => setPicker(true)} onFilters={() => setFilterOpen(true)} onMap={() => { setPlace(null); setMode("Mapa"); }} />}
      {picker && <PlacePicker onClose={() => setPicker(false)} onPick={(n) => { setPlace(n); setPicker(false); }} />}
      {filterOpen && <FiltersSheet value={filters} onClose={() => setFilterOpen(false)} onApply={(f) => { setFilters(f); setFilterOpen(false); toast.success("Filtros aplicados"); }} />}
      {open && <PhotoDetail p={open} onClose={() => setOpen(null)} onMore={(t) => { setPlace(t); setOpen(null); }} />}
      {upload && <PhotoUpload onClose={() => setUpload(false)} defaultPlace={place ?? me.city ?? "Sevilla"} onPublished={(p) => { if (p) setMine((m) => [p, ...m]); setUpload(false); setMode("Para ti"); toast.success("Foto publicada con tu voz"); }} onCamera={() => { setUpload(false); app.create(); }} />}
    </Screen>
  );
}

/* ---------- Fotos reales de la comunidad (nube) ---------- */
/** Spots con foto o vídeo de la nube (de un lugar o de toda España), con scroll infinito y su detalle con voz. */
export function RealPhotos({ city, title }: { city?: string | undefined; title?: string | undefined }) {
  const cloud = useCloud();
  const me = useMe();
  const feed = useCloudFeed({ kind: "recent", city, media: true, enabled: cloud.on });
  const [open, setOpen] = useState<SpotInfo | null>(null);
  const more = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = more.current;
    if (!el || !feed.hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) feed.loadMore(); }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed, feed.hasMore]);
  if (!cloud.on) return null;
  const list = feed.spots.map((m) => spotData(m, me.name));
  if (feed.status === "ready" && !list.length) return null;
  return (
    <section className="mb-4" aria-label={title ?? "Fotos de la comunidad"}>
      {title && <h3 className="mb-2 text-sm font-bold">{title}</h3>}
      {feed.status === "loading" && !list.length && <div className="grid place-items-center py-6"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
      <div className="columns-2 gap-2">{list.map((d, i) => (
        <button key={d.id} onClick={() => setOpen(d)} className="relative mb-2 block w-full overflow-hidden rounded-xl text-left" aria-label={`${d.text}, ${d.city}`}>
          {d.video ? <video src={d.video} muted playsInline preload="metadata" className={"w-full bg-black object-cover " + (i % 3 === 0 ? "aspect-[3/4]" : "aspect-square")} /> : <img src={d.img} alt="" loading="lazy" className={"w-full object-cover " + (i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/5]")} />}
          <span className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
          {d.video && <span className="absolute right-2 top-2 rounded bg-background/70 px-1.5 py-0.5 text-4xs font-bold">VÍDEO</span>}
          {d.own && <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-4xs font-bold text-primary-foreground">TUYA</span>}
          <span className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-1 text-2xs font-semibold"><span className="flex items-center gap-1"><Heart size={12} fill="currentColor" className="text-accent" />{fmtN(d.likes)}</span><span className="flex min-w-0 items-center gap-1 text-foreground/85"><MapPin size={11} className="shrink-0" /><span className="truncate">{d.city}</span></span></span>
        </button>))}</div>
      {feed.hasMore && <div ref={more} className="h-6" aria-hidden="true" />}
      {open && <SpotDetail s={open} onClose={() => setOpen(null)} onAuthor={() => setOpen(null)} />}
    </section>
  );
}

/* ---------- Explorar (lámina 2/13/14/15) ---------- */
function ExploreHome({ cats: topCats, onPlace, onCat, onUpload, onMode, onStory }: { cats: readonly Cat[]; all?: Photo[]; onPlace: (p: string) => void; onCat: (c: Cat) => void; onOpen?: (p: Photo) => void; onUpload: () => void; onMode: (m: Mode) => void; onStory: (s: string) => void }) {
  const { demo } = useStore();
  const myAvatar = useMe().avatar;
  const stories = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Ronda"];
  const trending = [["Madrid", "12,4K"], ["Barcelona", "11,2K"], ["Sevilla", "9,8K"], ["Valencia", "8,1K"], ["Málaga", "6,7K"]] as const;
  return (
    <div className="space-y-5">
      <section aria-label="Historias por ciudad"><h3 className="mb-2 text-sm font-bold">Historias por ciudad</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button onClick={() => onStory("mine")} className="flex w-16 shrink-0 flex-col items-center gap-1"><span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-primary bg-secondary">{myAvatar ? <img src={myAvatar} alt="" className="h-full w-full rounded-full object-cover opacity-70" /> : <Camera size={20} className="text-primary" />}<span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Plus size={12} /></span></span><span className="text-2xs">Tu historia</span></button>
          {stories.map((s) => <button key={s} onClick={() => onStory(s)} className="flex w-16 shrink-0 flex-col items-center gap-1"><span className="rounded-full bg-spot-gradient p-[0.15625rem]"><img src={info(s).img} alt="" className="h-[3.75rem] w-[3.75rem] rounded-full border-2 border-background object-cover" /></span><span className="text-2xs">{s}</span></button>)}
        </div>
      </section>
      <button onClick={() => onPlace("Madrid")} className="relative block w-full overflow-hidden rounded-2xl text-left" aria-label="Ver fotos de España"><img src={festival} alt="" className="aspect-[16/8] w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" /><span className="absolute inset-x-4 bottom-3 flex items-end justify-between"><span><strong className="block text-2xl">España</strong>{demo && <small className="text-foreground/80">1,2M fotos</small>}</span><ChevronRight /></span></button>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Ciudades populares</h3><button onClick={() => onMode("Mapa")} className="text-xs text-primary">Ver en mapa ›</button></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga"].map((c) => <button key={c} onClick={() => onPlace(c)} className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl text-left"><img src={info(c).img} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute inset-x-2 bottom-1.5"><strong className="block text-sm">{c}</strong>{demo && <small className="text-3xs text-foreground/80">{info(c).photos}</small>}</span></button>)}</div>
      </section>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-bold"><Flame size={15} className="text-live" />Tendencias en España</h3><button onClick={() => onMode("Lista")} className="text-xs text-primary">Ver todo ›</button></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{trending.map(([c, n], i) => <button key={c} onClick={() => onPlace(c)} className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl text-left" aria-label={demo ? `${i + 1}. ${c}, ${n} fotos hoy` : `${i + 1}. ${c}`}><img src={info(c).img} alt="" loading="lazy" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-spot-gradient text-3xs font-extrabold">{i + 1}</span><span className="absolute inset-x-1.5 bottom-1"><strong className="block text-2xs">{c}</strong>{demo && <small className="text-4xs text-foreground/80">{n} fotos</small>}</span></button>)}</div>
      </section>
      <section><h3 className="mb-2 text-sm font-bold">Explorar por categorías</h3>
        <div className="grid grid-cols-2 gap-2">{topCats.map((c, i) => <button key={c} onClick={() => onCat(c)} className="relative h-24 overflow-hidden rounded-xl text-left"><img src={imgs[(i * 2 + 2) % imgs.length]} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute inset-x-3 bottom-2"><strong className="block">{c}</strong>{demo && <small className="text-2xs text-foreground/80">{[128, 96, 212, 84][i]}K fotos</small>}</span></button>)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">{cats.slice(4).map((c) => <Chip key={c} active={false} onClick={() => onCat(c)}>{c}</Chip>)}</div>
      </section>
      <section className="rounded-2xl border border-primary/40 bg-primary/10 p-4"><p className="text-sm font-bold">Comparte cómo es tu rincón</p><p className="mt-1 text-xs text-muted-foreground">Sube una foto y cuéntala con tu voz. Gratis.</p><Button className="mt-3 w-full" onClick={onUpload}><Camera size={16} />Subir foto</Button></section>
    </div>
  );
}

function CategorySheet({ cat, all, onClose, onOpen }: { cat: Cat; all: Photo[]; onClose: () => void; onOpen: (p: Photo) => void }) {
  const list = all.filter((p) => p.cat === cat);
  return <BottomSheet title={cat} onClose={onClose} z={58}>{list.length ? <Grid list={list} onOpen={onOpen} /> : <StateCard icon={ImageIcon} tone="muted" title={`Aún no hay fotos de ${cat.toLowerCase()}`} text="Sube la primera y aparecerá aquí." />}</BottomSheet>;
}

/* ---------- Feed general (lámina 3/16) ---------- */
function Feed({ all, filters, onOpen, following }: { all: Photo[]; filters: Filters; onOpen: (p: Photo) => void; following: string[] }) {
  const [sub, setSub] = useState<"Para ti" | "Siguiendo" | "Sugerencias">("Para ti");
  const list = applyFilters(all, filters);
  const shown = sub === "Siguiendo" ? list.filter((p) => following.includes(p.author) || p.mine) : sub === "Sugerencias" ? list.filter((p) => !following.includes(p.author) && !p.mine) : list;
  return (
    <div>
      <div className="flex gap-1.5">{(["Para ti", "Siguiendo", "Sugerencias"] as const).map((s) => <Chip key={s} active={sub === s} onClick={() => setSub(s)}>{s}</Chip>)}</div>
      <div className="mt-3">{shown.length ? <Grid list={shown} onOpen={onOpen} /> : <StateCard icon={Users} tone="muted" title={sub === "Siguiendo" ? "Aún no sigues a nadie" : "Sin resultados"} text={sub === "Siguiendo" ? "Sigue a personas desde su perfil o desde Sugerencias para ver sus fotos aquí." : "Prueba a quitar algún filtro."} action={sub === "Siguiendo" ? "Ver sugerencias" : undefined} onAction={() => setSub("Sugerencias")} />}</div>
    </div>
  );
}

function Grid({ list, onOpen, empty, onClear }: { list: Photo[]; onOpen: (p: Photo) => void; empty?: string | undefined; onClear?: (() => void) | undefined }) {
  const { demo } = useStore();
  if (!list.length) return <StateCard icon={Camera} tone="muted" title="Aún no hay fotos aquí" text={empty ?? "Sé la primera persona en contar cómo es este sitio."} action={onClear ? "Quitar filtros" : undefined} onAction={onClear} />;
  return (
    <div className="columns-2 gap-2">{list.map((p, i) => (
      <button key={p.id} onClick={() => onOpen(p)} className="relative mb-2 block w-full overflow-hidden rounded-xl text-left" aria-label={`${p.caption}, ${p.town}`}>
        <img src={p.img} alt="" loading="lazy" className={"w-full object-cover " + (i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/5]")} />
        <span className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
        {p.type !== "Fotos" && <span className="absolute right-2 top-2 rounded bg-background/70 px-1.5 py-0.5 text-4xs font-bold">{p.type === "Vídeos" ? "VÍDEO" : "REEL"}</span>}
        {p.mine && <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-4xs font-bold text-primary-foreground">TUYA</span>}
        {!p.mine && !demo && <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-4xs font-semibold text-white">ejemplo</span>}
        <span className="absolute inset-x-2 bottom-1.5 flex items-center justify-between text-2xs font-semibold">{demo || p.mine ? <span className="flex items-center gap-1"><Heart size={12} fill="currentColor" className="text-accent" />{fmtN(p.likes)}</span> : <span />}<span className="flex items-center gap-1 text-foreground/85"><MapPin size={11} />{demo ? fmtKm(p.dist) : p.town}</span></span>
      </button>))}</div>
  );
}

/* ---------- Formato lista (lámina 11) ---------- */
function ListView({ list, onOpen }: { list: Photo[]; onOpen: (p: Photo) => void }) {
  const { demo } = useStore();
  const [t, setT] = useState<"Recientes" | "Populares">("Recientes");
  const l = [...list].sort((a, b) => (t === "Populares" ? b.likes - a.likes : a.mins - b.mins));
  return (
    <div>
      <div className="flex gap-1.5">{(["Recientes", "Populares"] as const).map((s) => <Chip key={s} active={t === s} onClick={() => setT(s)}>{s}</Chip>)}</div>
      <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card px-3">{l.length ? l.map((p) => (
        <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-3 py-3 text-left"><img src={p.img} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.town}</strong><small className="text-muted-foreground">{p.caption}{demo || p.mine ? ` · hace ${p.mins} min` : " · ejemplo"}</small></span>{(demo || p.mine) && <span className="flex items-center gap-1 text-xs text-accent"><Heart size={13} />{fmtN(p.likes)}</span>}</button>)) : <p className="py-8 text-center text-sm text-muted-foreground">No hay fotos con estos filtros.</p>}</div>
    </div>
  );
}

/* ---------- Mapa de fotos (lámina 7): 52 provincias interactivas ---------- */
function PhotoMap({ all, onPlace, onOpen }: { all: Photo[]; onPlace: (p: string) => void; onOpen: (p: Photo) => void }) {
  const { demo } = useStore();
  const [sel, setSel] = useState<string | undefined>("madrid");
  const [prov, setProv] = useState<Province | null>(null);
  const [view, setView] = useState<null | "fotos" | "municipios">(null);
  const c = spainCities.find((x) => x.id === sel);
  const cityHere = !!c && (!prov || provinceOfPlace(c.name)?.c === prov.c);
  const inProv = (p: Province) => all.filter((ph) => norm(provOf(ph.town)) === norm(p.n));
  const list = prov ? inProv(prov) : [];
  const towns = [...new Set(list.map((ph) => ph.town))];
  const nMun = prov ? municipiosOf(prov.c).length : 0;
  return (
    <div>
      <SpainMap className="w-full" selected={cityHere ? sel : undefined} province={prov?.c} onSelect={(p) => setSel(p.id)} onProvince={(p) => { setProv(p); if (!spainCities.some((x) => x.id === sel && provinceOfPlace(x.name)?.c === p.c)) setSel(undefined); }} />
      {cityHere && c ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><img src={info(c.name).img} alt="" className="h-14 w-14 rounded-xl object-cover" /><span className="min-w-0 flex-1"><strong className="block">{c.name}</strong><small className="text-muted-foreground">{demo ? `${info(c.name).photos} fotos · ${all.filter((p) => p.town === c.name).length} en esta demo` : `${all.filter((p) => p.town === c.name).length} de ejemplo · fotos de la comunidad dentro`}</small></span><Button size="sm" onClick={() => onPlace(c.name)}>Ver fotos</Button></div>
      ) : prov ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-spot-gradient text-xl font-extrabold text-primary-foreground">{prov.n.slice(0, 1)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{prov.n}</strong><small className="text-muted-foreground">{prov.r} · {nMun.toLocaleString("es-ES")} {nMun === 1 ? "municipio" : "municipios"} · capital {prov.k}</small></span></div>
          <p className="mt-2 text-xs text-muted-foreground">{list.length ? `${list.length} ${list.length === 1 ? "foto" : "fotos"} en esta demo` : "Aún no hay fotos en esta provincia en la demo."}</p>
          {towns.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{towns.map((t) => <Chip key={t} active={false} onClick={() => onPlace(t)}>{t}</Chip>)}</div>}
          <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setView("municipios")}>Municipios</Button><Button onClick={() => setView("fotos")}>Ver fotos</Button></div>
        </div>
      ) : <p className="mt-3 rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Toca cualquier provincia para verla: hay 52, con Ceuta, Melilla, Canarias y Baleares. Pellizca o usa + / − para acercar.</p>}
      <p className="mt-2 text-2xs text-muted-foreground">Geografía oficial (IGN e INE). Las cifras de actividad son de ejemplo hasta conectar el servidor.</p>
      {view === "fotos" && prov && (
        <Screen title={prov.n} sub={`${prov.r} · ${list.length} ${list.length === 1 ? "foto" : "fotos"} en la demo`} onBack={() => setView(null)} z={52}>
          {towns.length > 0 && <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">{towns.map((t) => <Chip key={t} active={false} onClick={() => { setView(null); onPlace(t); }}>{t}</Chip>)}</div>}
          {list.length ? <Grid list={[...list].sort((a, b) => a.mins - b.mins)} onOpen={onOpen} /> : <StateCard icon={MapPin} tone="muted" title={`Aún no hay fotos en ${prov.n}`} text="Sé de los primeros: sube una foto con voz desde cualquier municipio de la provincia, o explora sus municipios." action="Ver municipios" onAction={() => setView("municipios")} />}
        </Screen>
      )}
      {view === "municipios" && prov && (
        <BottomSheet title={`Municipios de ${prov.n}`} onClose={() => setView(null)} z={80}>
          <PlaceBrowser initialProvince={prov.c} allowProvince={false} onPick={(n) => { setView(null); onPlace(n); }} />
        </BottomSheet>
      )}
    </div>
  );
}

/* ---------- Página de ciudad / pueblo (lámina 4/5) ---------- */
function PlacePage({ place, all, filters, onBack, onOpen, onPick, onFilters, onMap }: { place: string; all: Photo[]; filters: Filters; onBack: () => void; onOpen: (p: Photo) => void; onPick: () => void; onFilters: () => void; onMap: () => void }) {
  const { following, demo } = useStore();
  const [t, setT] = useState<"Todas" | "Recientes" | "Populares" | "Cerca">("Todas");
  const [layout, setLayout] = useState<Layout>("Cuadrícula");
  const key = `lugar:${place}`;
  const on = following.includes(key);
  const base = applyFilters(all.filter((p) => p.town === place), filters);
  const list = t === "Recientes" ? [...base].sort((a, b) => a.mins - b.mins) : t === "Populares" ? [...base].sort((a, b) => b.likes - a.likes) : t === "Cerca" ? base.filter((p) => p.dist <= 5) : base;
  const pi = info(place);
  return (
    <Screen title={place} sub={`${kindOf(place) === "pueblo" ? "Pueblo" : "Ciudad"} · ${provOf(place)}`} onBack={onBack} z={52}>
      <div className="relative -mx-1 overflow-hidden rounded-2xl"><img src={pi.img} alt="" className="aspect-[16/9] w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute inset-x-4 bottom-3"><h3 className="text-3xl font-extrabold">{place}</h3>{demo && <p className="text-xs text-foreground/85">{pi.photos} fotos · {pi.people} personas</p>}</div></div>
      <div className="mt-3 flex items-center gap-2"><Button className="flex-1" variant={on ? "secondary" : "default"} onClick={() => { toggleFollow(key); toast(on ? `Has dejado de seguir ${place}` : `Sigues ${place}`); }}>{on ? <><Check size={15} />Siguiendo</> : "Seguir"}</Button>
        <Button variant="secondary" size="icon" aria-label="Cambiar de lugar" onClick={onPick}><MapPin size={17} /></Button><Button variant="secondary" size="icon" aria-label="Ver en el mapa" onClick={onMap}><Compass size={17} /></Button><Button variant="secondary" size="icon" aria-label="Filtros" onClick={onFilters}><SlidersHorizontal size={17} /></Button>
        <div className="flex rounded-full border border-border bg-secondary p-0.5">{([["Cuadrícula", LayoutGrid], ["Lista", List]] as const).map(([m, I]) => <button key={m} onClick={() => setLayout(m)} aria-label={m} aria-pressed={layout === m} className={"grid h-9 w-9 place-items-center rounded-full " + (layout === m ? "spot-active-pill" : "")}><I size={15} /></button>)}</div></div>
      <div className="mt-3"><RealPhotos city={place} title={`Fotos con voz de ${place}`} /></div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{(["Todas", "Recientes", "Populares", "Cerca"] as const).map((s) => <Chip key={s} active={t === s} onClick={() => setT(s)}>{s}</Chip>)}</div>
      <div className="mt-2">{layout === "Cuadrícula" ? <Grid list={list} onOpen={onOpen} onClear={filters === noFilters ? undefined : undefined} /> : <ListView list={list} onOpen={onOpen} />}</div>
    </Screen>
  );
}

/* ---------- Selector de lugar (lámina 10) ---------- */
function PlacePicker({ onClose, onPick }: { onClose: () => void; onPick: (n: string) => void }) {
  const { perms } = useStore();
  const [tab, setTab] = useState<"España" | "Cerca de mí">("España");
  const near = ["Sevilla", "Dos Hermanas", "Carmona", "Osuna"];
  return (
    <BottomSheet title="Elegir ciudad o pueblo" onClose={onClose} z={64}>
      <div className="flex gap-1.5">{(["España", "Cerca de mí"] as const).map((s) => <Chip key={s} active={tab === s} onClick={() => setTab(s)}>{s}</Chip>)}</div>
      <div className="mt-3">{tab === "España"
        ? <PlaceBrowser onPick={(n) => onPick(n)} />
        : perms.location ? <div className="divide-y divide-border">{near.map((p) => <button key={p} onClick={() => onPick(p)} className="flex w-full items-center gap-3 py-2.5 text-left"><MapPin size={16} className="text-primary" /><span className="flex-1 text-sm">{p}</span><ChevronRight size={16} className="text-muted-foreground" /></button>)}</div> : <div className="py-3"><LocationOff /></div>}</div>
    </BottomSheet>
  );
}

/* ---------- Filtros avanzados (lámina 9/15) ---------- */
function FiltersSheet({ value, onClose, onApply }: { value: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const [f, setF] = useState<Filters>(value);
  const toggleCat = (c: Cat) => setF((s) => ({ ...s, cats: s.cats.includes(c) ? s.cats.filter((x) => x !== c) : [...s.cats, c] }));
  return (
    <BottomSheet title="Filtros" onClose={onClose} z={70} footer={<div className="grid grid-cols-[auto_1fr] gap-2"><Button variant="ghost" onClick={() => setF(noFilters)}>Limpiar</Button><Button className="h-12 rounded-full bg-spot-gradient text-foreground" onClick={() => onApply(f)}>Aplicar filtros</Button></div>}>
      <h4 className="mb-2 text-sm font-bold">Tipo de contenido</h4>
      <div className="flex flex-wrap gap-2">{(["Todo", "Fotos", "Vídeos", "Reels"] as const).map((t) => <Chip key={t} active={f.type === t} onClick={() => setF({ ...f, type: t })}>{t}</Chip>)}</div>
      <div className="mb-2 mt-5 flex items-center justify-between"><h4 className="text-sm font-bold">Distancia</h4><small className="text-muted-foreground">Hasta {f.km} km</small></div>
      <input type="range" min={1} max={50} value={f.km} onChange={(e) => setF({ ...f, km: Number(e.target.value) })} aria-label="Distancia máxima en kilómetros" className="w-full accent-[var(--primary)]" />
      <h4 className="mb-2 mt-5 text-sm font-bold">Categorías</h4>
      <div className="flex flex-wrap gap-2">{cats.map((c) => <Chip key={c} active={f.cats.includes(c)} onClick={() => toggleCat(c)}>{c}</Chip>)}</div>
      <h4 className="mb-2 mt-5 text-sm font-bold">Fecha</h4>
      <div className="flex flex-wrap gap-2">{(["Cualquiera", "Hoy", "Esta semana", "Este mes"] as const).map((t) => <Chip key={t} active={f.when === t} onClick={() => setF({ ...f, when: t })}>{t}</Chip>)}</div>
      <h4 className="mb-2 mt-5 text-sm font-bold">Ordenar por</h4>
      <div className="flex flex-wrap gap-2">{(["Más recientes", "Más populares"] as const).map((t) => <Chip key={t} active={f.order === t} onClick={() => setF({ ...f, order: t })}>{t}</Chip>)}</div>
    </BottomSheet>
  );
}

/* ---------- Detalle de foto (lámina 12) ---------- */
function PhotoDetail({ p, onClose, onMore }: { p: Photo; onClose: () => void; onMore: (t: string) => void }) {
  const me = useMe();
  const { following, demo } = useStore();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  /* Responder abre el panel pegado al audio de la foto (como en el diseño), grabando. */
  const [reply, setReply] = useState(false);
  const [menu, setMenu] = useState(false);
  const section = useRef<HTMLDivElement | null>(null);
  /* Mensajes de voz de la foto: solo voz, con respuestas encadenadas. */
  const threadId = `photo:${p.id}`;
  const seed = useMemo(() => sampleThread(threadId, [
    { key: "a", name: authors[(p.id + 1) % authors.length]!, img: imgs[(p.id + 2) % imgs.length], minsAgo: p.mins + 12, dur: "0:09", likes: 6 },
    { key: "b", name: authors[(p.id + 3) % authors.length]!, img: imgs[(p.id + 4) % imgs.length], minsAgo: p.mins + 5, dur: "0:13", likes: 3, replyTo: "a", replyAt: "0:04" },
  ]), [threadId, p.id, p.mins]);
  const thread = useThread(threadId, seed);
  /* El altavoz del audio de la foto escucha todas sus respuestas seguidas, en el orden en que se ven. */
  const now = useCurrentVoice();
  const voices = useMemo(() => threadGroups(thread).flatMap((g) => [g.root, ...g.replies]), [thread]);
  const listening = !!now.id && voices.some((v) => v.id === now.id);
  const gate = useGate({ verified: true, online: true });
  const follows = following.includes(p.author);
  const clip = p.type !== "Fotos" ? videoFor(p.img) : undefined;
  const [paused, setPaused] = useState(false);
  const togglePlay = (v: HTMLVideoElement) => { if (v.paused) { void v.play().catch(() => undefined); setPaused(false); } else { v.pause(); setPaused(true); } };
  /* Las fotos de ejemplo (y las guardadas solo en tu móvil) no tienen enlace público. */
  const share = () => toast(p.mine ? "Esta foto está guardada solo en tu móvil: no tiene enlace público." : "Foto de ejemplo: no tiene enlace.");
  return (
    <div className="fixed inset-0 z-[62] mx-auto flex max-w-[520px] flex-col overflow-hidden bg-black">
      {/* Foto fullscreen */}
      <div className="relative w-full flex-1 bg-black" style={{ maxHeight: "68vh" }}>
        {clip
          ? <video src={clip} poster={p.img} autoPlay muted loop playsInline aria-label={p.caption} onClick={(e) => togglePlay(e.currentTarget)} className="h-full w-full cursor-pointer object-cover" style={{ aspectRatio: "9/14" }} />
          : <img src={p.img} alt={p.caption} className="h-full w-full object-cover" style={{ aspectRatio: "9/14" }} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
        {clip && paused && <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"><Play size={30} fill="currentColor" /></span>}
        {/* Botón atrás */}
        <button onClick={onClose} aria-label="Volver" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm" style={{ top: "var(--safe-header)" }}><ChevronLeft size={24} /></button>
        {/* Botón más opciones */}
        <button onClick={() => setMenu(true)} aria-label="Más opciones" className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm" style={{ top: "var(--safe-header)" }}><MoreHorizontal size={20} /></button>
        {/* Acciones laterales derecha */}
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
          <button onClick={() => setLiked(!liked)} aria-label="Me gusta" className="flex flex-col items-center gap-1">
            <Heart size={28} className={liked ? "text-accent" : "text-white"} fill={liked ? "currentColor" : "none"} />
            <span className="text-xs font-bold text-white">{demo || p.mine ? fmtN(p.likes + (liked ? 1 : 0)) : "Me gusta"}</span>
          </button>
          <button onClick={() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label={`Escuchar los mensajes de voz (${thread.length})`} className="flex flex-col items-center gap-1">
            <span className="grid h-[2.125rem] w-[2.125rem] place-items-center rounded-full border-2 border-white/80 bg-black/30 backdrop-blur-sm"><Volume2 size={17} className="text-white" /></span>
            <span className="text-xs font-bold text-white">{thread.length}</span>
          </button>
          <button onClick={share} aria-label="Compartir" className="flex flex-col items-center gap-1">
            <Share2 size={26} className="text-white" />
            <span className="text-xs font-bold text-white">Enviar</span>
          </button>
          <button onClick={() => { setSaved(!saved); toast(saved ? "Quitada de guardados" : "Guardada"); }} aria-label="Guardar" className="flex flex-col items-center gap-1">
            <Bookmark size={26} className={saved ? "text-primary" : "text-white"} fill={saved ? "currentColor" : "none"} />
            <span className="text-xs font-bold text-white">Guardar</span>
          </button>
        </div>
        {/* Chip ciudad */}
        <button onClick={() => onMore(p.town)} className="absolute bottom-5 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{p.town} · Ver más <ChevronRight size={12} />
        </button>
      </div>

      {/* Info + audio scrollable */}
      <div className="flex-1 overflow-y-auto bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center gap-3">
          <img src={p.img} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/50" />
          <span className="min-w-0 flex-1">
            <strong className="flex items-center gap-1 text-sm">{p.mine ? "Tú" : p.author}{p.verified && demo && <BadgeCheck size={14} className="text-primary" />}{!p.mine && !demo && <span className="ml-1 rounded-full border border-border px-1.5 text-4xs font-normal text-muted-foreground">ejemplo</span>}</strong>
            <span className="text-xs text-muted-foreground">{p.town} · {fmtKm(p.dist)} · hace {p.mins} min</span>
          </span>
          {!p.mine && <Button size="sm" variant={follows ? "secondary" : "default"} onClick={() => { toggleFollow(p.author); toast(follows ? `Dejaste de seguir a ${p.author}` : `Sigues a ${p.author}`); }}>{follows ? "Siguiendo" : "Seguir"}</Button>}
        </div>
        <p className="mt-3 text-base font-bold">{p.caption}</p>
        {/* El audio de la foto arriba y, pegado a él, el panel para responder y los mensajes de voz. */}
        <div ref={section} className="mt-2 flex scroll-mt-4 flex-col gap-2">
          <VoiceRow id={`${threadId}:audio`} author={{ name: p.author, avatar: p.mine ? undefined : p.img, mine: p.mine, verified: p.verified }} name={p.mine ? me.name : p.author} durationMs={clockToMs(p.dur)} peaks={seededPeaks(`${threadId}:audio`)}
            likes={{ count: demo || p.mine ? p.likes + (liked ? 1 : 0) : liked ? 1 : 0, liked, onToggle: () => setLiked(!liked) }}
            listen={{ count: thread.length, active: listening, onListen: () => listenToVoices(voices, listening) }} onShare={share} onMore={() => setMenu(true)} />
          <VoiceThread threadId={threadId} seed={seed} root={{ name: p.mine ? me.name : p.author, author: { name: p.author, avatar: p.mine ? undefined : p.img, mine: p.mine }, atMs: 0, durationMs: clockToMs(p.dur) }}
            rootPointer composerOpen={reply} onComposerClose={() => setReply(false)} emptyText="Aún no hay mensajes de voz en esta foto. Responde con la tuya." />
        </div>
        {gate && <div className="mt-3">{gate}</div>}
      </div>

      {/* Footer voz */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <button type="button" onClick={() => { setReply(true); section.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="spot-voice-send flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition active:scale-[0.98]"><Mic size={17} />Responder con tu voz</button>
      </div>

      {menu && <BottomSheet onClose={() => setMenu(false)} z={70}>{["Copiar enlace", "No me interesa", "Denunciar foto"].map((a) => <button key={a} className={"block w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-secondary " + (a.startsWith("Den") ? "text-live" : "")} onClick={() => { setMenu(false); if (a === "Copiar enlace") share(); else toast(a === "Denunciar foto" ? "Gracias. Revisaremos esta foto." : "Verás menos fotos así"); }}>{a}</button>)}</BottomSheet>}
    </div>
  );
}

/* ---------- Subir foto (lámina 6) ---------- */
/**
 * Publicar una foto con tu voz: fotos de tu galería o tu cámara, tu voz (obligatoria: en Spotly todo se cuenta
 * hablando), un título y el lugar. Se publica como un Spot con foto: con la nube lo ve todo el mundo en Inicio, en
 * las fotos de su ciudad y en tu perfil; sin nube se guarda en tu móvil.
 */
function PhotoUpload({ onClose, onPublished, onCamera, defaultPlace }: { onClose: () => void; onPublished: (p: Photo | null) => void; onCamera: () => void; defaultPlace: string }) {
  const gate = useGate({ verified: true, online: true });
  const cloud = useCloud();
  const [files, setFiles] = useState<{ blob: File; url: string }[]>([]);
  const [sel, setSel] = useState(0);
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState(defaultPlace);
  const [vis, setVis] = useState<"Público" | "Solo seguidores">("Público");
  const [pickPlace, setPickPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  const add = (list: FileList | null) => {
    const ok = [...(list ?? [])].filter((f) => f.type.startsWith("image/") && f.size <= 15 * 1024 * 1024).slice(0, 6 - files.length);
    if (list && ok.length < list.length) toast.error("Solo fotos de hasta 15 MB (máximo 6).");
    const next = ok.map((f) => { const url = URL.createObjectURL(f); urls.current.push(url); return { blob: f, url }; });
    setFiles((cur) => [...cur, ...next]);
  };
  const main = files[sel] ?? files[0];
  const ready = !!main && !!clip && title.trim().length >= 3;
  const publish = async () => {
    if (gate || !main || !clip || busy) return;
    if (title.trim().length < 3) { toast.error("Ponle un título de al menos 3 letras."); return; }
    setBusy(true);
    try {
      const spot = await publishSpot({ title: title.trim().slice(0, 80), city: place, zone: place, topic: "¿Qué está pasando?", visibility: vis === "Solo seguidores" ? "Solo seguidores" : "Todos (público)", precision: "Aproximada", anon: false, boosted: false, happeningNow: true, repliesAllowed: true, clip: detachClip(clip), mediaFile: main.blob, mediaKind: "photo" });
      setRound((n) => n + 1);
      onPublished(cloud.on ? null : { id: Date.now(), img: spot.media?.src ?? main.url, town: place, dist: 0, author: "Tú", verified: false, likes: 0, dur: `0:${String(Math.round(clip.durationMs / 1000)).padStart(2, "0")}`, mins: 0, caption: spot.title, cat: "Ciudades", type: "Fotos", mine: true });
    } catch (e) { toast.error(cloudErrorText(e)); setBusy(false); }
  };
  return (
    <Screen title="Publicar" sub="Foto con tu voz" onBack={onClose} z={66} footer={<Button className="h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" disabled={!!gate || !ready || busy} onClick={() => void publish()}>{busy ? "Publicando…" : !main ? "Elige una foto" : !clip ? "Graba tu voz para publicar" : title.trim().length < 3 ? "Ponle un título" : "Publicar"}</Button>}>
      {gate && <div className="mb-3">{gate}</div>}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Elegir fotos de la galería" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <div className="overflow-hidden rounded-2xl">{main ? <img src={main.url} alt="Foto principal" className="aspect-[16/10] w-full object-cover" /> : <button onClick={() => input.current?.click()} className="grid aspect-[16/10] w-full place-items-center bg-secondary text-sm text-muted-foreground"><span className="flex flex-col items-center gap-2"><ImageIcon size={28} className="text-primary" />Elige una foto de tu galería</span></button>}</div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{files.map((f, i) => <button key={f.url} onClick={() => setSel(i)} aria-pressed={sel === i} aria-label={`Foto ${i + 1}`} className={"relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 " + (sel === i ? "border-primary" : "border-transparent opacity-70")}><img src={f.url} alt="" className="h-full w-full object-cover" />{sel === i && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={10} /></span>}</button>)}
        {files.length < 6 && <button onClick={() => input.current?.click()} aria-label="Añadir fotos de la galería" className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-border"><ImageIcon size={18} /></button>}
        <button onClick={onCamera} aria-label="Hacer una foto nueva" className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-border"><Plus size={18} /></button></div>
      <div className="mt-3"><VoiceRecordTile key={round} variant="row" maxSeconds={30} idleText="Graba la descripción con tu voz" onChange={setClip} /></div>
      <label className="mt-2 block"><span className="sr-only">Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} maxLength={80} placeholder="Título: ej. Atardecer desde el puente" className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
      </label>
      <button onClick={() => setPickPlace(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm"><MapPin size={16} className="text-primary" /><span className="flex-1">{place}</span><ChevronRight size={16} className="text-muted-foreground" /></button>
      <h4 className="mb-2 mt-4 text-sm font-bold">Visibilidad</h4>
      <div className="grid grid-cols-2 gap-2">{(["Público", "Solo seguidores"] as const).map((v) => <button key={v} onClick={() => setVis(v)} aria-pressed={vis === v} className={"h-11 rounded-xl border text-sm font-semibold " + (vis === v ? "spot-active-pill border-transparent" : "border-border bg-card")}>{v}</button>)}</div>
      <p className="mt-2 text-2xs text-muted-foreground">Publicar es gratis. {cloud.on ? "Se publica como un Spot con foto: lo verán en Inicio, en las fotos de " + place + " y en tu perfil." : "Se guarda en tu móvil hasta que entres con tu cuenta."}</p>
      {pickPlace && <BottomSheet title="Lugar" onClose={() => setPickPlace(false)} z={70}><PlaceBrowser allowProvince={false} selected={place} onPick={(n) => { setPlace(n); setPickPlace(false); }} /></BottomSheet>}
    </Screen>
  );
}
