import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Bookmark, Calendar, Eye, Heart, Lock, MapPin, Store, Trash2, UserPlus, Users, Wallet as WalletIcon, Check, Crown, Grid3x3, Mic, Pencil, Settings, Waves, Image as ImageIcon, Video, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell, type Sheet } from "./Extras";
import { BottomSheet, TopBar } from "./kit";
import { MeAvatar, PhotoCropper, PhotoSourceSheet } from "./Author";
import { Cover } from "./Cover";
import { MediaViewer, type MediaItem } from "./MediaViewer";
import { AuthorProfile, SpotDetail, type SpotInfo } from "./SpotDetail";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { sampleMedia, type SampleMedia } from "@/lib/media";
import { saveMe, toggleFollow, useMe, useStore } from "@/lib/store";
import { VoiceComposer, VoiceItem, VoiceThread } from "./VoiceThread";
import { addVoiceNote, myThreadId, removeVoiceNote, useMyThreadId, useThread } from "@/lib/voice/notes";
import { sampleThread } from "@/lib/voice/samples";
import { formatClock } from "@/lib/voice/recorder";
import { useMySpots, useSavedSpots, type MySpot } from "@/lib/spots";
import { api, cloudErrorText, cloudUid, db, fileUrl, refreshProfile, useCloud } from "@/lib/cloud";
import { CloudPeopleSheet } from "./CloudPeople";
import { spotData } from "./spotData";

/* Contenido del perfil (demo): cada miniatura abre su Spot, su foto o su vídeo. */
type GridTab = "Spots" | "Fotos" | "Vídeos" | "Guardados";
const pick = (...idx: number[]) => idx.map((i) => sampleMedia[i % sampleMedia.length]!);
const grid: Record<GridTab, SampleMedia[]> = {
  Spots: pick(3, 1, 0, 2, 5, 4),
  Fotos: pick(2, 5, 6, 0, 7, 4),
  Vídeos: pick(0, 1, 2, 3, 4, 5),
  Guardados: pick(7, 2, 3, 0, 5, 6),
};
const savedAuthors = ["Laura", "Carlos", "Marta", "Javi", "Ana", "Dani"];
const agos = ["2 h", "5 h", "1 día", "2 días", "3 días", "1 sem"];
const toSpot = (m: SampleMedia, i: number, author?: string): SpotInfo => ({
  name: author ?? "Tú", city: m.place.split(", ").pop() ?? "Sevilla", ago: agos[i % agos.length]!, text: m.caption, img: m.img, dur: `0:${18 + ((i * 7) % 30)}`, dist: m.place,
});
const toMedia = (m: SampleMedia, kind: MediaItem["kind"]): MediaItem =>
  kind === "video" ? { kind, src: m.video, poster: m.img, caption: m.caption, place: m.place, likes: m.likes } : { kind, src: m.img, caption: m.caption, place: m.place, likes: m.likes };
