import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, Bookmark, Check, ChevronRight, Heart, Loader2, MapPin, Mic, MoreHorizontal, Pause, Play, RotateCcw, RotateCw, UserPlus, X, AlignJustify, Map, Flag, Navigation } from "lucide-react";
import { toast } from "sonner";
import { NewFollowers } from "./LocalAd";
import { useApp } from "./app-context";
import { BottomSheet } from "./kit";
import { MediaViewer } from "./MediaViewer";
import { sampleMedia } from "@/lib/media";
import { addReport, toggleFollow, useStore, useMe } from "@/lib/store";
import { VoiceReply } from "./Voice";
import { TalkBar, VoiceComposer, VoiceItem, VoiceThread, type ReplyTarget } from "./VoiceThread";
import { addVoiceNote, clockToMs, useThread } from "@/lib/voice/notes";
import { sampleThread, type SampleVoice } from "@/lib/voice/samples";
import { formatClock, seededPeaks } from "@/lib/voice/recorder";
import { playVoiceQueue, seekVoice, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { AnonAvatar, MeAvatar } from "./Author";
import { Cover } from "./Cover";
import { CloudPeopleSheet, FollowButton, PersonAvatar } from "./CloudPeople";
import { spotData, TOPIC_TAG } from "./spotData";
import { Button } from "@/components/ui/button";
import { api, cloudErrorText, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import { cloudSpot, recordSpotView, setSpotReplies, toggleSpotLike, toggleSpotSaved, useAuthorSpots, useCloudFeed } from "@/lib/spots";
import { profileLink, shareLink, spotLink } from "@/lib/share";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";

/* ── Waveform coloreada igual que el mockup ── */
function ColorWave({ active, big = false }: { active: boolean; big?: boolean }) {
  const count = big ? 38 : 26;
  return (
    <div className={`flex items-center gap-[0.15625rem] ${big ? "h-12 flex-1" : "h-8 flex-1"}`}>
      {Array.from({ length: count }, (_, i) => {
        const pct = 20 + ((i * 19 + i * i * 6) % 72);
        // degradado morado→azul como en el mockup
        const hue = active ? `hsl(${250 + (i / count) * 60}, 80%, 65%)` : `hsl(240,10%,45%)`;
        return (
          <span
            key={i}
            className="rounded-full transition-colors"
            style={{ width: big ? 3.5 : 3, height: `${pct}%`, background: hue }}
          />
        );
      })}
    </div>
  );
}

/* ── Datos de muestra: comentarios de voz de ejemplo (sin audio) con alguna respuesta encadenada ── */
const SAMPLE_COMMENTS: SampleVoice[] = [
  { key: "c1", name: "Carlos", img: stage, minsAgo: 64, dur: "0:12", likes: 16, verified: true },
  { key: "c2", name: "María", img: lauraPhoto, minsAgo: 58, dur: "0:08", likes: 8, replyTo: "c1", replyAt: "0:05" },
  { key: "c3", name: "Javi", img: festival, minsAgo: 121, dur: "0:20", likes: 12 },
  { key: "c4", name: "Ana", img: beach, minsAgo: 125, dur: "0:15", likes: 5, replyTo: "c3", replyAt: "0:11" },
  { key: "c5", name: "Lucía", img: lauraPhoto, minsAgo: 130, dur: "0:10", likes: 7, verified: true },
  { key: "c6", name: "David", img: stage, minsAgo: 140, dur: "0:18", likes: 9 },
  { key: "c7", name: "Elena", img: beach, minsAgo: 185, dur: "0:09", likes: 4 },
];
/** Comentarios de voz de ejemplo de un Spot (ids propias de ese Spot para que los me gusta no se mezclen). */
export const spotCommentSeed = (spotKey: string) => sampleThread(`spot:${spotKey}`, SAMPLE_COMMENTS);
/** Clave estable de un Spot para su conversación de voz. */
export const spotKeyOf = (s: { id?: string | undefined; text: string }) => s.id ?? s.text.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "-").slice(0, 40);
const EXTRA_TAGS = [["🌙", "Noche"], ["🎶", "Música en vivo"], ["📍", "Plan cerca"]];
const MORE_SPOTS = [
  { title: "Atardecer en Triana", author: "Laura", dur: "0:58", img: festival },
  { title: "Puente de Triana",    author: "Laura", dur: "0:42", img: stage },
  { title: "Calle Betis",         author: "Laura", dur: "1:15", img: beach },
  { title: "Feria de Abril",      author: "Laura", dur: "0:36", img: festival },
];
const MORE_LAURA = [
  { title: "Noche en Sevilla", dur: "1:03", img: stage },
  { title: "Plaza de España",  dur: "0:48", img: festival },
  { title: "Semana Santa",     dur: "1:22", img: beach },
];
const ALSO_LISTENED = [
  { name: "María",  img: lauraPhoto },
  { name: "Carlos", img: stage },
  { name: "Ana",    img: beach },
  { name: "Javi",   img: festival },
  { name: "Lucía",  img: lauraPhoto },
];
const REPORT_REASONS = ["Spam o engaño", "Acoso o insultos", "Contenido sexual", "Violencia o peligro", "Información falsa", "Suplantación de identidad"];

/* ── Sheet de opciones (columna central del mockup) ── */
function OptionsSheet({ s, name, onClose }: { s: SpotInfo; name: string; onClose: () => void }) {
  const app = useApp();
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const url = s.cloud && s.id ? spotLink(s.id) : null;
  const items = [
    { icon: <Navigation size={19} />, label: "Compartir", run: () => { if (!url) { toast(s.cloud ? "Los enlaces funcionarán cuando la app esté publicada en su dirección web." : "Este Spot no tiene enlace público."); return; } void shareLink({ title: "Spotly", text: `«${s.text}» · ${name} en Spotly`, url }); } },
    { icon: <Map size={19} />, label: "Ver en el mapa", run: () => app.goMap() },
    { icon: <MapPin size={19} />, label: `Ver más de ${s.city}`, run: () => app.openPhotoWall(s.city) },
  ];
  const send = () => {
    const uid = cloudUid();
    addReport(`Spot de ${name}`, reason);
    if (s.cloud && s.id && uid) void api.report(db(), uid, "spot", s.id, reason).catch((e) => toast.error(cloudErrorText(e)));
    toast("Gracias. Revisaremos este Spot.");
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} z={70}>
      {!report ? <>
        {items.map(it => (
          <button key={it.label} onClick={() => { onClose(); it.run(); }}
            className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left text-[0.9375rem] text-foreground hover:bg-secondary/60">
            <span className="text-muted-foreground">{it.icon}</span>{it.label}
          </button>
        ))}
        {!s.own && <button onClick={() => setReport(true)}
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-[0.9375rem] text-live hover:bg-secondary/60">
          <Flag size={19} className="text-live" />Denunciar este Spot
        </button>}
      </> : <>
        <h3 className="px-2 pb-1 text-lg font-bold">¿Por qué lo denuncias?</h3>
        <p className="px-2 pb-2 text-xs text-muted-foreground">Tu denuncia es anónima. El autor no sabrá quién la envió.</p>
        {REPORT_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={"flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm " + (reason === r ? "bg-secondary text-foreground" : "hover:bg-secondary")}>{r}{reason === r && <Check size={16} className="text-primary" />}</button>)}
        <div className="flex gap-2 pt-3"><Button variant="ghost" className="flex-1" onClick={() => setReport(false)}>Atrás</Button><Button className="flex-1 bg-live bg-none text-foreground hover:bg-live/90" disabled={!reason} onClick={send}>Enviar denuncia</Button></div>
      </>}
    </BottomSheet>
  );
}

