import { Fragment, useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import { Bell, Bookmark, Check, ChevronLeft, ChevronRight, Compass, Flame, Heart, Linkedin, MapPin, MoreHorizontal, Mic, Pause, Play, Search, Share2, WifiOff, Ghost, RefreshCw, X } from "lucide-react";
import { siX, siFacebook, siInstagram, siWhatsapp, siTelegram, siTiktok, siSnapchat, siMessenger, siReddit, siPinterest, siThreads, siBluesky } from "simple-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useApp } from "./app-context";
import { AuthorProfile, SpotDetail } from "./SpotDetail";
import { VoiceReply } from "./Voice";
import { VoiceWave } from "./VoiceThread";
import { spotKeyOf } from "./SpotDetail";
import { clockToMs, useThread } from "@/lib/voice/notes";
import { formatClock, seededPeaks } from "@/lib/voice/recorder";
import { playVoice, seekVoice, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { deleteSpot, recordSpotView, setSpotReplies, toggleSpotLike, toggleSpotSaved, useCloudFeed, useMySpots, type MySpot } from "@/lib/spots";
import { api, cloudErrorText, cloudUid, db, followId, isFollowingId, useCloud } from "@/lib/cloud";
import { NowStrip } from "./NowStrip";
import { HotSpotCard } from "./HotSpots";
import { FlashOfferCard, SponsoredSpot, getBiz } from "./Local";
import { IncognitoExpiredNote, IncognitoSpotCard } from "./Incognito";
import { GrowCard } from "./LocalAd";
import { PeopleStrip } from "./PromoProfile";
import { MeAvatar } from "./Author";
import { BoostedTag, IncognitoTag, Skeleton, StateCard, BottomSheet } from "./kit";
import { ContentState } from "./Safety";
import { addReport, blockUser, toggleFollow, unblockUser, useNow, useStore, useMe } from "@/lib/store";
import { campaignEligible, hotspots } from "@/lib/sampleData";
import { spotData, type SpotData } from "./spotData";
import { copySpotLink, networkShareUrl, shareLink, spotLink } from "@/lib/share";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import sevilleEvening from "@/assets/spotly-sevilla-noche-ref.jpg";
import stagePhoto from "@/assets/spotly-live-stage.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import festivalPhoto from "@/assets/spotly-sevilla-festival.jpg";
import beachPhoto from "@/assets/spotly-beach-club.jpg";
import sevilleNightPhoto from "@/assets/seville-night.jpg";

/** Último Spot que acabas de publicar (Inicio vuelve arriba para enseñártelo). */
export type MineSpot = MySpot | null;

/* ---------- Stories ---------- */
const storyPeople = [
  { name: "Cerca", img: sevilleEvening, live: true, place: "Sevilla", ago: "hace 3 min" },
  { name: "Ahora", img: stagePhoto, live: true, place: "Madrid", ago: "hace 7 min" },
  { name: "Alicia", img: lauraPhoto, live: false, place: "Sevilla", ago: "hace 22 min" },
  { name: "Marcos", img: festivalPhoto, live: false, place: "Sevilla", ago: "hace 1 h" },
  { name: "Dani", img: beachPhoto, live: false, place: "Valencia", ago: "hace 2 h" },
  { name: "Marta", img: valenciaSunset, live: false, place: "Valencia", ago: "hace 3 h" },
];

function StoryViewer({ stories, startIndex, onClose }: { stories: typeof storyPeople; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState<boolean[]>(stories.map(() => false));
  const [reply, setReply] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 5000;

  const advance = (dir: 1 | -1) => {
    const next = idx + dir;
    if (next < 0 || next >= stories.length) { onClose(); return; }
    setIdx(next); setProgress(0); startRef.current = null;
  };

  useEffect(() => {
    if (paused || reply) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const p = Math.min((now - startRef.current) / DURATION, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else advance(1);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [idx, paused, reply]);

  const s = stories[idx]!;
  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-[520px] flex-col bg-black"
      onPointerDown={() => { setPaused(true); }}
      onPointerUp={() => { setPaused(false); startRef.current = null; }}>
      {/* Barras progreso */}
      <div className="absolute inset-x-3 flex gap-1" style={{ top: "max(0.5rem, env(safe-area-inset-top))", zIndex: 3 }}>
        {stories.map((_, i) => (
          <div key={i} className="h-[0.1875rem] flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-white" style={{ width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%", transition: "none" }} />
          </div>
        ))}
      </div>
      {/* Header usuario */}
      <div className="absolute inset-x-3 flex items-center gap-2.5" style={{ top: "max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem))", zIndex: 3 }}>
        <img src={s.img} alt={s.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-none text-white">{s.name}</p>
          <p className="text-2xs text-white/70">{s.place} · {s.ago}</p>
        </div>
        {s.live && <span className="rounded-md bg-live px-2 py-0.5 text-3xs font-bold text-white">LIVE</span>}
        <button onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white"><X size={18} /></button>
      </div>
      {/* Foto fullscreen */}
      <img src={s.img} alt={s.name} className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
      {/* Toque prev / next */}
      <button onClick={(e) => { e.stopPropagation(); advance(-1); }} aria-label="Anterior" className="absolute left-0 top-0 h-full w-1/3" style={{ zIndex: 2 }} />
      <button onClick={(e) => { e.stopPropagation(); advance(1); }} aria-label="Siguiente" className="absolute right-0 top-0 h-full w-1/3" style={{ zIndex: 2 }} />
      {/* Acciones derecha */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5" style={{ zIndex: 3 }}>
        <button onClick={() => setLiked(l => l.map((v, i) => i === idx ? !v : v))} className="flex flex-col items-center gap-1">
          <Heart size={28} className={liked[idx] ? "text-accent" : "text-white"} fill={liked[idx] ? "currentColor" : "none"} />
          <span className="text-xs font-bold text-white">{liked[idx] ? 128 : 127}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); setReply(true); }} aria-label={`Responder a la historia de ${s.name} con tu voz`} className="flex flex-col items-center gap-1">
          <Mic size={26} className="text-white" />
          <span className="text-xs font-bold text-white">Voz</span>
        </button>
        <button onClick={() => toast.success("Enlace copiado")} className="flex flex-col items-center gap-1">
          <Share2 size={26} className="text-white" />
          <span className="text-xs font-bold text-white">Enviar</span>
        </button>
      </div>
      {/* Chip lugar */}
      <div className="absolute bottom-[5.5rem] left-3" style={{ zIndex: 3 }}>
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{s.place}
        </span>
      </div>
      {/* Footer respuesta voz */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" style={{ zIndex: 3 }}>
        <button onClick={(e) => { e.stopPropagation(); setReply(true); }} aria-label={`Responder a la historia de ${s.name} con tu voz`}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full shadow-glow"
          style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
          <Mic size={22} className="text-white" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setReply(true); }} className="flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-left text-sm text-white/60 backdrop-blur-sm">
          Responde con tu voz…
        </button>
      </div>
      {reply && <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}><VoiceReply name={s.name} mode="message" onClose={() => setReply(false)} /></div>}
    </div>
  );
}

function CreateStorySheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [recording, setRecording] = useState(false);
  const [selImg, setSelImg] = useState(0);
  const imgs = [sevilleEvening, stagePhoto, festivalPhoto, valenciaSunset, beachPhoto, lauraPhoto];
  return (
    <div className="fixed inset-0 z-[85] mx-auto flex max-w-[520px] flex-col bg-black">
      <div className="absolute inset-x-3 flex items-center justify-between" style={{ top: "max(1rem, env(safe-area-inset-top))", zIndex: 2 }}>
        <span className="text-base font-bold text-white">Nueva historia</span>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"><X size={20} /></button>
      </div>
      {/* Fondo seleccionado */}
      <img src={imgs[selImg]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50" />
      {/* Miniaturas selector */}
      {step === 0 && (
        <div className="absolute inset-x-3 bottom-36 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", zIndex: 2 }}>
          {imgs.map((im, i) => (
            <button key={i} onClick={() => setSelImg(i)} className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${selImg === i ? "border-white" : "border-transparent opacity-60"}`}>
              <img src={im} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {/* Acciones por step */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4" style={{ zIndex: 2 }}>
        {step === 0 && <>
          <button onClick={() => setStep(1)} className="spot-pulse grid h-20 w-20 place-items-center rounded-full shadow-glow" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
            <Mic size={36} className="text-white" />
          </button>
          <span className="text-sm text-white/70">Pulsa y cuenta qué está pasando</span>
        </>}
        {step === 1 && <>
          <p className="text-lg font-bold text-white">{recording ? "Grabando…" : "Mantén para grabar"}</p>
          <button
            onPointerDown={() => setRecording(true)}
            onPointerUp={() => { setRecording(false); setStep(2); }}
            className="grid h-24 w-24 place-items-center rounded-full shadow-glow transition-transform active:scale-110"
            style={{ background: recording ? "#ef4444" : "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
            <Mic size={44} className="text-white" />
          </button>
          <span className="text-xs text-white/50">{recording ? "Suelta para terminar" : "Pulsa y mantén"}</span>
        </>}
        {step === 2 && <>
          <div className="flex items-center gap-2 rounded-2xl bg-black/60 px-5 py-3 backdrop-blur-sm">
            {Array.from({ length: 18 }).map((_, i) => <span key={i} className="rounded-full bg-white/70" style={{ width: 2.5, height: `${[4,9,14,8,16,6,12,10,18,7,13,5,11,9,15,6,10,7][i]! / 16}rem`, display: "block" }} />)}
            <span className="ml-2 text-sm text-white/70">0:06</span>
          </div>
          <p className="text-sm text-white/60">Tu historia · Sevilla</p>
          <div className="w-full px-4 space-y-2">
            <button onClick={() => { onClose(); toast.success("¡Historia publicada! Visible 24 h"); }} className="w-full rounded-full py-3.5 text-base font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
              Publicar historia
            </button>
            <button onClick={() => setStep(1)} className="w-full rounded-full border border-white/30 py-3 text-sm text-white/70">
              Volver a grabar
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

function StoriesStrip({ onOpenCreate }: { onOpenCreate: () => void }) {
  const [viewed, setViewed] = useState<string[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-3 pb-2 pt-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <button onClick={() => setCreating(true)} className="flex shrink-0 flex-col items-center gap-1.5" aria-label="Crear tu historia">
          <span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-primary/60 bg-secondary">
            <MeAvatar className="h-full w-full text-xl opacity-60" />
            <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow"><svg viewBox="0 0 16 16" className="h-3 w-3 fill-current"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
          </span>
          <span className="text-2xs text-muted-foreground">Tu historia</span>
        </button>
        {storyPeople.map((p, i) => {
          const seen = viewed.includes(p.name);
          return (
            <button key={p.name} onClick={() => { setViewed(v => [...v, p.name]); setViewerIdx(i); }} className="flex shrink-0 flex-col items-center gap-1.5" aria-label={`Historia de ${p.name}`}>
              <span className={`relative h-16 w-16 rounded-full p-[0.15625rem] ${seen ? "bg-secondary" : "bg-spot-gradient"}`}>
                <img src={p.img} alt={p.name} className="h-full w-full rounded-full object-cover" />
                {p.live && !seen && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-live px-1.5 py-0 text-4xs font-bold leading-4 text-white">LIVE</span>}
              </span>
              <span className={`text-2xs ${seen ? "text-muted-foreground" : "font-semibold"}`}>{p.name}</span>
            </button>
          );
        })}
      </div>
      {viewerIdx !== null && <StoryViewer stories={storyPeople} startIndex={viewerIdx} onClose={() => setViewerIdx(null)} />}
      {creating && <CreateStorySheet onClose={() => setCreating(false)} />}
    </>
  );
}

const waves = [5, 9, 14, 22, 13, 7, 19, 11, 25, 16, 9, 18, 27, 12, 7, 21, 15, 10, 23, 14, 8, 19, 26, 11, 6, 16, 24, 12, 7, 20, 13, 9, 17, 25, 11, 6, 15, 21, 9, 5];


export function Wave({ active }: { active: boolean }) {
  return <div className="spot-wave flex h-7 min-w-0 flex-1 items-center justify-center gap-[0.125rem] overflow-hidden" aria-label="Forma de onda de audio">{waves.map((h, i) => <span key={i} className={active ? "spot-wave-active" : "spot-wave-idle"} style={{ height: `${h / 16}rem`, width: 2, borderRadius: 4 }} />)}</div>;
}
type Net = { name: string; icon?: { path: string }; hex: string; dark?: boolean; custom?: ReactNode };
const nets: Net[] = [
  { name: "X", icon: siX, hex: "#000000" },
  { name: "Instagram", icon: siInstagram, hex: "#FF0069" },
  { name: "Facebook", icon: siFacebook, hex: "#0866FF" },
  { name: "WhatsApp", icon: siWhatsapp, hex: "#25D366" },
  { name: "Telegram", icon: siTelegram, hex: "#26A5E4" },
  { name: "TikTok", icon: siTiktok, hex: "#000000" },
  { name: "Snapchat", icon: siSnapchat, hex: "#FFFC00", dark: true },
  { name: "Messenger", icon: siMessenger, hex: "#0866FF" },
  { name: "LinkedIn", hex: "#0A66C2", custom: <Linkedin size={20} strokeWidth={2.4}/> },
  { name: "Reddit", icon: siReddit, hex: "#FF4500" },
  { name: "Pinterest", icon: siPinterest, hex: "#BD081C" },
  { name: "Threads", icon: siThreads, hex: "#000000" },
  { name: "Bluesky", icon: siBluesky, hex: "#1185FE" },
  { name: "Mensajes", hex: "#34C759", custom: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 1C5.92 1 1 5.35 1 10.72c0 2.9 1.44 5.49 3.69 7.2v3.6c0 .32.38.48.6.25l2.62-2.77c1.26.42 2.64.64 4.09.64 6.08 0 11-4.35 11-9.92S18.08 1 12 1zm5.5 8.98-2.6 4.13c-.2.32-.63.4-.93.18l-2.05-1.54-1.17 1.13c-.13.12-.23.22-.47.22l.17-2.4 4.37-3.95c.19-.17-.04-.25-.29-.1l-5.4 3.4-2.32-.73c-.5-.16-.51-.5.11-.75l9.08-3.5c.42-.16.79.1.65.75z"/></svg> },
  { name: "Correo", hex: "#0A84FF", custom: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg> },
];

/** Compartir un Spot: en cada red con su enlace web (o la hoja nativa del móvil) y copiar el enlace. Los Spots de
 *  ejemplo y los guardados solo en este dispositivo no tienen enlace público. */
function ShareSheet({ s, who, onClose }: { s: SpotData; who: string; onClose: () => void }) {
  const { demo } = useStore();
  const [sent, setSent] = useState<string[]>([]);
  const people = ["Laura","Carlos","Marta","Javi","Lucía"];
  const url = s.cloud ? spotLink(s.id) : null;
  const text = `«${s.text}» · ${who} en Spotly`;
  const noLink = () => toast(s.cloud ? "Los enlaces funcionarán cuando la app esté publicada en su dirección web." : s.own ? "Este Spot está guardado solo en tu móvil: no tiene enlace público." : "Spot de ejemplo: no tiene enlace.");
  const openNet = (n: Net) => {
    if (!url) { noLink(); return; }
    const target = networkShareUrl(n.name, url, text);
    if (target?.startsWith("mailto:") || target?.startsWith("sms:")) { window.location.href = target; onClose(); return; }
    if (target) { window.open(target, "_blank", "noopener,noreferrer"); onClose(); return; }
    void shareLink({ title: "Spotly", text, url }).then((ok) => { if (ok) onClose(); });
  };
  return <BottomSheet onClose={onClose} z={50}>
    <div className="flex items-center gap-3 rounded-2xl bg-secondary p-2">{s.img ? <img src={s.img} alt="" className="h-14 w-14 rounded-xl object-cover"/> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-spot-gradient"><Mic size={22} /></span>}<div className="min-w-0"><p className="text-sm font-semibold">Spot de {who}</p><p className="truncate text-xs text-muted-foreground">{s.text}</p></div></div>
    {demo && <><p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">ENVIAR EN SPOTLY</p>
    <div className="mt-2 flex gap-4 overflow-x-auto pb-1">{people.map(p=>{const on=sent.includes(p);return <button key={p} onClick={()=>{if(!on){setSent([...sent,p]);toast("Spot enviado a "+p)}}} className="flex w-14 shrink-0 flex-col items-center gap-1"><span className={"grid h-14 w-14 place-items-center rounded-full text-lg font-bold "+(on?"bg-primary text-primary-foreground":"bg-secondary")}>{on?<Check size={20}/>:p[0]}</span><span className="text-2xs">{on?"Enviado":p}</span></button>})}</div></>}
    <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">COMPARTIR FUERA</p>
    <div className="mt-2 grid grid-cols-4 gap-y-3">{nets.map(n=><button key={n.name} onClick={()=>openNet(n)} className="flex flex-col items-center gap-1 rounded-xl py-1 hover:bg-secondary"><span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: n.hex, color: n.dark ? "#000000" : "#FFFFFF" }}>{n.custom ?? (n.icon ? <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d={n.icon.path}/></svg> : null)}</span><span className="text-2xs">{n.name}</span></button>)}
      <button onClick={()=>{ if (!url) { noLink(); return; } void shareLink({ title: "Spotly", text, url }).then((ok) => { if (ok) onClose(); }); }} className="flex flex-col items-center gap-1 rounded-xl py-1 hover:bg-secondary"><span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground"><MoreHorizontal size={20}/></span><span className="text-2xs">Más</span></button></div>
    <Button variant="secondary" className="mt-4 w-full" onClick={()=>{ if (!url) { noLink(); return; } void copySpotLink(s.id).then((ok) => { if (ok) onClose(); }); }}>Copiar enlace</Button>
  </BottomSheet>;
}

const spots: Record<string, SpotData> = {
  laura: { id: "laura", name: "Lucíaa", handle: "luciaa", city: "Marbella", province: "Málaga", ago: "Ahora", img: sevilleEvening, tag: "Está pasando", tagLive: true, dist: "320 m", text: "Chicos  no vais a creer con quién me he encontrado esta noche en Marbella... 👀🔥", dur: "0:14", likes: 1200, replies: 342, shares: 87, hashtag: "Cotilleo", tags: ["Marbella", "Vida nocturna", "Famosos"], verified: true },
  andrea: { id: "andrea", name: "andreaa.s", handle: "andreaas", city: "Madrid", province: "Madrid", ago: "12 min", img: stagePhoto, tag: "En directo", tagLive: true, dist: "2,1 km", text: "Lo que está pasando ahora mismo en Gran Vía… nadie se lo espera 😱", dur: "0:22", likes: 890, replies: 211, shares: 45, hashtag: "Madrid", tags: ["Madrid", "Centro", "Sorpresa"], verified: true },
  marta: { id: "marta", name: "Marta", city: "Valencia", province: "Valencia", ago: "12 min", img: valenciaSunset, tag: "Cerca de ti", dist: "1,2 km", text: "Este atardecer se tenía que compartir 🌅", dur: "0:18", likes: 1800, replies: 156, shares: 63, hashtag: "Cotilleo", tags: ["Valencia", "Atardecer", "Playa"], boosted: true },
  dani: { id: "dani", name: "Dani", city: "Triana", province: "Sevilla", ago: "2 min", img: festivalPhoto, tag: "A 150 m", dist: "150 m", text: "Música en directo en la calle Betis, venid 🎸", dur: "0:22", likes: 312, replies: 88, shares: 21, hashtag: "Fiesta", tags: ["Triana", "Flamenco", "Nocturna"] },
  carlos: { id: "carlos", name: "Carlos", city: "Alameda", province: "Sevilla", ago: "Ahora", img: lauraPhoto, tag: "En directo", tagLive: true, dist: "800 m", text: "Cola enorme en el mercado, mejor venid más tarde 😅", dur: "0:15", likes: 96, replies: 34, shares: 8, hashtag: "Info", tags: ["Sevilla", "Mercado"] },
};
export const feedTabs = ["Todo", "Cerca", "Suscrito", "España"] as const;
type FeedTab = (typeof feedTabs)[number];

function SpotMenu({ s, onClose, onStatus }: { s: SpotData; onClose: () => void; onStatus: (v: "ok" | "reported" | "deleted" | "hidden") => void }) {
  const app = useApp();
  const { following } = useStore();
  useCloud();
  const [view, setView] = useState<"menu" | "report" | "sent">("menu");
  const [reason, setReason] = useState("");
  const follows = s.cloud ? isFollowingId(s.authorId) : following.includes(s.name);
  const copy = () => { void copySpotLink(s.id); onClose(); };
  const follow = () => {
    if (s.cloud && s.authorId) void followId(s.authorId, !follows).then((ok) => { if (ok) toast(follows ? `Has dejado de seguir a ${s.name}` : `Ahora sigues a ${s.name}`); });
    else { toggleFollow(s.name); toast(follows ? `Has dejado de seguir a ${s.name}` : `Ahora sigues a ${s.name}`); }
    onClose();
  };
  const blockAuthor = () => {
    const uid = cloudUid();
    if (s.cloud && s.authorId && uid) {
      void api.block(db(), uid, s.authorId, true).then(() => { onStatus("hidden"); toast(`Has bloqueado a ${s.name}`); }).catch((e) => toast.error(cloudErrorText(e)));
    } else { blockUser(s.incognito ? "Incógnito #4821" : s.name); if (s.cloud) onStatus("hidden"); toast(`Has bloqueado a ${s.incognito ? "este autor anónimo" : s.name}`); }
    onClose();
  };
  const sendReport = () => {
    const uid = cloudUid();
    addReport(`Spot de ${s.incognito ? "autor anónimo" : s.name}`, reason);
    if (s.cloud && uid) void api.report(db(), uid, "spot", s.id, reason).catch((e) => toast.error(cloudErrorText(e)));
    onStatus("reported"); setView("sent");
  };
  const row = "w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-secondary";
  return <BottomSheet onClose={onClose} z={70}><div className="space-y-1">
    {view === "menu" && <>
      {s.own ? <>
        <button className={row} onClick={() => { onClose(); app.open("impulso"); }}>Impulsar este Spot</button>
        <button className={row} onClick={copy}>Copiar enlace</button>
        <button className={row + " text-live"} onClick={() => { onStatus("deleted"); deleteSpot(s.id); toast("Spot eliminado"); onClose(); }}>Eliminar Spot</button>
      </> : <>
        {!s.incognito && (!s.cloud || s.authorId) && <button className={row} onClick={follow}>{follows ? "Dejar de seguir" : "Seguir al autor"}</button>}
        <button className={row} onClick={() => { onStatus("hidden"); toast("Verás menos Spots así", { action: { label: "Deshacer", onClick: () => onStatus("ok") } }); onClose(); }}>No me interesa</button>
        <button className={row} onClick={copy}>Copiar enlace</button>
        <button className={row} onClick={blockAuthor}>Bloquear {s.incognito ? "autor anónimo" : "a " + s.name}</button>
        <button className={row + " text-live"} onClick={() => setView("report")}>Denunciar</button>
      </>}
      <Button variant="ghost" className="w-full" onClick={onClose}>Cancelar</Button></>}
    {view === "report" && <><h3 className="px-2 pb-1 text-lg font-bold">¿Por qué denuncias este Spot?</h3><p className="px-2 pb-2 text-xs text-muted-foreground">Tu denuncia es anónima. El autor no sabrá quién la envió.</p>
      {["Spam o engaño", "Acoso o insultos", "Contenido sexual", "Violencia o peligro", "Información falsa", "Suplantación de identidad"].map((r) => <button key={r} onClick={() => setReason(r)} className={"flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm " + (reason === r ? "bg-secondary text-foreground" : "hover:bg-secondary")}>{r}{reason === r && <Check size={16} className="text-primary" />}</button>)}
      <div className="flex gap-2 pt-3"><Button variant="ghost" className="flex-1" onClick={() => setView("menu")}>Atrás</Button><Button className="flex-1 bg-live bg-none text-foreground hover:bg-live/90" disabled={!reason} onClick={sendReport}>Enviar denuncia</Button></div></>}
    {view === "sent" && <div className="flex flex-col items-center gap-3 py-6 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"><Check size={30} /></div><h3 className="text-lg font-bold">Gracias por avisarnos</h3><p className="text-sm text-muted-foreground">Revisaremos "{reason}". Ya no verás este Spot. Sigue el estado en Bloqueos y denuncias.</p><Button className="mt-2 w-full" onClick={onClose}>Entendido</Button></div>}
  </div></BottomSheet>;
}

export function SpotCard({ s, isNext = false }: { s: SpotData; isNext?: boolean }) {
  const { blocked, demo } = useStore();
  const [likedHere, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reply, setReply] = useState(false);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState(false);
  const [author, setAuthor] = useState(false);
  const [status, setStatus] = useState<"ok" | "reported" | "deleted" | "hidden">("ok");
  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "K" : String(n);
  const me = useMe();
  const blockKey = s.incognito ? "Incógnito #4821" : s.name;
  /* Nombre que se ve en el audio: el tuyo en tus Spots; «Anónimo» (con fantasma) solo con Incógnito de pago. */
  const who = s.incognito ? "Anónimo" : s.own ? me.name : s.name;
  /* Audio del Spot en el reproductor único (solo uno suena a la vez) y su conversación de voz. */
  const key = spotKeyOf(s);
  const audioId = `spot-audio:${key}`;
  const pb = useVoicePlayback(audioId);
  /* En la nube el número de respuestas viene del servidor (no se abre la conversación de cada tarjeta del feed). */
  const myReplies = useThread(s.cloud ? "" : `spot:${key}`).length;
  const replyCount = s.cloud ? (s.replies ?? 0) : (s.replies ?? 0) + myReplies;
  const liked = s.cloud ? !!s.liked : likedHere;
  const likeCount = s.cloud ? s.likes : s.likes + (likedHere ? 1 : 0);
  const like = () => { if (s.cloud) toggleSpotLike(s.id); else setLiked(!likedHere); };
  const peaks = useMemo(() => (s.audio?.peaks.length ? s.audio.peaks : seededPeaks(key, 40)), [s.audio, key]);
  const totalMs = s.audio?.durationMs ?? clockToMs(s.dur);
  const play = () => { if (!s.audio) { toast("Spot de ejemplo: no tiene audio. Los Spots grabados con tu voz se escuchan aquí."); return; } if (s.cloud && !s.own && !pb.playing) recordSpotView(s.id); toggleVoice(audioId, s.audio.src, s.audio.durationMs); };
  const authorPhoto = s.cloud ? s.avatar : s.img;
  if (status === "hidden") return null;
  if (status === "deleted") return <ContentState kind="deleted" who={s.name} />;
  if (status === "reported") return <ContentState kind="reported" who={s.name} onUndo={() => setStatus("ok")} />;
  if (!s.own && blocked.includes(blockKey)) return <ContentState kind="blocked" who={s.incognito ? "este autor anónimo" : s.name} onUndo={() => { unblockUser(blockKey); toast(`${s.incognito ? "Autor anónimo" : s.name} desbloqueado`); }} />;

  /* Peek card (siguiente spot asomando) */
  if (isNext) {
    return <article className="mx-3 overflow-hidden rounded-2xl bg-card/80 shadow-sm" style={{ height: "5rem" }}>
      <div className="relative h-full">
        <img src={s.img} alt="" className="h-full w-full object-cover object-top" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
          {s.incognito
            ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/50"><Ghost size={13} className="text-white" /></span>
            : s.own ? <MeAvatar className="h-7 w-7 text-3xs ring-1 ring-white/60" /> : authorPhoto ? <img src={authorPhoto} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/60" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-spot-gradient text-3xs font-bold text-white ring-1 ring-white/60">{(s.name.replace("@", "")[0] ?? "?").toUpperCase()}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-white">{who}
              {s.verified && <svg viewBox="0 0 16 16" className="ml-1 inline h-3 w-3 fill-[#6366f1]"><circle cx="8" cy="8" r="8"/><path d="m5 8 2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              <span className="ml-1 text-3xs font-normal text-white/60">{s.city}{s.province ? `, ${s.province}` : ""} · {s.ago}</span>
            </span>
          </span>
          <span className="shrink-0 text-3xs font-semibold text-white/70">Ver siguiente ↓</span>
        </div>
      </div>
    </article>;
  }

  /* Card principal TikTok-style: llena la página del feed (h-full) — la foto ocupa todo el alto libre y la zona del
     audio queda pegada abajo, así todas las tarjetas terminan en el mismo sitio en cualquier móvil. */
  return <article className="relative flex h-full flex-col overflow-hidden rounded-none bg-black">
    {/* Foto fullscreen */}
    <div className="spot-card-media relative min-h-0 w-full flex-1" onClick={() => setDetail(true)}>
      {s.video
        ? <video src={s.video} autoPlay muted loop playsInline aria-label={s.text} className="absolute inset-0 h-full w-full cursor-pointer object-cover" />
        : s.img
          ? <img src={s.img} alt={s.text} className="absolute inset-0 h-full w-full cursor-pointer object-cover" loading="lazy" />
          : <div className="absolute inset-0 grid cursor-pointer place-items-center bg-spot-surface" aria-label={`Spot de voz: ${s.text}`}>
              <div className="flex h-2/5 w-4/5 items-center justify-between gap-1" aria-hidden="true">{peaks.map((h, i) => <span key={i} className="w-1.5 rounded-full bg-spot-gradient opacity-90" style={{ height: `${Math.round(h * 100)}%` }} />)}</div>
            </div>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

      {/* Header autor — arriba izquierda */}
      <div className="absolute left-3 top-4 flex items-start gap-2.5" style={{ zIndex: 2, right: "4rem" }}>
        {s.incognito
          ? <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white/60 bg-black/50"><Ghost size={18} className="text-white" /></span>
          : <button onClick={(e) => { e.stopPropagation(); if (!s.own) setAuthor(true); }} aria-label={s.own ? "Tu foto" : `Ver el perfil de ${who}`} className="relative mt-0.5 shrink-0">
              {s.own ? <span className="block rounded-full" style={{ boxShadow: "0 0 0 2.5px #a855f7, 0 0 0 4.5px #6366f1" }}><MeAvatar className="h-11 w-11 text-base" /></span> : authorPhoto ? <img src={authorPhoto} alt="" className="h-11 w-11 rounded-full object-cover" style={{ boxShadow: "0 0 0 2.5px #a855f7, 0 0 0 4.5px #6366f1" }} /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-spot-gradient text-base font-bold text-white" style={{ boxShadow: "0 0 0 2.5px #a855f7, 0 0 0 4.5px #6366f1" }}>{(s.name.replace("@", "")[0] ?? "?").toUpperCase()}</span>}
            </button>}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-bold leading-snug text-white drop-shadow">
            {who}
            {s.verified && !s.incognito && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-[#818cf8]"><circle cx="8" cy="8" r="8"/><path d="m5 8 2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          </p>
          <p className="flex items-center gap-1 text-2xs text-white/75">
            <MapPin size={10} className="shrink-0" />{s.city}{s.province ? `, ${s.province}` : ""} · {s.ago}
            {/* Con una cuenta real, el contenido de muestra se rotula hasta que llegue el de la comunidad. */}
            {!s.own && !demo && !s.cloud && <span className="ml-1 rounded-full border border-white/40 px-1.5 text-4xs">ejemplo</span>}
          </p>
          {s.tagLive && <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-0.5 text-3xs font-bold text-white backdrop-blur-sm" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a855f7]" />Está pasando
          </span>}
        </div>
      </div>

      {/* Hashtag pill — arriba derecha */}
      {s.hashtag && <button onClick={(e) => e.stopPropagation()} className="absolute right-3 top-4 rounded-full px-3 py-1 text-xs font-bold text-white backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(168,85,247,0.6)", zIndex: 2 }}>#{s.hashtag}</button>}

      {/* Más opciones — junto al hashtag */}
      <button aria-label="Más opciones" onClick={(e) => { e.stopPropagation(); setMenu(true); }} className="absolute right-3 top-12 mt-1 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white" style={{ zIndex: 2, marginTop: s.hashtag ? "2.25rem" : 0 }}>
        <MoreHorizontal size={18} />
      </button>

      {/* Acciones laterales — derecha centro-abajo */}
      <div className="spot-card-actions absolute bottom-3 right-3 flex flex-col items-center gap-5" style={{ zIndex: 2 }}>
        <button onClick={(e) => { e.stopPropagation(); like(); }} aria-pressed={liked} aria-label={`Me gusta (${likeCount})`} className="flex flex-col items-center gap-0.5">
          <Heart size={30} className={liked ? "text-[#ef4444]" : "text-white"} fill={liked ? "currentColor" : "none"} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }} />
          <span className="text-2xs font-bold text-white drop-shadow">{fmt(likeCount)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); if (s.repliesAllowed === false) toast("Su autor ha cerrado las respuestas de este Spot."); else setReply(true); }} aria-label={`Responder con tu voz (${replyCount} respuestas)`} className="flex flex-col items-center gap-0.5">
          <div className="grid h-[2.125rem] w-[2.125rem] place-items-center rounded-full border-2 border-white/80 bg-black/30 backdrop-blur-sm">
            <Mic size={17} className="text-white" />
          </div>
          <span className="text-2xs font-bold text-white drop-shadow">{fmt(replyCount)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); setShare(true); }} className="flex flex-col items-center gap-0.5">
          <div className="grid h-[2.125rem] w-[2.125rem] place-items-center">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }}><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
          </div>
          <span className="text-2xs font-bold text-white drop-shadow">{s.cloud || s.own ? "Enviar" : fmt(s.shares ?? 0)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); if (s.cloud) { const on = toggleSpotSaved(s.id); if (on !== null) toast(on ? "Guardado en tu perfil" : "Quitado de guardados"); } else { setSaved(!saved); toast(saved ? "Quitado de guardados" : "Guardado"); } }} aria-pressed={s.cloud ? !!s.saved : saved} className="flex flex-col items-center gap-0.5">
          <Bookmark size={28} className="text-white" fill={(s.cloud ? s.saved : saved) ? "currentColor" : "none"} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }} />
          <span className="text-2xs font-bold text-white drop-shadow">Guardar</span>
        </button>
      </div>
    </div>

    {/* Zona inferior: player + texto + tags */}
    <div className="shrink-0 bg-black px-3 pb-2.5 pt-2">
      {/* Player de audio oscuro */}
      <div className="flex items-center gap-3 rounded-full px-3 py-1.5" style={{ background: "rgba(20,20,40,0.9)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <button onClick={play} aria-label={pb.playing ? `Pausar el audio de ${who}` : `Escuchar el audio de ${who}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
          {pb.playing ? <Pause size={14} fill="#0f0f1e" className="text-[#0f0f1e]" /> : <Play size={14} fill="#0f0f1e" className="ml-0.5 text-[#0f0f1e]" />}
        </button>
        <VoiceWave peaks={peaks} progress={pb.active && totalMs ? pb.positionMs / totalMs : 0} playhead={pb.active} className="h-7 flex-1" label={`Audio de ${who}`} onSeek={s.audio ? (r) => { const a = s.audio!; if (pb.active) seekVoice(audioId, r * a.durationMs); else playVoice(audioId, a.src, a.durationMs, r * a.durationMs); } : undefined} />
        <span className="shrink-0 text-xs font-medium tabular-nums text-white/70">{pb.active ? formatClock(pb.positionMs) : s.dur}</span>
        <button onClick={() => { if (s.repliesAllowed === false) toast("Su autor ha cerrado las respuestas de este Spot."); else setReply(true); }} className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
          <Mic size={12} className="text-white" />Voz
        </button>
      </div>

      {/* Título del spot (lo único escrito: todo lo demás es voz) */}
      <p className="mt-2 line-clamp-2 text-sm leading-snug text-white">{s.text}</p>

      {/* Tags: una sola línea para que todas las tarjetas midan lo mismo */}
      <div className="mt-2 flex gap-2 overflow-hidden">
        {(s.tags ?? [s.city]).map((t) => (
          <span key={t} className="flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-2xs text-white/80 backdrop-blur-sm">
            {t === s.city || t === (s.province ?? "") ? <MapPin size={9} className="shrink-0" /> : t.includes("nocturna") || t.includes("Fiesta") ? <span className="text-4xs">🍸</span> : <span className="text-4xs">👤</span>}{t}
          </span>
        ))}
      </div>

      {/* Desliza hint */}
      <p className="mt-2 text-center text-2xs text-white/40">Desliza para ver el siguiente cotilleo <span className="text-white/60">↓</span></p>
    </div>

    {reply && <VoiceReply name={who} threadId={`spot:${key}`} target={{ name: who, author: { id: s.authorId, name: s.name, avatar: authorPhoto || undefined, anon: s.incognito, mine: s.own }, atMs: pb.active ? pb.positionMs : 0, durationMs: totalMs }} onSent={() => { if (s.cloud) setSpotReplies(s.id, replyCount + 1); }} onClose={() => setReply(false)} />}
    {share && <ShareSheet s={s} who={who} onClose={() => setShare(false)} />}
    {menu && <SpotMenu s={s} onClose={() => setMenu(false)} onStatus={setStatus} />}
    {detail && <SpotDetail s={s} onClose={() => setDetail(false)} onAuthor={() => { if (!s.incognito && !s.own) setAuthor(true); }} />}
    {author && <AuthorProfile name={s.name} id={s.cloud ? s.authorId : undefined} avatar={authorPhoto} onClose={() => setAuthor(false)} />}
  </article>;
}

/* Tabs de feed con iconos estilo diseño */
const TAB_ICONS: Record<string, ReactNode> = {
  "Todo": null,
  "Cerca": <MapPin size={12} className="shrink-0" />,
  "Suscrito": <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 fill-current"><path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7z"/></svg>,
  "España": <Flame size={12} className="shrink-0" />,
};

export function HomeView({ onBell }: { mine: MineSpot; onBell: () => void }) {
  const me = useMe();
  const app = useApp();
  const { bizCampaign, offline, following } = useStore();
  const cloud = useCloud();
  const now = useNow();
  const [filter, setFilter] = useState<FeedTab>("Todo");
  const [localPhase, setPhase] = useState<"ok" | "loading" | "error">("ok");
  /* Con la nube, cada pestaña es una consulta real: Todo (lo último), Cerca (tu ciudad), Suscrito (a quien sigues) y
     España (lo más escuchado de la semana), con scroll infinito. */
  const feed = useCloudFeed(filter === "Cerca" ? { kind: "recent", city: me.city, enabled: cloud.on } : filter === "Suscrito" ? { kind: "recent", following: true, enabled: cloud.on } : filter === "España" ? { kind: "trending", enabled: cloud.on } : { kind: "recent", enabled: cloud.on });
  const load = (t: FeedTab) => {
    setFilter(t);
    if (cloud.on) { if (t === filter) feed.refresh(); return; }
    if (offline) { setPhase("error"); return; }
    setPhase("loading");
    window.setTimeout(() => setPhase("ok"), 350);
  };
  const phase = cloud.on ? (feed.status === "error" && !feed.spots.length ? "error" : (feed.status === "loading" || feed.status === "idle") && !feed.spots.length ? "loading" : "ok") : localPhase;
  /* Sin nube, tus Spots publicados (guardados con su voz) van primero en Todo, Cerca y España. */
  const mySpots = useMySpots();
  const carmenOn = !!bizCampaign && now > 0 && campaignEligible(bizCampaign, getBiz("carmen").distM, new Date(now));
  const sponsor = <SponsoredSpot key="sp" b={getBiz(carmenOn ? "carmen" : "trinche")} />;

  /* Listas de spots por pestaña */
  const spotLists: Record<FeedTab, SpotData[]> = {
    "Todo": [spots["laura"]!, spots["andrea"]!, spots["marta"]!, spots["dani"]!, spots["carlos"]!],
    "Cerca": [spots["dani"]!, spots["laura"]!, spots["carlos"]!],
    "Suscrito": Object.values(spots).filter((x) => following.includes(x.name)),
    "España": [spots["laura"]!, spots["andrea"]!, spots["marta"]!, spots["dani"]!, spots["carlos"]!],
  };

  const spotItems = spotLists[filter];
  /* En la nube, los ejemplos (rotulados) solo rellenan mientras haya pocos Spots reales. */
  const real = cloud.on ? feed.spots.map((m) => spotData(m, me.name)) : [];
  const allCards: SpotData[] = cloud.on ? [...real, ...(real.length < 5 && filter !== "Suscrito" && feed.status === "ready" && !feed.hasMore ? spotItems : [])]
    : filter === "Suscrito" ? spotItems : [...mySpots.map((m) => spotData(m, me.name)), ...spotItems];
  const empty = filter === "Suscrito" && allCards.length === 0;
  /* Scroll infinito: al acercarse al final se pide la siguiente página. */
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!cloud.on || !el || !feed.hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) feed.loadMore(); }, { rootMargin: "120% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cloud.on, feed, feed.hasMore, real.length]);

  /* Feed a pantalla completa: mientras Inicio está abierto el documento encaja por páginas y la cabecera fija
     publica su alto real, que las páginas restan para terminar justo encima de la barra inferior. */
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = headerRef.current;
    const apply = () => { if (el) root.style.setProperty("--home-header-h", `${el.offsetHeight}px`); };
    apply();
    root.classList.add("spot-feed-snap");
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (ro && el) ro.observe(el);
    return () => { ro?.disconnect(); root.classList.remove("spot-feed-snap"); root.style.removeProperty("--home-header-h"); };
  }, []);

  return <>
    {/* ── HEADER fijo ── */}
    <header ref={headerRef} className="sticky top-0 z-20 bg-background/95 px-3 pb-2 pt-[var(--safe-header)] backdrop-blur-md">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex min-w-0">
          <Button variant="ghost" size="icon" aria-label="Tu ubicación" onClick={() => toast("Ubicación: Sevilla, España")}><MapPin size={19} /></Button>
        </div>
        <Logo className="justify-self-center" />
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" aria-label="Buscar" onClick={() => app.open("buscar")}><Search size={19} /></Button>
          <Button variant="ghost" size="icon" aria-label="Notificaciones" onClick={onBell} className="relative"><Bell size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-live" /></Button>
        </div>
      </div>
      {/* Chips filtro */}
      <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }} role="tablist">
        {feedTabs.map((item) => (
          <button key={item} role="tab" aria-selected={filter === item} onClick={() => load(item)}
            className={"flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-[0.8125rem] font-semibold transition-all " + (filter === item
              ? "border-transparent text-foreground"
              : "border-border bg-card text-foreground/70 hover:border-primary/40")}
            style={filter === item ? { background: "linear-gradient(135deg,#7c3aed,#3b82f6)", borderColor: "transparent" } : {}}>
            {TAB_ICONS[item]}{item}
          </button>
        ))}
      </div>
    </header>

    {/* ── MAIN ── */}
    <main className="pb-[calc(var(--nav-h)+1rem)] pt-1">
      {/* Arriba: historias y «Ahora en Spotly» (primera parada del desplazamiento) */}
      <div className="spot-feed-snap-start pb-3">
        <div className="pt-1 pb-3">
          <StoriesStrip onOpenCreate={() => app.create()} />
        </div>
        <NowStrip />
        <IncognitoExpiredNote />
      </div>

      {phase === "loading" && (
        <div className="spot-feed-page bg-black" aria-busy="true">
          <Skeleton className="h-full rounded-none" />
        </div>
      )}
      {phase === "error" && (
        <div className="spot-feed-page grid place-items-center px-3">
          <StateCard icon={WifiOff} tone="muted" title="No se pudo cargar el feed" text="Sin conexión." action="Reintentar" onAction={() => { if (offline) toast.error("Sigues sin conexión"); else if (cloud.on) feed.refresh(); else load(filter); }} />
        </div>
      )}
      {phase === "ok" && (empty ? (
        <div className="spot-feed-page grid place-items-center px-3">
          <div className="w-full rounded-2xl border border-dashed border-border p-8 text-center">
            <Bell className="mx-auto text-primary" size={36} />
            <h3 className="mt-3 font-bold">Aún no sigues a nadie</h3>
            <p className="mt-1 text-sm text-muted-foreground">Descubre personas cerca de ti.</p>
            <Button className="mt-5" onClick={() => app.open("personas")}>Descubrir personas</Button>
          </div>
        </div>
      ) : (
        <>
          {allCards.map((s, i) => (
            <Fragment key={s.id + i}>
              {/* Una página = un Spot: ocupa toda la pantalla y encaja al deslizar */}
              <section className="spot-feed-page" aria-label={`Spot de ${s.incognito ? "Anónimo" : s.own ? me.name : s.name}`}><SpotCard s={s} /></section>
              {/* Lo patrocinado y los Hot Spots también ocupan su propia página, sobre su foto difuminada */}
              {/* Lo patrocinado y los Hot Spots de ejemplo solo en la demostración y sin nube (nada de anuncios falsos con datos reales). */}
              {!cloud.on && i === 0 && <FeedInsert img={getBiz(carmenOn ? "carmen" : "trinche").img}>{sponsor}</FeedInsert>}
              {!cloud.on && i === 2 && <FeedInsert img={hotspots[0]!.img}><HotSpotCard h={hotspots[0]!} /></FeedInsert>}
              {i === 4 && <FeedInsert img={sevilleNightPhoto}><IncognitoSpotCard /></FeedInsert>}
              {cloud.on && i === real.length - 1 && <div ref={sentinel} aria-hidden="true" />}
            </Fragment>
          ))}
          {cloud.on && feed.hasMore && <div className="spot-feed-page bg-black" aria-busy="true"><Skeleton className="h-full rounded-none" /></div>}
          <div className="spot-feed-snap-start pt-3">
            {!cloud.on && <PeopleStrip />}
            <FlashOfferCard />
            <p className="px-6 pb-2 pt-4 text-center text-2xs text-muted-foreground">
              <Flame size={12} className="mr-1 inline text-live" />Lo pagado se etiqueta "Impulsado" o "Patrocinado".
              <button onClick={() => (cloud.on ? feed.refresh() : load(filter))} className="ml-2 inline-flex items-center gap-1 text-primary"><RefreshCw size={11} />Actualizar</button>
            </p>
          </div>
        </>
      ))}
    </main>
  </>;
}

/** Página del feed para tarjetas que no son un Spot (patrocinado, Hot Spot, incógnito): centradas sobre su propia foto. */
function FeedInsert({ img, children }: { img: string; children: ReactNode }) {
  return (
    <section className="spot-feed-page relative grid place-items-center overflow-hidden bg-black">
      <img src={img} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      <div className="absolute inset-0 bg-background/45" />
      <div className="relative max-h-full w-full overflow-y-auto py-3">{children}</div>
    </section>
  );
}
