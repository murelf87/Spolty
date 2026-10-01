import { useMemo, useState } from "react";
import { BadgeCheck, Bookmark, Camera, ChevronRight, Compass, Flame, Heart, Image as ImageIcon, List, LayoutGrid, MapPin, MessageCircle, Mic, MoreHorizontal, Music, Plus, Search, Share2, SlidersHorizontal, Tag, Users, CalendarPlus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AudioRow, BottomSheet, Chip, Screen, StateCard, Trust } from "./kit";
import { useApp } from "./app-context";
import { VoiceReply, useGate } from "./Voice";
import { LocationOff } from "./Status";
import { SpainMap, spainCities } from "./SpainMap";
import { PlaceBrowser } from "./Places";
import { isCapital, municipiosOf, norm, provinceOfPlace, searchPlaces, type Province } from "@/lib/geo";
import { toggleFollow, useStore } from "@/lib/store";
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
  const { perms, offline, following } = useStore();
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
        <Button variant="secondary" size="icon" className="relative h-11 w-11 rounded-full" aria-label="Filtros avanzados" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={17} />{nf > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-live px-1 text-[9px] font-bold">{nf}</span>}</Button>
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
        {offline ? <StateCard icon={Camera} tone="muted" title="Sin conexión" text="Verás lo último que cargó. No podemos traer fotos nuevas ahora." action="Reintentar" onAction={() => toast.error("Sigues sin conexión")} />
          : mode === "Explorar" ? <ExploreHome cats={cats.slice(0, 4)} all={all} onPlace={setPlace} onCat={(c) => { setCat(c); }} onOpen={setOpen} onUpload={() => setUpload(true)} onMode={setMode} onStory={(s) => (s === "mine" ? setUpload(true) : setPlace(s))} />
          : mode === "Para ti" ? <Feed all={all} filters={filters} onOpen={setOpen} following={following} />
          : mode === "Cerca" ? (perms.location ? <Grid list={applyFilters(all.filter((p) => p.dist <= 5), filters)} onOpen={setOpen} empty="No hay fotos cerca con estos filtros." onClear={() => setFilters(noFilters)} /> : <LocationOff />)
          : mode === "Mapa" ? <PhotoMap all={all} onPlace={setPlace} onOpen={setOpen} />
          : <ListView list={applyFilters(all, filters)} onOpen={setOpen} />}
      </div>
      <Button className="mt-4 w-full rounded-full bg-spot-gradient text-foreground" onClick={() => setUpload(true)}><Camera size={16} />Subir una foto con mi voz</Button>
      <div className="mt-3"><Trust>El contenido lo publican personas verificadas. Los rankings y “Tendencias” salen de la actividad real; lo impulsado se marca como tal.</Trust></div>

      {cat && <CategorySheet cat={cat} all={all} onClose={() => setCat(null)} onOpen={(p) => { setCat(null); setOpen(p); }} />}
      {place && <PlacePage place={place} all={all} filters={filters} onBack={() => setPlace(null)} onOpen={setOpen} onPick={() => setPicker(true)} onFilters={() => setFilterOpen(true)} onMap={() => { setPlace(null); setMode("Mapa"); }} />}
      {picker && <PlacePicker onClose={() => setPicker(false)} onPick={(n) => { setPlace(n); setPicker(false); }} />}
      {filterOpen && <FiltersSheet value={filters} onClose={() => setFilterOpen(false)} onApply={(f) => { setFilters(f); setFilterOpen(false); toast.success("Filtros aplicados"); }} />}
      {open && <PhotoDetail p={open} onClose={() => setOpen(null)} onMore={(t) => { setPlace(t); setOpen(null); }} />}
      {upload && <PhotoUpload onClose={() => setUpload(false)} defaultPlace={place ?? "Sevilla"} onPublished={(p) => { setMine((m) => [p, ...m]); setUpload(false); setMode("Para ti"); toast.success("Foto publicada"); }} onCamera={() => { setUpload(false); app.create(); }} />}
    </Screen>
  );
}