const likesLabel = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "").replace(".", ",")}K` : String(n));
const people = [
  { name: "Laura", img: lauraPhoto, sub: "Música · Fotografía" },
  { name: "Carlos", img: sampleMedia[2]!.img, sub: "Deporte · Playa" },
  { name: "Marta", img: sampleMedia[3]!.img, sub: "Gastronomía" },
  { name: "Javi", img: sampleMedia[0]!.img, sub: "Eventos · Barrio" },
  { name: "Ana", img: sampleMedia[5]!.img, sub: "Cultura · Arte" },
  { name: "Dani", img: sampleMedia[6]!.img, sub: "Moda · Triana" },
];
const wall0 = [
  { u: "Laura", d: "0:18", t: "Hace 5 min", l: 12 },
  { u: "Carlos", d: "0:32", t: "Hace 20 min", l: 8 },
  { u: "Marta", d: "0:11", t: "Hace 1 h", l: 4 },
];
const badges = [["Voz top", Waves], ["Premium", Crown]] as const;

function Bars({ on }: { on?: boolean }) {
  return <span className="flex h-6 flex-1 items-center gap-[0.125rem]">{Array.from({ length: 26 }, (_, i) => <span key={i} className={`w-[0.1875rem] rounded-full ${on ? "bg-primary" : "bg-muted-foreground/50"}`} style={{ height: `${25 + ((i * 37) % 70)}%` }} />)}</span>;
}

const COVER_PRESETS = [["neon", "Neón"], ["aurora", "Aurora"], ["atardecer", "Atardecer"], ["noche", "Noche"], ["ondas", "Ondas"]] as const;
const DEMO_FOLLOWED = ["Laura", "Marta", "Ana"];

/** Recorta una foto a 16:9 (1280×720) para la portada. */
async function coverFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("img")); i.src = url; });
    const W = 1280, H = 720, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/** Cambiar la portada: foto de la galería o de la cámara, o un fondo de Spotly. */
function CoverSheet({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const gallery = useRef<HTMLInputElement | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  const set = (cover: string) => { saveMe({ ...me, cover }); toast.success("Portada actualizada"); onClose(); };
  const fromFile = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024) { toast.error("Elige una foto de hasta 15 MB."); return; }
    try { set(await coverFromFile(f)); } catch { toast.error("No se ha podido abrir esa foto"); }
  };
  return (
    <BottomSheet title="Portada del perfil" onClose={onClose} z={75}>
      <input ref={gallery} type="file" accept="image/*" className="hidden" aria-label="Elegir portada de la galería" onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Hacer una foto para la portada" onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12 gap-2" onClick={() => gallery.current?.click()}><ImageIcon size={18} className="text-primary" />Galería</Button>
        <Button variant="secondary" className="h-12 gap-2" onClick={() => camera.current?.click()}><Camera size={18} className="text-primary" />Cámara</Button>
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Fondos de Spotly</p>
      <div className="grid grid-cols-5 gap-2">
        {COVER_PRESETS.map(([k, l]) => <button key={k} onClick={() => set(`preset:${k}`)} aria-label={`Fondo ${l}`} aria-pressed={me.cover === `preset:${k}`} className={"overflow-hidden rounded-xl border-2 " + (me.cover === `preset:${k}` ? "border-primary" : "border-transparent")}><Cover cover={`preset:${k}`} className="block aspect-[3/4] w-full" /><span className="block py-1 text-center text-4xs">{l}</span></button>)}
      </div>
    </BottomSheet>
  );
}

/** Tu presentación de voz (en Spotly no hay biografía escrita). */
function VoicePresentation() {
  const me = useMe();
  const thread = useMyThreadId("presentacion", PRESENTATION);
  const notes = useThread(thread);
  const mine = notes.filter((n) => n.author.mine).sort((a, b) => b.createdAt - a.createdAt)[0];
  const [rec, setRec] = useState(false);
  return (
    <section className="mt-4" aria-label="Presentación de voz">
      {mine ? <VoiceItem compact note={mine} onMore={() => setRec(true)} right={<span className="text-2xs text-muted-foreground">Tu presentación</span>} />
        : <button onClick={() => setRec(true)} className="flex w-full items-center gap-3 rounded-3xl border border-dashed border-primary/60 bg-card/60 p-3 text-left">
            <span className="spot-voice-send grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"><Mic size={20} /></span>
            <span className="min-w-0"><strong className="block text-sm">Graba tu presentación de voz</strong><small className="text-xs text-muted-foreground">Quién eres y qué te gusta de {me.city}, en 30 segundos</small></span>
          </button>}
      {rec && <BottomSheet title="Tu presentación de voz" onClose={() => setRec(false)} z={75}>
        <VoiceComposer autoFocus allowAnon={false} sendLabel="Guardar presentación" onClose={() => setRec(false)} onSend={(clip) => { notes.filter((n) => n.author.mine).forEach((n) => removeVoiceNote(n.id)); addVoiceNote({ threadId: thread, clip }); setRec(false); toast.success("Presentación de voz guardada"); }} />
        {mine && <Button variant="ghost" className="mt-2 w-full text-live" onClick={() => { removeVoiceNote(mine.id); setRec(false); toast("Presentación eliminada"); }}><Trash2 size={16} />Eliminar mi presentación</Button>}
      </BottomSheet>}
    </section>
  );
}
const PRESENTATION = "presentacion:yo";

/** Tus Spots con sus vistas (las vistas cuentan escuchas de otras personas). */
function SpotsSheet({ onClose, onOpen }: { onClose: () => void; onOpen: (s: MySpot) => void }) {
  const mySpots = useMySpots();
  const { demo } = useStore();
  const cloud = useCloud();
  return (
    <BottomSheet title={`Tus Spots · ${mySpots.length + (demo ? grid.Spots.length : 0)}`} onClose={onClose} z={65}>
      {mySpots.length === 0 && !demo && <p className="py-8 text-center text-sm text-muted-foreground">Aún no has publicado ningún Spot. Pulsa el botón central para crear el primero.</p>}
      <div className="space-y-2">
        {mySpots.map((s) => (
          <button key={s.id} onClick={() => onOpen(s)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left">
            <SpotThumb s={s} className="h-14 w-14 rounded-xl" />
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{s.title}</strong><small className="block truncate text-xs text-muted-foreground">{s.zone} · {new Date(s.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {formatClock(s.audio.durationMs)}</small></span>
            <span className="flex shrink-0 flex-col items-end text-xs"><span className="flex items-center gap-1 font-bold"><Eye size={14} className="text-primary" />{s.views.toLocaleString("es-ES")}</span><small className="text-3xs text-muted-foreground">vistas</small></span>
          </button>
        ))}
        {demo && grid.Spots.map((m, i) => (
          <div key={m.caption} className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-2">
            <img src={m.img} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{m.caption}</strong><small className="block truncate text-xs text-muted-foreground">{m.place} · ejemplo</small></span>
            <span className="flex shrink-0 flex-col items-end text-xs"><span className="flex items-center gap-1 font-bold"><Eye size={14} className="text-primary" />{likesLabel(m.likes * 7 + i * 13)}</span><small className="text-3xs text-muted-foreground">vistas</small></span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-2xs text-muted-foreground">{cloud.on ? "Las vistas son escuchas de otras personas: una por persona y día; las tuyas no cuentan." : "Las vistas son escuchas de otras personas. Mientras tus Spots se guardan solo en este dispositivo, cuentan 0."}</p>
    </BottomSheet>
  );
}

/** Miniatura de tu Spot: su foto o vídeo, o tu onda si es solo voz. */
function SpotThumb({ s, className = "" }: { s: MySpot; className?: string }) {
  if (s.media?.kind === "photo") return <img src={s.media.src} alt="" className={"shrink-0 object-cover " + className} />;
  if (s.media?.kind === "video") return <video src={s.media.src} muted playsInline preload="metadata" className={"shrink-0 bg-black object-cover " + className} />;
  return <span className={"flex shrink-0 items-center justify-center gap-[0.125rem] bg-spot-surface px-1.5 " + className} aria-hidden="true">{s.audio.peaks.filter((_, i) => i % 4 === 0).map((h, i) => <i key={i} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 70)}%` }} />)}</span>;
}