/* ── Panel de comentarios de voz: el hilo del Spot con respuestas encadenadas, solo voz ── */
function CommentsPanel({ spotKey, root, seeded, closed, onSent, onClose }: { spotKey: string; root: ReplyTarget; seeded: boolean; closed?: boolean | undefined; onSent?: (() => void) | undefined; onClose: () => void }) {
  const threadId = `spot:${spotKey}`;
  const seed = useMemo(() => (seeded ? spotCommentSeed(spotKey) : []), [spotKey, seeded]);
  const notes = useThread(threadId, seed);
  const [talk, setTalk] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[90vh] max-w-[520px] flex-col overflow-hidden rounded-t-3xl bg-background" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Comentarios de voz">
        <div className="flex shrink-0 justify-center pt-2.5"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <span className="text-base font-bold">Comentarios de voz <span className="ml-1 font-normal text-muted-foreground">{notes.length}</span></span>
          <button onClick={onClose} aria-label="Cerrar comentarios" className="grid h-9 w-9 place-items-center rounded-full"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <VoiceThread threadId={threadId} seed={seed} root={root} freshId={fresh} emptyText={closed ? "Su autor ha cerrado las respuestas de este Spot." : "Aún no hay voces. Sé la primera en comentar este Spot."} />
        </div>
        <div className="shrink-0 border-t border-border bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {closed ? <p className="py-2 text-center text-xs text-muted-foreground">Respuestas cerradas por su autor</p>
            : talk
            ? <VoiceComposer autoFocus target={root} onClose={() => setTalk(false)} onSend={(clip, anon) => { const n = addVoiceNote({ threadId, parentId: null, replyAtMs: root.atMs, clip, anon }); setFresh(n.id); setTalk(false); onSent?.(); if (!n.pending) toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada"); }} />
            : <TalkBar onTalk={() => setTalk(true)} label="Añade un comentario de voz…" />}
        </div>
      </div>
    </div>
  );
}