/* ---------- Explorar (lámina 2/13/14/15) ---------- */
function ExploreHome({ cats: topCats, onPlace, onCat, onUpload, onMode, onStory }: { cats: readonly Cat[]; all?: Photo[]; onPlace: (p: string) => void; onCat: (c: Cat) => void; onOpen?: (p: Photo) => void; onUpload: () => void; onMode: (m: Mode) => void; onStory: (s: string) => void }) {
  const stories = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Ronda"];
  const trending = [["Madrid", "12,4K"], ["Barcelona", "11,2K"], ["Sevilla", "9,8K"], ["Valencia", "8,1K"], ["Málaga", "6,7K"]] as const;
  return (
    <div className="space-y-5">
      <section aria-label="Historias por ciudad"><h3 className="mb-2 text-sm font-bold">Historias por ciudad</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button onClick={() => onStory("mine")} className="flex w-16 shrink-0 flex-col items-center gap-1"><span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-primary bg-secondary"><img src={me} alt="" className="h-full w-full rounded-full object-cover opacity-70" /><span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Plus size={12} /></span></span><span className="text-[11px]">Tu historia</span></button>
          {stories.map((s) => <button key={s} onClick={() => onStory(s)} className="flex w-16 shrink-0 flex-col items-center gap-1"><span className="rounded-full bg-spot-gradient p-[2.5px]"><img src={info(s).img} alt="" className="h-[60px] w-[60px] rounded-full border-2 border-background object-cover" /></span><span className="text-[11px]">{s}</span></button>)}
        </div>
      </section>
      <button onClick={() => onPlace("Madrid")} className="relative block w-full overflow-hidden rounded-2xl text-left" aria-label="Ver fotos de España"><img src={festival} alt="" className="aspect-[16/8] w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" /><span className="absolute inset-x-4 bottom-3 flex items-end justify-between"><span><strong className="block text-2xl">España</strong><small className="text-foreground/80">1,2M fotos</small></span><ChevronRight /></span></button>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Ciudades populares</h3><button onClick={() => onMode("Mapa")} className="text-xs text-primary">Ver en mapa ›</button></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga"].map((c) => <button key={c} onClick={() => onPlace(c)} className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl text-left"><img src={info(c).img} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute inset-x-2 bottom-1.5"><strong className="block text-sm">{c}</strong><small className="text-[10px] text-foreground/80">{info(c).photos}</small></span></button>)}</div>
      </section>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-bold"><Flame size={15} className="text-live" />Tendencias en España</h3><button onClick={() => onMode("Lista")} className="text-xs text-primary">Ver todo ›</button></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{trending.map(([c, n], i) => <button key={c} onClick={() => onPlace(c)} className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl text-left" aria-label={`${i + 1}. ${c}, ${n} fotos hoy`}><img src={info(c).img} alt="" loading="lazy" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-spot-gradient text-[10px] font-extrabold">{i + 1}</span><span className="absolute inset-x-1.5 bottom-1"><strong className="block text-[11px]">{c}</strong><small className="text-[9px] text-foreground/80">{n} fotos</small></span></button>)}</div>
      </section>
      <section><h3 className="mb-2 text-sm font-bold">Explorar por categorías</h3>
        <div className="grid grid-cols-2 gap-2">{topCats.map((c, i) => <button key={c} onClick={() => onCat(c)} className="relative h-24 overflow-hidden rounded-xl text-left"><img src={imgs[(i * 2 + 2) % imgs.length]} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" /><span className="absolute inset-x-3 bottom-2"><strong className="block">{c}</strong><small className="text-[11px] text-foreground/80">{[128, 96, 212, 84][i]}K fotos</small></span></button>)}</div>
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
  if (!list.length) return <StateCard icon={Camera} tone="muted" title="Aún no hay fotos aquí" text={empty ?? "Sé la primera persona en contar cómo es este sitio."} action={onClear ? "Quitar filtros" : undefined} onAction={onClear} />;
  return (
    <div className="columns-2 gap-2">{list.map((p, i) => (
      <button key={p.id} onClick={() => onOpen(p)} className="relative mb-2 block w-full overflow-hidden rounded-xl text-left" aria-label={`${p.caption}, ${p.town}`}>
        <img src={p.img} alt="" loading="lazy" className={"w-full object-cover " + (i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/5]")} />
        <span className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
        {p.type !== "Fotos" && <span className="absolute right-2 top-2 rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-bold">{p.type === "Vídeos" ? "VÍDEO" : "REEL"}</span>}
        {p.mine && <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">TUYA</span>}
        <span className="absolute inset-x-2 bottom-1.5 flex items-center justify-between text-[11px] font-semibold"><span className="flex items-center gap-1"><Heart size={12} fill="currentColor" className="text-accent" />{fmtN(p.likes)}</span><span className="flex items-center gap-1 text-foreground/85"><MapPin size={11} />{fmtKm(p.dist)}</span></span>
      </button>))}</div>
  );
}

/* ---------- Formato lista (lámina 11) ---------- */
function ListView({ list, onOpen }: { list: Photo[]; onOpen: (p: Photo) => void }) {
  const [t, setT] = useState<"Recientes" | "Populares">("Recientes");
  const l = [...list].sort((a, b) => (t === "Populares" ? b.likes - a.likes : a.mins - b.mins));
  return (
    <div>
      <div className="flex gap-1.5">{(["Recientes", "Populares"] as const).map((s) => <Chip key={s} active={t === s} onClick={() => setT(s)}>{s}</Chip>)}</div>
      <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card px-3">{l.length ? l.map((p) => (
        <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-3 py-3 text-left"><img src={p.img} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.town}</strong><small className="text-muted-foreground">{p.caption} · hace {p.mins} min</small></span><span className="flex items-center gap-1 text-xs text-accent"><Heart size={13} />{fmtN(p.likes)}</span></button>)) : <p className="py-8 text-center text-sm text-muted-foreground">No hay fotos con estos filtros.</p>}</div>
    </div>
  );
}

/* ---------- Mapa de fotos (lámina 7): 52 provincias interactivas ---------- */
function PhotoMap({ all, onPlace, onOpen }: { all: Photo[]; onPlace: (p: string) => void; onOpen: (p: Photo) => void }) {
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
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><img src={info(c.name).img} alt="" className="h-14 w-14 rounded-xl object-cover" /><span className="min-w-0 flex-1"><strong className="block">{c.name}</strong><small className="text-muted-foreground">{info(c.name).photos} fotos · {all.filter((p) => p.town === c.name).length} en esta demo</small></span><Button size="sm" onClick={() => onPlace(c.name)}>Ver fotos</Button></div>
      ) : prov ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-spot-gradient text-xl font-extrabold text-primary-foreground">{prov.n.slice(0, 1)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{prov.n}</strong><small className="text-muted-foreground">{prov.r} · {nMun.toLocaleString("es-ES")} {nMun === 1 ? "municipio" : "municipios"} · capital {prov.k}</small></span></div>
          <p className="mt-2 text-xs text-muted-foreground">{list.length ? `${list.length} ${list.length === 1 ? "foto" : "fotos"} en esta demo` : "Aún no hay fotos en esta provincia en la demo."}</p>
          {towns.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{towns.map((t) => <Chip key={t} active={false} onClick={() => onPlace(t)}>{t}</Chip>)}</div>}
          <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setView("municipios")}>Municipios</Button><Button onClick={() => setView("fotos")}>Ver fotos</Button></div>
        </div>
      ) : <p className="mt-3 rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Toca cualquier provincia para verla: hay 52, con Ceuta, Melilla, Canarias y Baleares. Pellizca o usa + / − para acercar.</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">Geografía oficial (IGN e INE). Las cifras de actividad son de ejemplo hasta conectar el servidor.</p>
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
  const { following } = useStore();
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
        <div className="absolute inset-x-4 bottom-3"><h3 className="text-3xl font-extrabold">{place}</h3><p className="text-xs text-foreground/85">{pi.photos} fotos · {pi.people} personas</p></div></div>
      <div className="mt-3 flex items-center gap-2"><Button className="flex-1" variant={on ? "secondary" : "default"} onClick={() => { toggleFollow(key); toast(on ? `Has dejado de seguir ${place}` : `Sigues ${place}`); }}>{on ? <><Check size={15} />Siguiendo</> : "Seguir"}</Button>
        <Button variant="secondary" size="icon" aria-label="Cambiar de lugar" onClick={onPick}><MapPin size={17} /></Button><Button variant="secondary" size="icon" aria-label="Ver en el mapa" onClick={onMap}><Compass size={17} /></Button><Button variant="secondary" size="icon" aria-label="Filtros" onClick={onFilters}><SlidersHorizontal size={17} /></Button>
        <div className="flex rounded-full border border-border bg-secondary p-0.5">{([["Cuadrícula", LayoutGrid], ["Lista", List]] as const).map(([m, I]) => <button key={m} onClick={() => setLayout(m)} aria-label={m} aria-pressed={layout === m} className={"grid h-9 w-9 place-items-center rounded-full " + (layout === m ? "spot-active-pill" : "")}><I size={15} /></button>)}</div></div>
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
  const { following } = useStore();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reply, setReply] = useState(false);
  const [menu, setMenu] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const gate = useGate({ verified: true, online: true });
  const follows = following.includes(p.author);
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: p.caption, url: `https://spotly.app/foto/${p.id}` }); return; } await navigator.clipboard?.writeText(`https://spotly.app/foto/${p.id}`); toast("Enlace copiado"); } catch { toast("Enlace copiado"); }
  };
  return (
    <Screen title={p.caption} sub={`${p.town} · a ${fmtKm(p.dist)} · hace ${p.mins} min`} onBack={onClose} z={62}
      footer={<div className="flex items-center justify-center gap-3"><Button className="h-12 w-12 rounded-full bg-spot-gradient text-foreground shadow-glow" aria-label="Comentar con voz" onClick={() => setReply(true)}><Mic size={22} /></Button><span className="text-xs text-muted-foreground">Pulsa para comentar con voz</span></div>}>
      <div className="relative overflow-hidden rounded-2xl"><img src={p.img} alt={p.caption} className="aspect-[4/5] w-full object-cover" />
        <div className="absolute bottom-3 right-3 flex flex-col items-center gap-3">{([[Heart, fmtN(p.likes + (liked ? 1 : 0)), () => setLiked(!liked), liked ? "text-accent" : "", "Me gusta"], [MessageCircle, `${comments.length + 98}`, () => setReply(true), "", "Comentar"], [Share2, "Enviar", share, "", "Compartir"], [Bookmark, "", () => { setSaved(!saved); toast(saved ? "Quitada de guardados" : "Guardada"); }, saved ? "text-primary" : "", "Guardar"]] as const).map(([I, l, f, c, a]) => <button key={a} onClick={f} aria-label={a} className="flex flex-col items-center gap-0.5 rounded-full bg-background/60 p-2 text-[10px] backdrop-blur"><I size={22} className={c} fill={(a === "Me gusta" && liked) || (a === "Guardar" && saved) ? "currentColor" : "none"} />{l}</button>)}</div></div>
      <div className="mt-3 flex items-center gap-3"><img src={p.img} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/50" /><span className="min-w-0 flex-1"><strong className="flex items-center gap-1 text-sm">{p.mine ? "Tú" : p.author}{p.verified && <BadgeCheck size={14} className="text-primary" />}</strong><button onClick={() => onMore(p.town)} className="flex items-center gap-1 text-xs text-primary"><MapPin size={12} />{p.town} · Ver más fotos</button></span>
        {!p.mine && <Button size="sm" variant={follows ? "secondary" : "default"} onClick={() => { toggleFollow(p.author); toast(follows ? `Dejaste de seguir a ${p.author}` : `Sigues a ${p.author}`); }}>{follows ? "Siguiendo" : "Seguir"}</Button>}
        <Button variant="ghost" size="icon" aria-label="Más opciones" onClick={() => setMenu(true)}><MoreHorizontal size={18} /></Button></div>
      <div className="mt-3"><AudioRow name={p.mine ? "Tu voz" : p.author} dur={p.dur} seed={p.id + 1} /></div>
      <p className="mt-2 text-sm">{p.caption}. Siempre es un plan perfecto.</p>
      {comments.map((c, i) => <p key={i} className="mt-2 rounded-xl bg-secondary/60 p-2.5 text-sm"><strong>Tú</strong> · {c}</p>)}
      {gate && <div className="mt-3">{gate}</div>}
      {reply && <VoiceReply name={p.author} onClose={() => setReply(false)} />}
      {menu && <BottomSheet onClose={() => setMenu(false)} z={70}>{["Copiar enlace", "No me interesa", "Denunciar foto"].map((a) => <button key={a} className={"block w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-secondary " + (a.startsWith("Den") ? "text-live" : "")} onClick={() => { setMenu(false); toast(a === "Denunciar foto" ? "Gracias. Revisaremos esta foto." : a === "Copiar enlace" ? "Enlace copiado" : "Verás menos fotos así"); }}>{a}</button>)}</BottomSheet>}
    </Screen>
  );
}