const mySpotInfo = (s: MySpot, name: string): SpotInfo => spotData(s, name);

export function ProfileView({ onOpen, accountEmail }: { onOpen: (s: Sheet) => void; accountEmail: string | null }) {
  const [tab, setTab] = useState("Spots");
  const [edit, setEdit] = useState(false);
  const me = useMe();
  const { demo, following } = useStore();
  const cloud = useCloud();
  const mySpots = useMySpots();
  const saved = useSavedSpots(cloud.on && tab === "Guardados");
  const wallThread = useMyThreadId("muro", `muro:${me.user}`);
  const [cloudAuthor, setCloudAuthor] = useState<api.ProfileRow | null>(null);
  useEffect(() => { void refreshProfile(); }, []);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [coverSheet, setCoverSheet] = useState(false);
  const [spotsSheet, setSpotsSheet] = useState(false);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; start: number } | null>(null);
  const [spot, setSpot] = useState<{ s: SpotInfo; author: string | null } | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [list, setList] = useState<"Seguidores" | "Siguiendo" | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const wallSeed = useMemo(() => (demo ? sampleThread(`muro:${me.user}`, [{ key: "1", name: "Laura", img: lauraPhoto, minsAgo: 5, dur: "0:18", likes: 12, verified: true }, { key: "2", name: "Carlos", img: sampleMedia[2]!.img, minsAgo: 20, dur: "0:32", likes: 8 }, { key: "3", name: "Marta", img: sampleMedia[3]!.img, minsAgo: 60, dur: "0:11", likes: 4, replyTo: "1", replyAt: "0:09" }]) : []), [demo, me.user]);
  if (badgesOpen) return <Badges onBack={() => setBadgesOpen(false)} />;
  const followingCount = cloud.on ? cloud.following.length : new Set([...(demo ? DEMO_FOLLOWED : []), ...following]).size;
  const followersCount = cloud.on ? (cloud.profile?.followers ?? 0) : demo ? people.length : 0;
  const spotsCount = mySpots.length + (demo ? grid.Spots.length : 0);
  const fmtCount = (n: number) => (n >= 10000 ? likesLabel(n) : n.toLocaleString("es-ES"));
  const openItem = (t: GridTab, i: number) => {
    const items = grid[t];
    const m = items[i]!;
    if (t === "Fotos") setViewer({ items: items.map((x) => toMedia(x, "foto")), start: i });
    else if (t === "Vídeos") setViewer({ items: items.map((x) => toMedia(x, "video")), start: i });
    else if (t === "Guardados") setSpot({ s: toSpot(m, i, savedAuthors[i]), author: savedAuthors[i] ?? null });
    else setSpot({ s: toSpot(m, i), author: null });
  };
  const mine = tab === "Fotos" ? mySpots.filter((s) => s.media?.kind === "photo") : tab === "Vídeos" ? mySpots.filter((s) => s.media?.kind === "video") : tab === "Spots" ? mySpots : tab === "Guardados" && cloud.on ? saved.spots : [];
  const samples = demo && tab !== "Audio Wall" ? grid[tab as GridTab] : [];

  return (
    <main className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Portada cambiable con la cabecera encima */}
      <div className="relative">
        <Cover cover={me.cover} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />
        <div className="relative flex h-[calc(9.5rem+var(--safe-header))] flex-col px-3 pt-[var(--safe-header)]">
          <div className="flex min-h-10 items-center justify-between gap-1">
            <h2 className="rounded-full bg-background/45 px-3 py-1 text-sm font-bold backdrop-blur">Tu perfil</h2>
            <div className="flex gap-1">
              <button onClick={() => setCoverSheet(true)} aria-label="Cambiar portada" className="flex h-10 items-center gap-1.5 rounded-full bg-background/45 px-3 text-2xs font-semibold backdrop-blur"><ImageIcon size={15} />Portada</button>
              <Button variant="ghost" size="icon" className="bg-background/45 backdrop-blur" aria-label="Editar perfil" onClick={() => setEdit(true)}><Pencil size={18} /></Button>
              <Button variant="ghost" size="icon" className="bg-background/45 backdrop-blur" aria-label="Ajustes" onClick={() => setSettings(true)}><Settings size={18} /></Button>
            </div>
          </div>
        </div>
      </div>
      <div className="relative px-4">
        <div className="pointer-events-none -mt-10 flex items-end gap-3">
          <button onClick={() => setEdit(true)} aria-label="Cambiar foto y datos del perfil" className="pointer-events-auto block h-[5.5rem] w-[5.5rem] shrink-0 rounded-full bg-spot-gradient p-[0.1875rem] shadow-glow"><MeAvatar className="h-full w-full border-2 border-background text-3xl" /></button>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-xl font-bold leading-tight">{me.name}</h1>
            <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><span className="truncate">@{me.user}</span><span>·</span><MapPin size={12} className="shrink-0 text-primary" /><span className="truncate">{me.city}</span></p>
          </div>
        </div>
        <VoicePresentation />
        {/* Cifras tappables: abren tus Spots con sus vistas, tus seguidores y a quién sigues */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([[Mic, spotsCount, "Spots", () => setSpotsSheet(true)], [Users, followersCount, "Seguidores", () => setList("Seguidores")], [UserPlus, followingCount, "Siguiendo", () => setList("Siguiendo")]] as const).map(([I, n, l, f]) => (
            <button key={l} onClick={f} className="spot-voice-card flex flex-col items-center gap-0.5 rounded-2xl py-2.5">
              <I size={16} className="text-primary" />
              <strong className="text-base tabular-nums leading-tight">{fmtCount(n)}</strong>
              <small className="text-2xs text-muted-foreground">{l}</small>
            </button>
          ))}
        </div>
        {demo && <p className="mt-1 text-center text-3xs text-muted-foreground">Modo demostración: incluye contenido de ejemplo</p>}
      </div>
      <div ref={gridRef} className="@container mt-3 grid scroll-mt-4 grid-cols-5 gap-1 px-3 py-2">
        {([["Spots", Grid3x3], ["Fotos", ImageIcon], ["Vídeos", Video], ["Voz", Waves], ["Guardados", Bookmark]] as const).map(([l, I]) => <Button key={l} size="sm" variant={(tab === l || (l === "Voz" && tab === "Audio Wall")) ? "default" : "secondary"} onClick={() => setTab(l === "Voz" ? "Audio Wall" : l)} className={`h-8 min-w-0 gap-1 rounded-full px-1 text-3xs ${(tab === l || (l === "Voz" && tab === "Audio Wall")) ? "spot-active-pill" : ""}`}><I size={12} className="@max-[20rem]:hidden" />{l}</Button>)}
      </div>
      {tab !== "Audio Wall" ? (
        <section className="grid grid-cols-3 gap-1 p-1">
          {mine.map((s) => (
            <button key={s.id} onClick={() => setSpot({ s: mySpotInfo(s, me.name), author: null })} aria-label={`Abrir ${s.cloud && !s.cloud.mine ? "el" : "tu"} Spot: ${s.title}`} className="relative overflow-hidden rounded-md">
              <SpotThumb s={s} className="aspect-[3/4] w-full rounded-md" />
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-3xs font-semibold text-white drop-shadow">{s.cloud && !s.cloud.mine ? <><Heart size={10} fill="currentColor" className="text-live" />{likesLabel(s.cloud.likes)}</> : <><Eye size={10} />{s.views}</>}</span>
            </button>
          ))}
          {samples.map((m, i) => (
            <button key={tab + i} onClick={() => openItem(tab as GridTab, i)} aria-label={`${tab === "Vídeos" ? "Ver vídeo" : tab === "Fotos" ? "Ver foto" : "Abrir Spot"} de ejemplo: ${m.caption}`} className="relative overflow-hidden rounded-md">
              <img src={m.img} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-md object-cover" />
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-3xs font-semibold text-white drop-shadow"><Heart size={10} fill="currentColor" className="text-live" />{likesLabel(m.likes)}</span>
              <span className="absolute right-1 top-1 rounded bg-black/55 px-1 py-0.5 text-4xs font-semibold text-white">ejemplo</span>
            </button>
          ))}
          {mine.length === 0 && samples.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">{tab === "Guardados" ? "Guarda Spots con el marcador y aparecerán aquí." : tab === "Spots" ? "Aún no has publicado ningún Spot." : `Aún no tienes ${tab.toLowerCase()} en tus Spots.`}</p>}
        </section>
      ) : (
        <section className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Tus visitas te dejan mensajes de voz aquí y puedes responderles.</p>
          <Button variant="secondary" className="w-full rounded-lg border border-primary/50" onClick={() => onOpen("audio-wall")}><Mic size={17} className="text-primary" />Explorar Audio Wall en directo</Button>
          <VoiceThread threadId={wallThread} seed={wallSeed} emptyText="Aún no te han dejado mensajes de voz." />
        </section>
      )}
      <div className="px-4 py-5"><Button variant="secondary" className="w-full" onClick={() => onOpen("verificacion")}><BadgeCheck size={16} className="text-primary" />Verificación · ver ejemplo</Button>{demo && <Button variant="ghost" className="mt-2 w-full" onClick={() => setBadgesOpen(true)}>{badges.map(([l, I]) => <span key={l} className="flex items-center gap-1 text-3xs text-muted-foreground"><I size={11} className="text-primary" />{l}</span>)}</Button>}<div className="mt-3 grid grid-cols-3 gap-2">{([["wallet", "Wallet", WalletIcon], ["chats", "Chats de voz", Mic], ["local", "Panel Local", Store], ["comunidades", "Comunidades", Users], ["eventos", "Eventos", Calendar], ["privacidad", "Privacidad", Lock]] as [Sheet, string, typeof Mic][]).map(([k, l, I]) => <Button key={l} variant="secondary" onClick={() => onOpen(k)} className="flex h-16 flex-col gap-1 rounded-lg border border-border text-2xs"><I size={18} className="text-primary" />{l}</Button>)}</div></div>
      {edit && <EditProfile onClose={() => setEdit(false)} onCover={() => { setEdit(false); setCoverSheet(true); }} />}
      {coverSheet && <CoverSheet onClose={() => setCoverSheet(false)} />}
      {spotsSheet && <SpotsSheet onClose={() => setSpotsSheet(false)} onOpen={(s) => { setSpotsSheet(false); setSpot({ s: mySpotInfo(s, me.name), author: null }); }} />}
      {settings && <SettingsScreen accountEmail={accountEmail} onBack={() => setSettings(false)} onOpen={(s) => { setSettings(false); onOpen(s); }} />}
      {viewer && <MediaViewer items={viewer.items} start={viewer.start} onClose={() => setViewer(null)} />}
      {spot && <SpotDetail s={spot.s} onClose={() => setSpot(null)} onAuthor={() => { if (spot.author) setAuthor(spot.author); else setSpot(null); }} />}
      {author && <AuthorProfile name={author} onClose={() => setAuthor(null)} />}
      {cloudAuthor && <AuthorProfile name={cloudAuthor.display_name || cloudAuthor.username} id={cloudAuthor.id} avatar={fileUrl(cloudAuthor.avatar_path)} onClose={() => setCloudAuthor(null)} />}
      {list && (cloud.on && cloud.uid
        ? <CloudPeopleSheet userId={cloud.uid} kind={list} onSwitch={setList} onClose={() => { setList(null); void refreshProfile(); }} onOpen={(p) => { setList(null); setCloudAuthor(p); }} />
        : <PeopleList kind={list} onSwitch={setList} onClose={() => setList(null)} onAuthor={(n) => { setList(null); setAuthor(n); }} />)}
    </main>
  );
}