/* ── Personas que también escucharon (solo en los Spots de ejemplo: quién escucha es privado) ── */
function ListenersSheet({ onClose, onPerson }: { onClose: () => void; onPerson: (name: string) => void }) {
  const { following } = useStore();
  return (
    <BottomSheet title="Personas que también escucharon" onClose={onClose} z={70}>
      <div className="space-y-1">
        {ALSO_LISTENED.map((p) => {
          const on = following.includes(p.name);
          return (
            <div key={p.name} className="flex items-center gap-3 py-2">
              <button onClick={() => onPerson(p.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <img src={p.img} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <span className="truncate text-sm font-semibold">{p.name}</span>
              </button>
              <Button size="sm" variant={on ? "secondary" : "default"} className="shrink-0 rounded-full" onClick={() => { toggleFollow(p.name); toast(on ? `Dejaste de seguir a ${p.name}` : `Sigues a ${p.name}`); }}>{on ? "Siguiendo" : "Seguir"}</Button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/* ── SpotDetail principal ── */
/**
 * Datos que necesita el detalle. `incognito`: autor con Incógnito de pago (sale «Anónimo»); `own`: es tu Spot;
 * `cloud`: Spot real de la nube (autor, me gusta, respuestas y escuchas de verdad).
 */
export type SpotInfo = { id?: string | undefined; name: string; city: string; ago: string; text: string; img: string; dur: string; dist: string; incognito?: boolean | undefined; own?: boolean | undefined;
  /** Audio real del Spot; los de ejemplo no tienen. */
  audio?: { src: string; durationMs: number; peaks: number[] } | undefined;
  video?: string | undefined; likes?: number | undefined; liked?: boolean | undefined; saved?: boolean | undefined; replies?: number | undefined; repliesAllowed?: boolean | undefined;
  cloud?: boolean | undefined; authorId?: string | null | undefined; avatar?: string | null | undefined; hashtag?: string | undefined; tags?: string[] | undefined; verified?: boolean | undefined };

/** Foto, vídeo o (si el Spot es solo voz) su onda. */
function SpotMedia({ s, peaks, className }: { s: SpotInfo; peaks: number[]; className: string }) {
  if (s.video) return <video src={s.video} autoPlay muted loop playsInline aria-label={s.text} className={className} />;
  if (s.img) return <img src={s.img} alt={s.text} className={className} />;
  return <div className={"grid place-items-center bg-spot-surface " + className} aria-label={`Spot de voz: ${s.text}`}><div className="flex h-2/5 w-4/5 items-center justify-between gap-1" aria-hidden="true">{peaks.map((h, i) => <span key={i} className="w-1.5 rounded-full bg-spot-gradient opacity-90" style={{ height: `${Math.round(h * 100)}%` }} />)}</div></div>;
}

export function SpotDetail({ s: initial, onClose, onAuthor }: { s: SpotInfo; onClose: () => void; onAuthor: () => void }) {
  const app = useApp();
  const [s,           setSpot]        = useState(initial);
  const me = useMe();
  const { demo } = useStore();
  const cloud = useCloud();
  const anon = !!s.incognito;
  const shownName = anon ? "Anónimo" : s.own ? me.name : s.name;
  const [person,      setPerson]      = useState<string | null>(null);
  const [cloudPerson, setCloudPerson] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [listeners,   setListeners]   = useState(false);
  const [allTags,     setAllTags]     = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const openSpot = (next: SpotInfo) => { setSpot(next); scroller.current?.scrollTo({ top: 0 }); };
  const toCity = () => { onClose(); app.openPhotoWall(s.city); };
  const [likedHere,   setLiked]       = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [replying,    setReplying]    = useState(false);
  const [options,     setOptions]     = useState(false);
  const [comments,    setComments]    = useState(false);
  /* Spot de la nube: me gusta y respuestas en vivo desde el almacén común (lo mismo que en el feed). */
  const live = s.cloud && s.id ? cloudSpot(s.id) : undefined;
  const liked = s.cloud ? (live?.cloud?.liked ?? !!s.liked) : likedHere;
  const likes = s.cloud ? (live?.cloud?.likes ?? s.likes ?? 0) : (s.likes ?? 0) + (likedHere ? 1 : 0);
  const like = () => { if (s.cloud && s.id) toggleSpotLike(s.id); else setLiked((l) => !l); };
  const isSaved = s.cloud ? (live?.cloud?.saved ?? !!s.saved) : saved;
  const toggleSaved = () => {
    if (s.cloud && s.id) { const on = toggleSpotSaved(s.id); if (on !== null) toast(on ? "Guardado en tu perfil" : "Quitado de guardados"); return; }
    setSaved((v) => !v); toast(saved ? "Quitado de guardados" : "Guardado");
  };
  const closed = s.repliesAllowed === false;
  /* Audio del Spot en el reproductor único: progreso, tiempos y saltos reales. Los Spots de ejemplo no tienen audio. */
  const spotKey = spotKeyOf(s);
  const audioId = `spot-audio:${spotKey}`;
  const pb = useVoicePlayback(audioId);
  const totalMs = s.audio?.durationMs ?? clockToMs(s.dur);
  const posMs = pb.active ? pb.positionMs : 0;
  const ratio = totalMs ? Math.min(1, posMs / totalMs) : 0;
  const threadId = `spot:${spotKey}`;
  /* Comentarios de ejemplo solo en los Spots de ejemplo: un Spot real nunca muestra voces inventadas. */
  const sampleSpot = !s.cloud && !s.own;
  const seed = useMemo(() => (sampleSpot ? spotCommentSeed(spotKey) : []), [spotKey, sampleSpot]);
  const thread = useThread(threadId, seed);
  useEffect(() => { if (s.cloud && s.id && live?.cloud && thread.filter((n) => !n.pending && !n.failed).length > live.cloud.replies) setSpotReplies(s.id, thread.filter((n) => !n.pending && !n.failed).length); }, [s.cloud, s.id, thread, live]);
  const peaks = useMemo(() => (s.audio?.peaks.length ? s.audio.peaks : seededPeaks(spotKey, 40)), [s.audio, spotKey]);
  const noAudio = () => toast("Spot de ejemplo: no tiene audio. Los Spots grabados con tu voz se escuchan aquí.");
  const countView = () => { if (s.cloud && s.id && !s.own) recordSpotView(s.id); };
  const togglePlay = () => { if (!s.audio) { noAudio(); return; } if (!pb.playing) countView(); toggleVoice(audioId, s.audio.src, s.audio.durationMs); };
  const seekTo = (ms: number) => { if (!s.audio) { noAudio(); return; } if (pb.active) seekVoice(audioId, ms); else { countView(); toggleVoice(audioId, s.audio.src, s.audio.durationMs); } };
  const playAll = () => {
    countView();
    const n = playVoiceQueue([...(s.audio ? [{ id: audioId, src: s.audio.src, durationMs: s.audio.durationMs }] : []), ...thread.map((x) => ({ id: x.id, src: x.src, durationMs: x.durationMs }))]);
    if (!n) toast("Aquí aún no hay voces con audio. Responde con la tuya y se escuchará en este hilo.");
    else toast(`Reproduciendo ${n} ${n === 1 ? "audio" : "audios"} seguidos`);
  };
  const playing = pb.playing;
  const authorPhoto = s.cloud ? s.avatar : s.img;
  const root: ReplyTarget = { name: shownName, author: { id: s.authorId, name: s.name, avatar: authorPhoto || undefined, anon, mine: s.own }, atMs: posMs, durationMs: totalMs };
  const url = s.cloud && s.id ? spotLink(s.id) : null;
  const share = () => { if (!url) { toast(s.cloud ? "Los enlaces funcionarán cuando la app esté publicada en su dirección web." : s.own ? "Este Spot está guardado solo en tu móvil: no tiene enlace público." : "Spot de ejemplo: no tiene enlace."); return; } void shareLink({ title: "Spotly", text: `«${s.text}» · ${shownName} en Spotly`, url }); };
  /* Más de la ciudad y del autor: reales en la nube; de ejemplo en los Spots de ejemplo. */
  const cityFeed = useCloudFeed({ kind: "recent", city: s.city, enabled: cloud.on && !!s.cloud });
  const authorSpots = useAuthorSpots(cloud.on && s.cloud && !anon ? s.authorId : null);
  const moreCity = s.cloud ? cityFeed.spots.filter((x) => x.id !== s.id).slice(0, 4).map((m) => spotData(m, me.name)) : [];
  const moreAuthor = s.cloud ? authorSpots.spots.filter((x) => x.id !== s.id).slice(0, 3).map((m) => spotData(m, me.name)) : [];
  const tags: [string, string][] = s.cloud ? [["🎙️", s.hashtag ?? "Spot"], ...(s.tags ?? [s.city]).map((t): [string, string] => ["📍", t])] : [["🌅", "Atardecer"], ["👥", "Ambiente"], ["🎵", s.city], ...(allTags ? EXTRA_TAGS as [string, string][] : [])];
  const openAuthor = () => { if (anon) return; if (s.own) { onAuthor(); return; } if (s.cloud && s.authorId) setCloudPerson({ id: s.authorId, name: s.name, avatar: s.avatar ?? null }); else onAuthor(); };

  return (
    <div ref={scroller} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* ── FOTO con acciones laterales ── */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
        <SpotMedia s={s} peaks={peaks} className="h-full w-full object-cover" />
        {/* gradiente inferior */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

        {/* ← atrás */}
        <button onClick={onClose} aria-label="Volver"
          className="absolute left-3 top-[var(--safe-header)] grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <ChevronLeft size={24} />
        </button>
        {/* ⋮ opciones */}
        <button onClick={() => setOptions(true)} aria-label="Opciones"
          className="absolute right-3 top-[var(--safe-header)] grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <MoreHorizontal size={20} />
        </button>

        {/* Acciones verticales derecha — EXACTAMENTE como el mockup */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
          <button onClick={like} aria-pressed={liked} aria-label={`Me gusta (${likes})`} className="flex flex-col items-center gap-1">
            <Heart size={28} fill={liked ? "#ff4d6d" : "none"} className={liked ? "text-[#ff4d6d]" : "text-white"} />
            <span className="text-xs font-bold text-white drop-shadow">{likes.toLocaleString("es-ES")}</span>
          </button>
          <button onClick={share} aria-label="Compartir" className="flex flex-col items-center gap-1">
            <Navigation size={26} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">Enviar</span>
          </button>
          <button onClick={toggleSaved} aria-pressed={isSaved} className="flex flex-col items-center gap-1">
            <Bookmark size={26} fill={isSaved ? "white" : "none"} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">Guardar</span>
          </button>
        </div>

        {/* 📍 Chip ciudad — esquina inferior izquierda de la foto */}
        <button onClick={toCity} aria-label={`Ver más de ${s.city}`} className="absolute left-3 bottom-5 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{s.city} <ChevronRight size={12} />
        </button>
      </div>

      {/* ── CONTENIDO DEBAJO DE LA FOTO ── */}
      <div className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-5 bg-background">

        {/* Título grande */}
        <div>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{s.text}</h1>
          {/* Autor */}
          {anon
            ? <div className="mt-2.5 flex items-center gap-2.5">
                <AnonAvatar className="h-11 w-11" size={20} />
                <div>
                  <div className="text-sm font-semibold">Anónimo</div>
                  <div className="text-xs text-muted-foreground">{s.dist} · Hace {s.ago} · Incógnito verificado</div>
                </div>
              </div>
            : <button onClick={openAuthor} className="mt-2.5 flex items-center gap-2.5 text-left">
                {s.own ? <MeAvatar className="h-11 w-11 border-2 border-primary text-base" /> : authorPhoto ? <img src={authorPhoto} alt={s.name} className="h-11 w-11 rounded-full border-2 border-primary object-cover" /> : <PersonAvatar p={{ name: s.name }} className="h-11 w-11 border-2 border-primary text-base" />}
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {shownName} {!s.cloud && !s.own && <span className="text-primary text-base">✓</span>}
                    {sampleSpot && !demo && <span className="ml-1 rounded-full border border-border px-1.5 text-4xs font-normal text-muted-foreground">ejemplo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.dist} · Hace {s.ago}</div>
                </div>
              </button>}
        </div>

        {/* ── PLAYER GRANDE ── fondo oscuro como el mockup */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0f0f1e" }}>
          {/* waveform + botón central grande */}
          <div className="flex items-center gap-3">
            <ColorWave active={playing} big />
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproducir"}
              className="shrink-0 grid h-[3.75rem] w-[3.75rem] place-items-center rounded-full"
              style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}
            >
              {pb.loading ? <Loader2 size={24} className="animate-spin text-white" /> : playing
                ? <Pause size={24} fill="white" className="text-white" />
                : <Play size={24} fill="white" className="text-white ml-0.5" />}
            </button>
            <ColorWave active={playing} big />
          </div>

          {/* barra de progreso */}
          <div className="relative h-1 rounded-full cursor-pointer" style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekTo(((e.clientX - rect.left) / rect.width) * totalMs);
            }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md"
              style={{ left: `calc(${ratio * 100}% - 7px)` }} />
          </div>

          {/* tiempos DEBAJO de la barra */}
          <div className="flex justify-between text-xs px-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span>{formatClock(posMs)}</span>
            <span>{formatClock(totalMs)}</span>
          </div>

          {/* ↺15  15↻ */}
          <div className="flex items-center justify-between px-4">
            <button onClick={() => seekTo(Math.max(0, posMs - 15000))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Retroceder 15s">
              <RotateCcw size={22} /><span className="text-4xs -mt-0.5">15</span>
            </button>
            <button onClick={() => seekTo(Math.min(totalMs, posMs + 15000))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Avanzar 15s">
              <RotateCw size={22} /><span className="text-4xs -mt-0.5">15</span>
            </button>
          </div>

          {/* Reproducir todos los audios */}
          <button
            onClick={playAll}
            className="w-full flex items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }}
          >
            <Play size={17} fill="white" />
            Reproducir todos los audios
            <AlignJustify size={17} />
          </button>
        </div>

        {/* ── Tags ── */}
        <div className="flex flex-wrap gap-2">
          {tags.map(([emoji, label]) => (
            <button key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium"
              onClick={() => (label === s.city ? toCity() : toast(`#${label}`))}>
              {emoji} {label}
            </button>
          ))}
          {!s.cloud && <button onClick={() => setAllTags(!allTags)} aria-label={allTags ? "Ver menos etiquetas" : "Ver más etiquetas"} className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium">{allTags ? "−" : "···"}</button>}
        </div>

        {/* ── Más sonidos de la ciudad ── */}
        {(!s.cloud || moreCity.length > 0) && <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Más sonidos de {s.city}</h3>
            <button onClick={toCity} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(s.cloud ? moreCity.map((m) => ({ title: m.text, dur: m.dur, img: m.img, peaks: m.audio?.peaks ?? [], open: () => openSpot(m) })) : MORE_SPOTS.map((sp, i) => ({ title: sp.title, dur: sp.dur, img: sp.img, peaks: [] as number[], open: () => openSpot({ name: sp.author, city: s.city, ago: `${i + 1} h`, text: sp.title, img: sp.img, dur: sp.dur, dist: "a 300 m" }) }))).map((sp, i) => (
              <button key={sp.title + i} onClick={sp.open} aria-label={`Escuchar ${sp.title}`} className="text-left">
                <div className="relative aspect-square rounded-xl overflow-hidden" style={i === 0 ? { outline: "2px solid #7c3aed" } : {}}>
                  {sp.img ? <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center gap-[0.125rem] bg-spot-surface px-1.5" aria-hidden="true">{sp.peaks.filter((_, k) => k % 4 === 0).map((h, k) => <i key={k} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 70)}%` }} />)}</span>}
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-4xs text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-3xs text-muted-foreground leading-tight line-clamp-2">{sp.title}</p>
              </button>
            ))}
          </div>
        </section>}

        {/* ── Personas que también escucharon (solo ejemplo: quién escucha cada Spot es privado) ── */}
        {sampleSpot && <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Personas que también escucharon</h3>
            <button onClick={() => setListeners(true)} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="flex gap-4">
            {ALSO_LISTENED.map(p => (
              <button key={p.name} onClick={() => setPerson(p.name)} aria-label={`Ver perfil de ${p.name}`} className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <img src={p.img} alt={p.name} className="h-13 w-13 rounded-full object-cover border-2 border-border" />
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-3xs font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>+</span>
                </div>
                <span className="text-3xs text-muted-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        </section>}

        {/* ── Más del autor ── (no se muestra si el autor es anónimo) */}
        {!anon && (!s.cloud || moreAuthor.length > 0) && <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Más de {shownName}</h3>
            <button onClick={openAuthor} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(s.cloud ? moreAuthor.map((m) => ({ title: m.text, dur: m.dur, img: m.img, peaks: m.audio?.peaks ?? [], open: () => openSpot(m) })) : MORE_LAURA.map((sp, i) => ({ title: sp.title, dur: sp.dur, img: sp.img, peaks: [] as number[], open: () => openSpot({ ...s, id: undefined, ago: `${i + 2} d`, text: sp.title, img: sp.img, dur: sp.dur, audio: undefined }) }))).map((sp, i) => (
              <button key={sp.title + i} onClick={sp.open} aria-label={`Escuchar ${sp.title}`} className="text-left">
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  {sp.img ? <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center gap-[0.125rem] bg-spot-surface px-1.5" aria-hidden="true">{sp.peaks.filter((_, k) => k % 4 === 0).map((h, k) => <i key={k} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 70)}%` }} />)}</span>}
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-4xs text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-3xs text-muted-foreground leading-tight">{sp.title}</p>
              </button>
            ))}
          </div>
        </section>}
      </div>

      {/* ── FOOTER FIJO ── */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center gap-3">
          <MeAvatar className="h-9 w-9 text-xs" />
          <button onClick={() => (closed ? toast("Su autor ha cerrado las respuestas de este Spot.") : setReplying(true))}
            className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground text-left">
            <Mic size={15} className="text-primary shrink-0" />{closed ? "Respuestas cerradas" : "Responde con tu voz…"}
          </button>
          <button onClick={() => setComments(true)} aria-label={`Ver comentarios de voz (${thread.length})`} className="flex min-h-10 items-center gap-1.5 px-1 text-muted-foreground">
            <Mic size={19} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">{thread.length}</span>
          </button>
        </div>
      </div>

      {replying && <VoiceReply name={shownName} threadId={threadId} target={root} onClose={() => setReplying(false)} />}
      {options  && <OptionsSheet s={s} name={shownName} onClose={() => setOptions(false)} />}
      {comments && <CommentsPanel spotKey={spotKey} root={root} seeded={sampleSpot} closed={closed} onClose={() => setComments(false)} />}
      {listeners && <ListenersSheet onClose={() => setListeners(false)} onPerson={(n) => { setListeners(false); setPerson(n); }} />}
      {person && <AuthorProfile name={person} onClose={() => setPerson(null)} />}
      {cloudPerson && <AuthorProfile name={cloudPerson.name} id={cloudPerson.id} avatar={cloudPerson.avatar} onClose={() => setCloudPerson(null)} />}
    </div>
  );
}

/* ── AuthorProfile ── */
const AUTHOR_SPOTS = [festival, stage, beach, stage, beach, festival];

/**
 * Perfil de otra persona. Con la nube y su id: su portada, foto, ciudad, presentación de voz, cifras reales, sus
 * Spots, seguir y mandarle un mensaje de voz a vuestro chat privado. Sin id (personas de ejemplo): la demostración.
 */
export function AuthorProfile({ name, id, avatar, onClose }: { name: string; id?: string | null | undefined; avatar?: string | null | undefined; onClose: () => void }) {
  const cloud = useCloud();
  if (id && cloud.on) return <CloudAuthorProfile id={id} name={name} avatar={avatar ?? null} onClose={onClose} />;
  return <SampleAuthorProfile name={name} onClose={onClose} />;
}

function SampleAuthorProfile({ name, onClose }: { name: string; onClose: () => void }) {
  const { demo } = useStore();
  const [viewer, setViewer] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [voice,  setVoice]  = useState(false);
  const [list,   setList]   = useState(false);
  const presentation = useMemo(() => sampleThread(`presentacion:${name}`, [{ key: "p", name, img: beach, minsAgo: 60 * 24 * 3, dur: "0:15", likes: 42, verified: true }])[0]!, [name]);
  if (list) return <NewFollowers onClose={() => setList(false)} />;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))]">
      <div className="relative h-40">
        <img src={stage} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-[var(--safe-header)] bg-background/75"><ChevronLeft size={24} /></Button>
      </div>
      <div className="-mt-12 px-4 text-center">
        <img src={beach} alt="" className="relative mx-auto h-24 w-24 rounded-full border-4 border-background object-cover" />
        <h2 className="mt-2 text-xl font-bold">{name} <span className="text-primary">✦</span></h2>
        <p className="text-xs text-muted-foreground">Sevilla · Verificado{!demo && " · perfil de ejemplo"}</p>
        <div className="mt-4 grid grid-cols-3 rounded-2xl border border-border bg-card py-3 text-sm">
          {[["128", "Spots"], [follow ? "4.822" : "4.821", "Seguidores"], ["312", "Siguiendo"]].map(([a, b]) => (
            <div key={b} onClick={() => b === "Seguidores" && setList(true)} className={b === "Seguidores" ? "cursor-pointer" : ""}>
              <strong className="block">{a}</strong><small className="text-muted-foreground">{b}</small>
            </div>
          ))}
        </div>
        <div className="mt-4 text-left"><VoiceItem compact note={{ ...presentation, liked: false, replies: 0 }} onReply={() => setVoice(true)} right={<span className="text-2xs text-muted-foreground">Presentación</span>} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => { setFollow(!follow); toast(follow ? "Has dejado de seguir a " + name : "Ahora sigues a " + name); }} variant={follow ? "secondary" : "default"}>
            {follow ? <><Check size={16} />Siguiendo</> : <><UserPlus size={16} />Seguir</>}
          </Button>
          <Button variant="secondary" className="whitespace-nowrap px-3" onClick={() => setVoice(true)}><Mic size={16} />Mensaje de voz</Button>
        </div>
        <h3 className="mt-6 text-left text-sm font-bold">Sus Spots</h3>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {AUTHOR_SPOTS.map((p, i) => (
            <button key={i} onClick={() => setViewer(i)} aria-label={`Ver Spot ${i + 1} de ${name}`} className="overflow-hidden rounded-md"><img src={p} alt="" className="aspect-square w-full rounded-md object-cover" /></button>
          ))}
        </div>
      </div>
      {voice && <VoiceReply name={name} mode="message" onClose={() => setVoice(false)} />}
      {viewer !== null && <MediaViewer start={viewer} onClose={() => setViewer(null)} items={AUTHOR_SPOTS.map((img, k) => {
        const m = sampleMedia.find((x) => x.img === img);
        return { kind: "foto" as const, src: img, caption: m?.caption ?? `Spot de ${name}`, place: m?.place ?? "Sevilla", likes: (m?.likes ?? 120) + k * 7 };
      })} />}
    </div>
  );
}

function CloudAuthorProfile({ id, name, avatar, onClose }: { id: string; name: string; avatar: string | null; onClose: () => void }) {
  const me = useMe();
  const cloud = useCloud();
  const [profile, setProfile] = useState<api.ProfileRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [voice, setVoice] = useState(false);
  const [list, setList] = useState<"Seguidores" | "Siguiendo" | null>(null);
  const [spot, setSpot] = useState<SpotInfo | null>(null);
  const [other, setOther] = useState<api.ProfileRow | null>(null);
  const [blocking, setBlocking] = useState(false);
  const spots = useAuthorSpots(id);
  const presentationThread = `presentacion:${id}`;
  const presentation = useThread(presentationThread).filter((n) => !n.pending).sort((a, b) => b.createdAt - a.createdAt)[0];
  const following = cloud.following.includes(id);
  useEffect(() => {
    let alive = true;
    api.fetchProfile(db(), id).then((p) => { if (!alive) return; if (p) setProfile(p); else setMissing(true); }).catch(() => undefined);
    return () => { alive = false; };
  }, [id, following]);
  const shown = profile?.display_name || profile?.username || name;
  const photo = profile ? fileUrl(profile.avatar_path) : avatar;
  const cover = profile?.cover ? (profile.cover.startsWith("preset:") ? profile.cover : fileUrl(profile.cover)) : "preset:noche";
  const isMe = id === cloud.uid;
  const blockIt = () => {
    const uid = cloudUid();
    if (!uid) return;
    setBlocking(true);
    void api.block(db(), uid, id, true).then(() => { toast(`Has bloqueado a ${shown}`); onClose(); }).catch((e) => toast.error(cloudErrorText(e))).finally(() => setBlocking(false));
  };
  const share = () => { const url = profile ? profileLink(profile.username) : null; void shareLink({ title: `${shown} en Spotly`, url }); };
  if (other) return <AuthorProfile name={other.display_name || other.username} id={other.id} avatar={fileUrl(other.avatar_path)} onClose={() => setOther(null)} />;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))]">
      <div className="relative h-40">
        <Cover cover={cover} className="h-full w-full" />
        <span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-[var(--safe-header)] bg-background/75"><ChevronLeft size={24} /></Button>
        <Button variant="icon" size="icon" aria-label="Compartir perfil" onClick={share} className="absolute right-3 top-[var(--safe-header)] bg-background/75"><Navigation size={18} /></Button>
      </div>
      <div className="-mt-12 px-4 text-center">
        {photo ? <img src={photo} alt="" className="relative mx-auto h-24 w-24 rounded-full border-4 border-background object-cover" /> : <PersonAvatar p={{ name: shown }} className="relative mx-auto h-24 w-24 border-4 border-background text-3xl" />}
        <h2 className="mt-2 text-xl font-bold">{shown}</h2>
        <p className="text-xs text-muted-foreground">{profile ? `@${profile.username}${profile.city ? ` · ${profile.city}` : ""}` : missing ? "Esta cuenta ya no existe" : " "}</p>
        <div className="mt-4 grid grid-cols-3 rounded-2xl border border-border bg-card py-3 text-sm">
          {([[profile?.spots, "Spots", null], [profile?.followers, "Seguidores", "Seguidores"], [profile?.following, "Siguiendo", "Siguiendo"]] as const).map(([n, label, open]) => (
            <button key={label} disabled={!open || !profile} onClick={() => open && setList(open)} className="disabled:cursor-default">
              <strong className="block tabular-nums">{n === undefined ? "·" : n.toLocaleString("es-ES")}</strong><small className="text-muted-foreground">{label}</small>
            </button>
          ))}
        </div>
        <div className="mt-4 text-left">
          {presentation
            ? <VoiceItem compact note={presentation} onReply={isMe ? undefined : () => setVoice(true)} right={<span className="text-2xs text-muted-foreground">Presentación</span>} />
            : <p className="rounded-3xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{isMe ? "Graba tu presentación de voz desde tu perfil." : `${shown} aún no ha grabado su presentación de voz.`}</p>}
        </div>
        {!isMe && !missing && <div className="mt-4 grid grid-cols-2 gap-2">
          <FollowButton id={id} className="h-10 w-full rounded-full text-sm" />
          <Button variant="secondary" className="whitespace-nowrap px-3" onClick={() => setVoice(true)}><Mic size={16} />Mensaje de voz</Button>
        </div>}
        <h3 className="mt-6 text-left text-sm font-bold">Sus Spots</h3>
        {spots.status === "loading" && !spots.spots.length && <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-primary" size={22} /></div>}
        {spots.status !== "loading" && !spots.spots.length && <p className="py-6 text-sm text-muted-foreground">Aún no ha publicado ningún Spot.</p>}
        <div className="mt-2 grid grid-cols-3 gap-1">
          {spots.spots.map((m) => {
            const d = spotData(m, me.name);
            return (
              <button key={m.id} onClick={() => setSpot(d)} aria-label={`Escuchar ${m.title}`} className="relative overflow-hidden rounded-md">
                {d.img ? <img src={d.img} alt="" className="aspect-square w-full rounded-md object-cover" /> : d.video ? <video src={d.video} muted playsInline preload="metadata" className="aspect-square w-full rounded-md bg-black object-cover" /> : <span className="flex aspect-square w-full items-center justify-center gap-[0.125rem] rounded-md bg-spot-surface px-1.5" aria-hidden="true">{m.audio.peaks.filter((_, k) => k % 4 === 0).map((h, k) => <i key={k} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 70)}%` }} />)}</span>}
                <span className="absolute bottom-1 left-1 text-3xs font-semibold text-white drop-shadow">{d.dur}</span>
              </button>
            );
          })}
        </div>
        {!isMe && !missing && <Button variant="ghost" className="mt-6 w-full text-live" disabled={blocking} onClick={blockIt}>Bloquear a {shown}</Button>}
      </div>
      {voice && <VoiceReply name={shown} mode="message" toUserId={id} onClose={() => setVoice(false)} />}
      {list && <CloudPeopleSheet userId={id} kind={list} onSwitch={setList} onClose={() => setList(null)} onOpen={(p) => { setList(null); if (p.id !== id) setOther(p); }} />}
      {spot && <SpotDetail s={spot} onClose={() => setSpot(null)} onAuthor={() => setSpot(null)} />}
    </div>
  );
}