/* ---------- Subir foto (lámina 6) ---------- */
function PhotoUpload({ onClose, onPublished, onCamera, defaultPlace }: { onClose: () => void; onPublished: (p: Photo) => void; onCamera: () => void; defaultPlace: string }) {
  const gate = useGate({ verified: true, online: true });
  const [sel, setSel] = useState<number[]>([0]);
  const [desc, setDesc] = useState("");
  const [place, setPlace] = useState(defaultPlace);
  const [vis, setVis] = useState<"Público" | "Solo seguidores">("Público");
  const [pick, setPick] = useState<null | "music" | "people" | "event" | "place">(null);
  const [music, setMusic] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [event, setEvent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = { music: ["Sin música", "Guitarra flamenca (ejemplo)", "Chill nocturno (ejemplo)"], people: authors, event: ["Ninguno", "Noche en la ciudad", "Sesión acústica"], place: Object.values(geo).flat().map((t) => t.name) };
  const rows = [[Music, "Añadir música", music ?? "Ninguna", "music"], [Tag, "Etiquetar personas", tags.length ? tags.join(", ") : "Nadie", "people"], [CalendarPlus, "Añadir a un evento", event ?? "Ninguno", "event"]] as const;
  const publish = () => { if (gate || !sel.length) return; setBusy(true); window.setTimeout(() => { setBusy(false); onPublished({ id: 900 + Date.now() % 1000, img: imgs[sel[0]! % imgs.length]!, town: place, dist: 0.1, author: "Tú", verified: true, likes: 0, dur: "0:12", mins: 0, caption: desc.trim() || "Mi foto con voz", cat: "Ciudades", type: "Fotos", mine: true }); }, 600); };
  return (
    <Screen title="Publicar" sub="Foto con tu voz" onBack={onClose} z={66} footer={<Button className="h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" disabled={!!gate || !sel.length || busy} onClick={publish}>{busy ? "Publicando…" : "Publicar"}</Button>}>
      {gate && <div className="mb-3">{gate}</div>}
      <div className="overflow-hidden rounded-2xl"><img src={imgs[sel[0] ?? 0]} alt="Foto principal" className="aspect-[16/10] w-full object-cover" /></div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{imgs.map((im, i) => <button key={i} onClick={() => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].slice(-6)))} aria-pressed={sel.includes(i)} aria-label={`Foto ${i + 1}`} className={"relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 " + (sel.includes(i) ? "border-primary" : "border-transparent opacity-70")}><img src={im} alt="" className="h-full w-full object-cover" />{sel.includes(i) && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={10} /></span>}</button>)}
        <button onClick={onCamera} aria-label="Hacer una foto nueva" className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-border"><Plus size={18} /></button></div>
      <button onClick={() => toast("Mantén pulsado para grabar la descripción de voz")} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-secondary p-3 text-left text-sm text-muted-foreground"><Mic size={16} className="shrink-0 text-primary" />Grabar descripción de voz…</button>
      <button onClick={() => setPick("place")} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm"><MapPin size={16} className="text-primary" /><span className="flex-1">{place}</span><ChevronRight size={16} className="text-muted-foreground" /></button>
      <h4 className="mb-2 mt-4 text-sm font-bold">Visibilidad</h4>
      <div className="grid grid-cols-2 gap-2">{(["Público", "Solo seguidores"] as const).map((v) => <button key={v} onClick={() => setVis(v)} aria-pressed={vis === v} className={"h-11 rounded-xl border text-sm font-semibold " + (vis === v ? "spot-active-pill border-transparent" : "border-border bg-card")}>{v}</button>)}</div>
      <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card px-3">{rows.map(([I, l, v, k]) => <button key={k} onClick={() => setPick(k)} className="flex w-full items-center gap-3 py-3 text-left text-sm"><I size={16} className="text-primary" /><span className="flex-1">{l}<small className="block text-muted-foreground">{v}</small></span><ChevronRight size={16} className="text-muted-foreground" /></button>)}</div>
      <p className="mt-2 text-[11px] text-muted-foreground">Publicar es gratis. Ejemplo: música, etiquetas y eventos se guardan al conectar el servidor.</p>
      {pick && <BottomSheet title={{ music: "Música", people: "Etiquetar personas", event: "Añadir a un evento", place: "Lugar" }[pick]} onClose={() => setPick(null)} z={70}>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">{opts[pick].map((o) => { const on = pick === "people" ? tags.includes(o) : pick === "music" ? music === o : pick === "event" ? event === o : place === o; return <button key={o} onClick={() => { if (pick === "people") setTags((t) => (t.includes(o) ? t.filter((x) => x !== o) : [...t, o])); else { if (pick === "music") setMusic(o === "Sin música" ? null : o); if (pick === "event") setEvent(o === "Ninguno" ? null : o); if (pick === "place") setPlace(o); setPick(null); } }} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-secondary">{o}{on && <Check size={16} className="text-primary" />}</button>; })}</div>
        {pick === "people" && <Button className="mt-2 w-full" onClick={() => setPick(null)}>Listo</Button>}
      </BottomSheet>}
    </Screen>
  );
}