/** Seguidores y Siguiendo: a quién sigues es real (se guarda en el dispositivo); los seguidores llegan con el backend. En modo demostración se añaden perfiles de ejemplo. */
function PeopleList({ kind, onSwitch, onClose, onAuthor }: { kind: "Seguidores" | "Siguiendo"; onSwitch: (k: "Seguidores" | "Siguiendo") => void; onClose: () => void; onAuthor: (name: string) => void }) {
  const { following, demo } = useStore();
  const [demoFollowed, setDemoFollowed] = useState<string[]>(() => (demo ? DEMO_FOLLOWED : []));
  const isOn = (name: string) => following.includes(name) || demoFollowed.includes(name);
  const setFollow = (name: string, on: boolean) => {
    if (!on) setDemoFollowed((f) => f.filter((n) => n !== name));
    if (following.includes(name) !== on) toggleFollow(name);
    toast(on ? `Sigues a ${name}` : `Dejaste de seguir a ${name}`);
  };
  const known = new Map(people.map((p) => [p.name, p]));
  const followingList = [...new Set([...demoFollowed, ...following])].map((n) => known.get(n) ?? { name: n, img: "", sub: "Perfil de Spotly" });
  const shown = kind === "Siguiendo" ? followingList : demo ? people : [];
  return (
    <BottomSheet title={kind} onClose={onClose} z={65}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["Seguidores", "Siguiendo"] as const).map((k) => <button key={k} onClick={() => onSwitch(k)} aria-pressed={k === kind} className={"rounded-lg py-2 text-xs font-semibold " + (k === kind ? "spot-active-pill text-foreground" : "text-muted-foreground")}>{k}</button>)}
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{kind === "Siguiendo" ? "Aún no sigues a nadie. Sigue a personas desde sus Spots o su perfil." : "Aún no tienes seguidores. Cuando alguien te siga, aparecerá aquí."}</p>}
      <div className="space-y-1">
        {shown.map((p) => {
          const on = isOn(p.name);
          return (
            <div key={p.name} className="flex items-center gap-3 rounded-xl px-1 py-2">
              <button onClick={() => onAuthor(p.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {p.img ? <img src={p.img} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary font-bold">{p.name[0]}</span>}
                <span className="min-w-0"><strong className="block truncate text-sm">{p.name}</strong><small className="block truncate text-xs text-muted-foreground">{p.sub}{demo && known.has(p.name) ? " · ejemplo" : ""}</small></span>
              </button>
              <Button size="sm" variant={on ? "secondary" : "default"} onClick={() => setFollow(p.name, !on)} className="shrink-0 rounded-full">{on ? "Siguiendo" : kind === "Seguidores" ? "Seguir también" : "Seguir"}</Button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function EditProfile({ onClose, onCover }: { onClose: () => void; onCover: () => void }) {
  const me = useMe();
  const [v, setV] = useState(me);
  const cloud = useCloud();
  const [source, setSource] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [userErr, setUserErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* Con la nube el usuario es único y sigue las mismas reglas que al registrarse. */
  const save = async () => {
    const user = v.user.trim().replace(/^@+/, "").replace(/\s+/g, ".").toLowerCase() || me.user;
    if (cloud.on && user !== me.user) {
      if (!/^[a-z][a-z0-9_.]{2,19}$/.test(user)) { setUserErr("De 3 a 20 caracteres: minúsculas, números, punto o guion bajo. Debe empezar por letra."); return; }
      setSaving(true);
      const free = await api.usernameAvailable(db(), user).catch(() => true);
      setSaving(false);
      if (!free) { setUserErr("Ese nombre de usuario ya está cogido. Prueba otro."); return; }
    }
    saveMe({ ...me, name: v.name.trim().slice(0, 40) || me.name, user });
    toast.success("Perfil actualizado");
    onClose();
  };
  /* La foto se aplica al momento (como en cualquier red social); nombre y usuario, al pulsar Guardar. */
  const setPhoto = (avatar: string | null) => { saveMe({ ...me, avatar }); setV((x) => ({ ...x, avatar })); };
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col bg-background">
      <TopBar title="Editar perfil" onBack={onClose} close right={<Button size="sm" disabled={saving} onClick={() => void save()}>Guardar</Button>} />
      <main className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-5">
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => setSource(true)} aria-label="Cambiar foto de perfil" className="relative rounded-full bg-spot-gradient p-[0.1875rem] shadow-glow">
            <MeAvatar src={v.avatar} name={v.name || me.name} className="h-24 w-24 text-3xl" />
            <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Camera size={15} /></span>
          </button>
          <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => setSource(true)}>{v.avatar ? "Cambiar foto" : "Añadir foto"}</Button>
        </div>
        {(["name", "user"] as const).map((k) => (
          <label key={k} className="mt-4 block text-xs text-muted-foreground">{k === "name" ? "Nombre" : "Usuario"}
            <input value={v[k]} maxLength={k === "name" ? 40 : 20} autoCapitalize={k === "user" ? "none" : undefined} spellCheck={k === "user" ? false : undefined} aria-invalid={k === "user" && !!userErr}
              onChange={(e) => { setV({ ...v, [k]: k === "user" ? e.target.value.toLowerCase().replace(/\s/g, "") : e.target.value }); if (k === "user") setUserErr(null); }}
              className={"mt-1 w-full rounded-xl border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary " + (k === "user" && userErr ? "border-live" : "border-border")} />
            {k === "user" && userErr && <span role="alert" className="mt-1 block text-2xs text-live">{userErr}</span>}</label>
        ))}
        <p className="mt-2 text-2xs text-muted-foreground">Tu nombre y tu foto aparecen en cada audio que envías. Solo con Incógnito (de pago) salen como «Anónimo». En Spotly no hay biografía escrita: preséntate con tu voz.</p>
        <button onClick={onCover} className="mt-5 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card text-left"><Cover cover={me.cover} className="h-14 w-24 shrink-0" /><span className="flex-1 text-sm font-semibold">Portada del perfil</span><span className="pr-3 text-xs text-primary">Cambiar</span></button>
        <p className="mb-1 mt-5 text-xs text-muted-foreground">Presentación de voz</p>
        <VoicePresentation />
      </main>
      {source && <PhotoSourceSheet hasPhoto={!!v.avatar} onClose={() => setSource(false)} onFile={(f) => { setSource(false); setFile(f); }} onRemove={() => { setSource(false); setPhoto(null); toast("Foto de perfil quitada"); }} />}
      {file && <PhotoCropper file={file} onCancel={() => setFile(null)} onDone={(url) => { setFile(null); setPhoto(url); toast.success("Foto de perfil actualizada"); }} />}
    </div>
  );
}

/** Descarga un JSON con todos tus datos de la nube. */
async function downloadMyData() {
  const uid = cloudUid();
  if (!uid) { toast("Entra con tu cuenta para descargar tus datos."); return; }
  try {
    const data = await api.exportMyData(db(), uid);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `spotly-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success("Tus datos se han descargado");
  } catch (e) { toast.error(cloudErrorText(e)); }
}

/** Eliminar la cuenta (exigido por App Store y Google Play): borra perfil, Spots, voces, seguidores y chats. */
function DeleteAccount({ onClose }: { onClose: () => void }) {
  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    const uid = cloudUid();
    if (!uid) return;
    setBusy(true);
    try {
      const r = await api.deleteMyAccount(db(), uid);
      await supabase.auth.signOut().catch(() => undefined);
      toast.success(r === "deleted" ? "Tu cuenta y todo su contenido se han eliminado." : "Solicitud registrada: tu cuenta se eliminará en un máximo de 30 días.");
      onClose();
    } catch (e) { toast.error(cloudErrorText(e)); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="Eliminar cuenta">
        <h3 className="font-bold">Eliminar cuenta</h3>
        <p className="mt-1 text-sm text-muted-foreground">{cloud.on ? "Se borrarán tu perfil, tus Spots, tus voces, tus seguidores y tus chats. No se puede deshacer." : "Entra con tu cuenta para poder eliminarla. No se ha enviado ninguna solicitud."}</p>
        {cloud.on && <Button className="mt-5 w-full bg-live bg-none text-primary-foreground" disabled={busy} onClick={() => void remove()}>{busy ? "Eliminando…" : "Eliminar para siempre"}</Button>}
        <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={onClose}>{cloud.on ? "Cancelar" : "Volver"}</Button>
      </div>
    </div>
  );
}

function SettingsScreen({ onBack, onOpen, accountEmail }: { onBack: () => void; onOpen: (s: Sheet) => void; accountEmail: string | null }) {
  const queryClient = useQueryClient();
  const cloud = useCloud();
  const [t, setT] = useState(() => ({ notif: true, auto: true, dark: typeof document === "undefined" || !document.documentElement.classList.contains("light") }));
  const [help, setHelp] = useState(false); const [out, setOut] = useState(false); const [del, setDel] = useState(false);
  const [n, setN] = useState(["Me gusta", "Respuestas de voz", "Seguidores"]); const [r, setR] = useState("5 km"); const [l, setL] = useState("Español");
  const toggle = (k: keyof typeof t) => {
    const v = !t[k]; setT({ ...t, [k]: v });
    if (k === "dark") { document.documentElement.classList.toggle("light", !v); toast(v ? "Tema oscuro activado" : "Tema claro activado"); }
  };
  const Row = ({ k, l }: { k: keyof typeof t; l: string }) => (
    <button onClick={() => toggle(k)} role="switch" aria-checked={t[k]} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm"><span className="min-w-0">{l}</span><span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${t[k] ? "bg-spot-gradient" : "bg-muted"}`}><span className={`block h-5 w-5 rounded-full bg-foreground transition ${t[k] ? "translate-x-5" : ""}`} /></span></button>
  );
  return (
    <Shell title="Ajustes" onBack={onBack}>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        <Row k="notif" l="Notificaciones" /><Row k="auto" l="Reproducir audio automáticamente" /><Row k="dark" l="Tema oscuro" />
      </div>
      {t.notif && <><p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Avisarme de</p>
      <div className="flex flex-wrap gap-2">{["Me gusta", "Respuestas de voz", "Seguidores", "Eventos cerca", "Ofertas locales"].map((x) => <button key={x} onClick={() => setN(n.includes(x) ? n.filter((y) => y !== x) : [...n, x])} className={n.includes(x) ? "spot-active-pill rounded-full px-3 py-1.5 text-xs font-semibold" : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"}>{x}</button>)}</div></>}
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Distancia para descubrir</p>
      <div className="grid grid-cols-4 gap-2">{["1 km", "5 km", "10 km", "Ciudad"].map((x) => <button key={x} onClick={() => { setR(x); toast(`Descubrirás Spots a ${x}`); }} className={r === x ? "rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" : "rounded-lg bg-secondary py-2 text-xs"}>{x}</button>)}</div>
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Idioma</p>
      <div className="grid grid-cols-3 gap-2">{["Español", "Català", "English"].map((x) => <button key={x} onClick={() => setL(x)} className={l === x ? "rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" : "rounded-lg bg-secondary py-2 text-xs"}>{x}</button>)}</div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-4">
        {([["privacidad", "Privacidad e incógnito"], ["verificacion", "Verificación"], ["wallet", "Wallet y Premium"]] as [Sheet, string][]).map(([k, l]) => <button key={l} onClick={() => onOpen(k)} className="flex w-full justify-between py-3 text-sm">{l}<span className="text-muted-foreground">›</span></button>)}
        <button onClick={() => setHelp(true)} className="flex w-full justify-between py-3 text-sm">Ayuda y soporte<span className="text-muted-foreground">›</span></button>
      </div>
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cuenta y datos</p>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        <button onClick={() => void downloadMyData()} className="flex w-full justify-between py-3 text-sm">{cloud.on ? "Descargar mis datos" : "Descargar mis datos · con tu cuenta"}<span className="text-muted-foreground">›</span></button>
        <button onClick={() => toast.info("Pausar cuenta aún no está disponible")} className="flex w-full justify-between py-3 text-sm">Pausar cuenta · próximamente<span className="text-muted-foreground">›</span></button>
        <button onClick={() => setDel(true)} className="flex w-full justify-between py-3 text-sm text-live">Eliminar cuenta<span>›</span></button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">{accountEmail ? `Sesión iniciada: ${accountEmail}` : "Explorando la demostración sin cuenta"}</p>
      <Button variant="outline" className="mt-2 w-full" onClick={() => setOut(true)}>{accountEmail ? "Cerrar sesión" : "Entrar con Apple o Google"}</Button>
      {help && <Help onBack={() => setHelp(false)} />}
      {del && <DeleteAccount onClose={() => setDel(false)} />}
      {out && <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm" onClick={() => setOut(false)}><div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center" onClick={e => e.stopPropagation()}><h3 className="font-bold">{accountEmail ? "¿Cerrar sesión?" : "Entrar en Spotly"}</h3><p className="mt-1 text-sm text-muted-foreground">{accountEmail ? "Volverás a la pantalla de bienvenida." : "Podrás acceder con Apple o Google."}</p><Button className="mt-5 w-full" onClick={async () => { if (accountEmail) { await queryClient.cancelQueries(); queryClient.clear(); const { error } = await supabase.auth.signOut(); if (error) { toast.error("No se pudo cerrar sesión"); return; } } else window.location.reload(); setOut(false); }}>{accountEmail ? "Cerrar sesión" : "Ir al acceso"}</Button><Button variant="ghost" className="mt-2 w-full" onClick={() => setOut(false)}>Cancelar</Button></div></div>}
    </Shell>
  );
}

const faqs = [
  ["¿Qué es un Spot?", "Un audio corto, con foto o sin ella, ligado al lugar donde estás. Lo escuchan las personas cercanas."],
  ["¿Por qué no puedo escribir?", "Spotly es voz: publicas, respondes y buscas hablando. Así todo suena real y cercano."],
  ["¿Quién ve mi ubicación?", "Solo la zona aproximada. Con el modo incógnito dejas de aparecer en el mapa durante 1, 4 o 24 horas."],
  ["¿Qué significa verificado?", "Que confirmaste tu identidad con teléfono, documento y selfie. No es lo mismo que Premium."],
  ["¿Cómo funciona impulsar?", "Usas créditos de tu Wallet para que tu Spot llegue a más gente cerca durante un tiempo."],
];

function Help({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const [sent, setSent] = useState(false);
  return (
    <Shell title="Ayuda y soporte" onBack={onBack}>
      <h3 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">PREGUNTAS FRECUENTES</h3>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        {faqs.map(([q, a], i) => <div key={q}><button onClick={() => setOpen(open === i ? null : i)} className="flex w-full justify-between py-3 text-left text-sm font-medium">{q}<span className="text-primary">{open === i ? "−" : "+"}</span></button>{open === i && <p className="pb-3 text-sm text-muted-foreground">{a}</p>}</div>)}
      </div>
      <div className="mt-5 rounded-2xl border border-primary/30 bg-card p-4 text-center">
        {sent ? <><Check className="mx-auto text-primary" size={32} /><p className="mt-2 font-bold">{cloudUid() ? "Mensaje de voz enviado" : "Mensaje de voz guardado"}</p><p className="text-sm text-muted-foreground">{cloudUid() ? "Lo escucha el equipo de Spotly desde el panel de soporte. Solo lo oyen tú y el equipo." : "Queda guardado en este dispositivo; se enviará al equipo cuando entres con tu cuenta."}</p></> : <>
          <p className="font-bold">¿No encuentras la respuesta?</p><p className="mb-3 text-sm text-muted-foreground">Cuéntanos tu problema con tu voz</p>
          <VoiceComposer allowAnon={false} sendLabel="Enviar a soporte" onSend={(clip) => { addVoiceNote({ threadId: myThreadId("soporte", "soporte"), clip }); setSent(true); }} /></>}
      </div>
    </Shell>
  );
}

/* Lámina 12: insignias */
const allBadges = [
  { n: "Verificado", d: "Pendiente de comprobar tu identidad en la próxima fase", I: BadgeCheck, on: false, p: 0 },
  { n: "Voz top", d: "Tus Spots superan 10.000 escuchas", I: Waves, on: true, p: 100 },
  { n: "Premium", d: "Miembro Spotly Premium", I: Crown, on: true, p: 100 },
  { n: "Local de Sevilla", d: "30 Spots publicados en tu ciudad", I: Store, on: false, p: 70 },
  { n: "Organizador", d: "Crea 5 eventos con asistentes", I: Calendar, on: false, p: 40 },
  { n: "Comunidad", d: "Modera una comunidad activa", I: Users, on: false, p: 20 },
];
export function Badges({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const got = allBadges.filter((b) => b.on).length;
  return (
    <Shell title="Insignias" onBack={onBack}>
      <p className="text-sm text-muted-foreground">Ejemplo de insignias · {got} de {allBadges.length} ilustradas. Tu identidad no está verificada.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {allBadges.map((b, i) => (
          <button key={b.n} onClick={() => setSel(i)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center ${sel === i ? "border-primary" : "border-border"} ${b.on ? "bg-card" : "opacity-50"}`}>
            <span className={`grid h-12 w-12 place-items-center rounded-full ${b.on ? "bg-spot-gradient shadow-glow" : "bg-secondary"}`}>{b.on ? <b.I size={22} /> : <Lock size={18} />}</span>
            <span className="text-2xs font-semibold leading-tight">{b.n}</span>
          </button>
        ))}
      </div>
      {sel !== null && (() => { const b = allBadges[sel]!; return (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-bold"><b.I size={18} className="text-primary" />{b.n}</p>
          <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-spot-gradient" style={{ width: `${b.p}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{b.on ? "Conseguida" : `${b.p}% completado`}</p>
        </div>); })()}
    </Shell>
  );
}
