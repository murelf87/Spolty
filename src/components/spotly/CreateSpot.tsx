import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, FileAudio, Flame, Ghost, Headphones, ImageIcon, Loader2, MapPin, MessageCircle, Mic, Pause, Play, Radio, RefreshCw, Rocket, Shield, Trash2, Type, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle, Trust, TopBar, BottomSheet } from "./kit";
import { type MineSpot } from "./Feed";
import { BoostFlow } from "./BoostFlow";
import { IncognitoSheet } from "./Incognito";
import { LiveBroadcast } from "./LiveBroadcast";
import { PlaceBrowser } from "./Places";
import { VoiceWave } from "./VoiceThread";
import { useApp } from "./app-context";
import { useGate } from "./Gate";
import { saveMyCity, useStore, useMe } from "@/lib/store";
import { commerce, locationPrecision } from "@/lib/spotlyConfig";
import { formatClock, recorderErrorText, useVoiceRecorder } from "@/lib/voice/recorder";
import { stopAllVoices, toggleVoice, useVoicePlayback, playVoice } from "@/lib/voice/player";
import { useCamera, VIDEO_MAX_MS } from "@/lib/camera";
import { publishSpot } from "@/lib/spots";
import { cloudErrorText } from "@/lib/cloud";
import { SignAs, useAnonAllowed } from "./Author";

const opts = {
  vis: ["Todos (público)", "Solo cerca (tu ciudad)", "Solo seguidores"],
  topic: ["¿Qué está pasando?", "Planes", "Música", "Comida", "Opiniones", "Algo que contar"],
  precision: locationPrecision.map((p) => p.label),
};
const titles = { vis: "Quién puede escucharte", topic: "Tema", precision: "Precisión de la ubicación" } as const;
type Key = keyof typeof opts;
const TITLE_MAX = 80;
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
type Media = { blob: Blob; url: string; kind: "photo" | "video" };

/**
 * Crear Spot: foto o vídeo opcional (cámara real o galería), tu voz grabada con el micrófono (con escucha previa y
 * descarte) y un título, que es lo único que se escribe en Spotly. Al publicar se guarda con su audio y su imagen.
 */
export function CreateSpot({ onClose, onPublished }: { onClose: () => void; onPublished: (m: NonNullable<MineSpot>) => void }) {
  const app = useApp();
  const { credits } = useStore();
  const anonAllowed = useAnonAllowed();
  const incognito = { active: anonAllowed.active };
  const me = useMe();
  /* Firma del Spot: tu nombre, o «Anónimo» con fantasma si tienes Incógnito (de pago) activo. */
  const [anon, setAnon] = useState(incognito.active);
  useEffect(() => { if (incognito.active) setAnon(true); }, [incognito.active]);
  const [broadcast, setBroadcast] = useState(false);
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<Media | null>(null);
  const [mode, setMode] = useState<"FOTO" | "VÍDEO">("FOTO");
  const [front, setFront] = useState(false);
  const [torch, setTorchOn] = useState(false);
  const [zoom, setZoomLevel] = useState(1);
  const [live, setLive] = useState(true);
  const [replies, setReplies] = useState(true);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState(me.city || "Sevilla");
  const [hidden, setHidden] = useState(false);
  const [sel, setSel] = useState<Record<Key, number>>({ vis: 0, topic: 0, precision: 1 });
  const [pick, setPick] = useState<null | Key | "zona">(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [incogOpen, setIncogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<NonNullable<MineSpot> | null>(null);
  const gallery = useRef<HTMLInputElement | null>(null);
  const audioFile = useRef<HTMLInputElement | null>(null);
  const gateCam = useGate({ camera: true });
  const gateMic = useGate({ mic: true });
  const gatePub = useGate({ verified: true, online: true });
  const rec = useVoiceRecorder({ maxSeconds: commerce.voiceMaxSeconds });
  const previewId = "create-spot-preview";
  const pb = useVoicePlayback(previewId);
  const cam = useCamera(step === 1 && !gateCam, front ? "user" : "environment");
  const mediaUrl = useRef<string | null>(null);

  useEffect(() => { if (rec.error) toast.error(recorderErrorText(rec.error, commerce.voiceMaxSeconds)); }, [rec.error]);
  /* Al salir: se apaga el audio de la escucha y se libera la imagen si no se publicó. */
  useEffect(() => () => { stopAllVoices(); if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current); }, []);

  const applyMedia = (blob: Blob, kind: "photo" | "video") => {
    if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    const url = URL.createObjectURL(blob);
    mediaUrl.current = url;
    setMedia({ blob, url, kind });
    setStep(2);
  };
  const pickFile = async (f?: File | null) => {
    if (!f) return;
    const kind = f.type.startsWith("image/") ? "photo" : f.type.startsWith("video/") ? "video" : null;
    if (!kind || f.size > MEDIA_MAX_BYTES) { toast.error("Elige una foto o un vídeo de hasta 50 MB."); return; }
    if (kind === "video") {
      const url = URL.createObjectURL(f);
      const secs = await new Promise<number>((resolve) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => resolve(v.duration); v.onerror = () => resolve(0); v.src = url; });
      URL.revokeObjectURL(url);
      if (secs > 60.5) { toast.error("El vídeo puede durar como máximo 1 minuto."); return; }
    }
    applyMedia(f, kind);
  };
  const shoot = async () => {
    if (mode === "FOTO") {
      const b = await cam.takePhoto();
      if (b) applyMedia(b, "photo"); else toast.error("La cámara aún no está lista.");
      return;
    }
    if (cam.recording) { cam.stopVideo(); return; }
    if (!cam.startVideo((b) => applyMedia(b, "video"))) toast.error("Este navegador no puede grabar vídeo. Elige uno de la galería.");
  };
  const toggleTorch = async () => { const ok = await cam.setTorch(!torch); if (ok) setTorchOn(!torch); else toast("Este móvil no deja controlar el flash desde el navegador."); };
  const zoomTo = async (z: number) => { if (await cam.setZoom(z)) setZoomLevel(z); };
  const zoomSteps = useMemo(() => cam.caps.zoom ? [cam.caps.zoom.min, Math.min(cam.caps.zoom.max, 2), Math.min(cam.caps.zoom.max, 5)].filter((v, i, a) => a.indexOf(v) === i) : [], [cam.caps.zoom]);

  const titleOk = title.trim().length >= 3;
  const zoneLabel = hidden ? "Ubicación oculta" : city;
  /* Se publica con el audio aún en la grabadora: si la red falla, el Spot no se pierde y se puede reintentar. */
  const publish = async () => {
    if (gatePub || publishing) return;
    const clip = rec.clip;
    if (!clip) { toast.error("Graba tu voz antes de publicar."); setStep(2); return; }
    if (!titleOk) { toast.error("Ponle un título de al menos 3 letras."); return; }
    if (anon && sel.vis === 2) { toast.error("Un Spot anónimo no puede ser solo para tus seguidores: delataría quién eres."); return; }
    setPublishing(true);
    stopAllVoices();
    try {
      const spot = await publishSpot({
        title: title.trim().slice(0, TITLE_MAX), city: hidden ? me.city || city : city, zone: hidden ? "" : zoneLabel, topic: opts.topic[sel.topic]!, visibility: opts.vis[sel.vis]!,
        precision: hidden ? "Oculta" : opts.precision[sel.precision]!, anon, boosted, happeningNow: live, repliesAllowed: replies,
        clip, mediaFile: media?.blob, mediaKind: media?.kind,
      });
      rec.take(); // el Spot se queda con el audio (no se libera al cerrar)
      setPublished(spot);
    } catch (e) {
      toast.error(cloudErrorText(e));
    } finally {
      setPublishing(false);
    }
  };
  const finish = () => { if (published) onPublished(published); onClose(); };

  if (broadcast) return <LiveBroadcast onClose={onClose} />;

  if (published) {
    const list = [
      anon ? "Publicado como «Anónimo» 👻 · Incógnito verificado" : `Publicado con tu nombre: ${me.name}`,
      `«${published.title}» · ${formatClock(published.audio.durationMs)} de voz`,
      sel.vis === 0 ? "En el feed Para todos y en Cerca de ti" : sel.vis === 1 ? "Solo para quien sea de tu ciudad" : "Solo para tus seguidores",
      "En " + zoneLabel,
      hidden || sel.precision === 2 ? "Sin ubicación en el mapa" : `En el mapa (${opts.precision[sel.precision]!.toLowerCase()})`,
      boosted ? "Impulsado: más distribución, sin visitas garantizadas" : "Publicar es gratis. Puedes impulsarlo más tarde",
      replies ? "Pueden responderte con su voz" : "Sin respuestas de voz",
    ];
    return <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col overflow-y-auto bg-background px-6 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[max(5rem,calc(env(safe-area-inset-top)+2rem))] text-center">
      <div className="mx-auto grid h-24 w-24 shrink-0 place-items-center rounded-full bg-spot-gradient shadow-glow"><Check size={46} /></div>
      <h2 className="mt-7 text-3xl font-bold">¡Publicado!</h2><p className="mt-2 text-sm text-muted-foreground">Tu Spot ya está en Spotly</p>
      <div className="mx-auto mt-8 w-full max-w-sm space-y-3 text-left text-sm">{list.map((x) => <p key={x} className="flex items-center gap-3"><Check size={16} className="shrink-0 text-primary" />{x}</p>)}</div>
      <div className="mt-auto pt-8"><Button className="w-full bg-spot-gradient text-foreground" onClick={finish}>Ver mi Spot</Button>
        {!boosted && <Button variant="secondary" className="mt-2 w-full" onClick={() => { finish(); app.open("impulso"); }}><Rocket size={16} />Impulsarlo ahora</Button>}
        <Button variant="ghost" className="mt-2 w-full" onClick={finish}>Seguir explorando</Button></div>
    </div>;
  }

  if (boostOpen) return <BoostFlow preview={media?.kind === "photo" ? media.url : undefined} onBack={() => setBoostOpen(false)} onDone={(b) => { setBoostOpen(false); if (b) { setBoosted(true); toast.success("Impulso añadido a tu Spot"); } }} />;

  const recording = rec.state === "recording";
  const clip = rec.clip;
  const mirror = (on: boolean) => Array.from({ length: 18 }, (_, i) => rec.live[rec.live.length - 18 + (on ? 17 - i : i)]);
  const liveSide = (flip: boolean) => (
    <div className="flex h-12 min-w-0 flex-1 items-center justify-between gap-[0.125rem]" aria-hidden="true">
      {mirror(flip).map((v, i) => v === undefined ? <span key={i} className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/35" /> : <span key={i} className="spot-voice-bar" style={{ height: `${Math.round(Math.max(0.1, Math.min(1, v * 9)) * 100)}%`, background: "var(--wave-from)" }} />)}
    </div>
  );

  return <div className="fixed inset-0 z-40 mx-auto max-w-[520px] overflow-y-auto bg-background">
    <TopBar title={step === 3 ? "Tu Spot está listo" : ""} onBack={step === 0 ? onClose : () => setStep((s) => (s === 2 && !media ? 0 : s - 1))} close={step === 0} sticky border={false} />
    <main className="mx-auto max-w-md p-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <input ref={gallery} type="file" accept="image/*,video/*" className="hidden" aria-label="Elegir foto o vídeo de la galería" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
      {step === 0 && <>
        {/* Story-style top strip */}
        <div className="-mx-5 -mt-5 flex gap-3 overflow-x-auto px-5 pt-4 pb-5 scrollbar-none" style={{scrollbarWidth:"none"}}>
          {(["📸 Foto", "🎙️ Voz", "📹 Vídeo", "🔴 Directo", "👻 Incógnito"] as const).map((s) => (
            <button key={s} onClick={() => {
              if (s === "📸 Foto") { setMode("FOTO"); setStep(1); }
              else if (s === "🎙️ Voz") { setMedia(null); setStep(2); }
              else if (s === "📹 Vídeo") { setMode("VÍDEO"); setStep(1); }
              else if (s === "🔴 Directo") setBroadcast(true);
              else if (s === "👻 Incógnito") setIncogOpen(true);
            }} className="flex shrink-0 flex-col items-center gap-1.5">
              <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-primary/60 bg-secondary text-2xl shadow-glow">{s.split(" ")[0]}</span>
              <span className="text-2xs text-muted-foreground">{s.split(" ")[1]}</span>
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="mt-2 text-center">
          <h3 className="text-2xl font-bold">Crear Spot</h3>
          <p className="mt-1 text-sm text-muted-foreground">¿Qué quieres compartir hoy?</p>
        </div>

        {/* Main action grid — big tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => { setMode("FOTO"); setStep(1); }} className="col-span-2 relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--spot-blue)] to-[var(--spot-fuchsia)] text-foreground"><Camera size={26} /></span>
              <div>
                <strong className="block text-base">Cámara</strong>
                <small className="text-muted-foreground">Haz una foto o graba un vídeo</small>
              </div>
            </div>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">›</span>
          </button>
          <button onClick={() => { setMedia(null); setStep(2); }} className="relative overflow-hidden rounded-2xl bg-spot-gradient p-5 text-left shadow-glow">
            <Mic size={30} className="mb-3" />
            <strong className="block text-sm">Solo voz</strong>
            <small className="block text-2xs font-normal opacity-80">Tu historia, tu voz</small>
          </button>
          <button onClick={() => gallery.current?.click()} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left">
            <ImageIcon size={30} className="mb-3 text-primary" />
            <strong className="block text-sm">Galería</strong>
            <small className="block text-2xs font-normal text-muted-foreground">Elige de tu móvil</small>
          </button>
          <button onClick={() => setBroadcast(true)} className="relative overflow-hidden rounded-2xl border border-live/40 bg-live/10 p-5 text-left col-span-2">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-live/20 text-live"><Radio size={26} /></span>
              <div>
                <strong className="block text-base text-live">Hacer un directo</strong>
                <small className="text-muted-foreground">Emite con cámara o solo con tu voz</small>
              </div>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-live px-3 py-1 text-2xs font-bold text-foreground"><span className="h-1.5 w-1.5 rounded-full bg-foreground spot-pulse" />EN VIVO</span>
            </div>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {([[Ghost, "Incógnito", "text-accent", () => setIncogOpen(true)], [Rocket, "Impulsar", "text-premium", () => setBoostOpen(true)], [Users, "Evento", "text-primary", () => { onClose(); app.open("crear-evento"); }]] as const).map(([I, l, c, f]) => (
            <button key={l} onClick={f} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-4">
              <I size={20} className={c} />
              <span className="text-2xs font-semibold">{l}</span>
            </button>
          ))}
        </div>

        <div className="mt-5"><Trust>Solo cuentas verificadas pueden publicar. Publicar y ser descubierto es gratis; el dinero solo compra más distribución.</Trust></div>
      </>}

      {/* Cámara real */}
      {step === 1 && (gateCam || cam.state === "denied" || cam.state === "unsupported" || cam.state === "error"
        ? <div className="mt-6 space-y-3">
            {gateCam ?? <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center"><Camera className="mx-auto text-live" size={28} /><h3 className="mt-2 font-bold">{cam.state === "denied" ? "Cámara sin permiso" : "Cámara no disponible"}</h3><p className="mx-auto mt-1 max-w-[17.5rem] text-sm text-muted-foreground">{cam.state === "denied" ? "Permite la cámara en los ajustes del navegador o del móvil, o elige una foto de tu galería." : "Este dispositivo o esta vista no permite usar la cámara. Puedes elegir una foto o un vídeo de tu galería."}</p></div>}
            <Button variant="secondary" className="w-full" onClick={() => gallery.current?.click()}><ImageIcon size={16} />Usar una foto o vídeo de la galería</Button>
            <Button variant="ghost" className="w-full" onClick={() => { setMedia(null); setStep(2); }}>Publicar solo con voz</Button>
          </div>
        : <div className="-mx-5 flex min-h-[calc(100vh_-_4.5rem_-_var(--safe-header)_-_max(1.25rem,calc(env(safe-area-inset-bottom)_+_0.75rem)))] flex-col bg-background">
          <div className="relative mx-3 mt-2 flex-1 overflow-hidden rounded-3xl bg-black">
            <video ref={cam.video} playsInline muted autoPlay aria-label="Vista de la cámara" className="absolute inset-0 h-full w-full object-cover" style={{ transform: front ? "scaleX(-1)" : undefined }} />
            {cam.state !== "live" && <span className="absolute inset-0 grid place-items-center text-sm text-white/80"><span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Abriendo la cámara…</span></span>}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
              <button aria-label="Cerrar cámara" onClick={() => setStep(0)} className="grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur"><X size={18} /></button>
              {cam.caps.torch && <button aria-label="Flash" aria-pressed={torch} onClick={() => void toggleTorch()} className={"grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur " + (torch ? "text-premium" : "")}><Zap size={18} /></button>}
              <button aria-label="Cambiar cámara" onClick={() => setFront(!front)} className="grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur"><RefreshCw size={18} /></button>
            </div>
            {cam.recording && <span className="absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-live px-3 py-1 text-xs font-bold text-white"><span className="h-2 w-2 rounded-full bg-white spot-pulse" />{formatClock(cam.recMs)} / {formatClock(VIDEO_MAX_MS)}</span>}
            {zoomSteps.length > 1 && <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{zoomSteps.map((z) => <button key={z} onClick={() => void zoomTo(z)} className={"grid h-8 min-w-8 place-items-center rounded-full px-1.5 text-2xs font-semibold backdrop-blur " + (zoom === z ? "bg-foreground/90 text-background" : "bg-background/50")}>{z.toLocaleString("es-ES", { maximumFractionDigits: 1 })}x</button>)}</div>}
          </div>
          <div className="mt-3 flex justify-center"><div className="flex rounded-full bg-secondary p-1 text-2xs font-semibold">{(["VÍDEO", "FOTO"] as const).map((m) => <button key={m} disabled={cam.recording} onClick={() => setMode(m)} className={"rounded-full px-3 py-1 " + (mode === m ? "bg-foreground text-background" : "text-muted-foreground")}>{m}</button>)}</div></div>
          <div className="flex h-28 items-center justify-around">
            <button onClick={() => gallery.current?.click()} aria-label="Elegir de la galería" className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border border-border bg-secondary"><ImageIcon size={20} className="text-primary" /></button>
            <button aria-label={mode === "VÍDEO" ? (cam.recording ? "Parar vídeo" : "Grabar vídeo") : "Hacer foto"} disabled={cam.state !== "live"} onClick={() => void shoot()} className="grid h-20 w-20 place-items-center rounded-full border-[5px] border-foreground disabled:opacity-50"><span className={mode === "VÍDEO" ? (cam.recording ? "h-8 w-8 rounded-md bg-live" : "h-14 w-14 rounded-full bg-live") : "h-14 w-14 rounded-full bg-foreground"} /></button>
            <Button variant="ghost" size="icon" aria-label="Girar cámara" onClick={() => setFront(!front)}><RefreshCw /></Button>
          </div>
        </div>)}

      {/* Tu voz */}
      {step === 2 && <div className="pt-2 text-center">
        {media && <div className="relative">{media.kind === "photo" ? <img src={media.url} alt="Tu foto" className="mx-auto aspect-[4/3] w-full rounded-2xl object-cover" /> : <video src={media.url} autoPlay muted loop playsInline aria-label="Tu vídeo" className="mx-auto aspect-[4/3] w-full rounded-2xl bg-black object-cover" />}<Button variant="secondary" onClick={() => setStep(1)} className="absolute bottom-3 right-3 h-8 rounded-md bg-background/70 px-2 text-xs">Cambiar</Button></div>}
        <h3 className="mt-6 text-xl font-bold">Cuéntalo con tu voz</h3>
        {gateMic ? <div className="mt-4 text-left">{gateMic}</div> : <>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">{clip ? (pb.active ? `${formatClock(pb.positionMs)} / ${formatClock(clip.durationMs)}` : formatClock(clip.durationMs)) : `${formatClock(rec.elapsedMs)} / ${formatClock(commerce.voiceMaxSeconds * 1000)}`}</p>
          <div className="mt-5 flex items-center gap-2">
            {clip ? <VoiceWave peaks={clip.peaks.slice(0, Math.ceil(clip.peaks.length / 2))} progress={pb.active ? Math.min(1, (pb.positionMs / clip.durationMs) * 2) : 0} className="h-12 flex-1" /> : liveSide(true)}
            <Button variant="ghost"
              onPointerDown={(e) => { if (clip) return; if (e.pointerType !== "mouse" || e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); void rec.start(); } }}
              onPointerUp={() => { if (!clip && (recording || rec.state === "requesting")) rec.stop(); }}
              onPointerCancel={() => { if (!clip && recording) rec.stop(); }}
              onClick={() => { if (clip) toggleVoice(previewId, clip.url, clip.durationMs); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat && !clip) { e.preventDefault(); if (recording) rec.stop(); else void rec.start(); } }}
              className={(recording ? "spot-pulse " : "") + "grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-primary/60 bg-spot-gradient p-0 text-foreground shadow-glow touch-none"}
              aria-label={clip ? (pb.playing ? "Pausar tu audio" : "Escuchar tu audio") : recording ? "Suelta para terminar la grabación" : "Mantener pulsado para grabar audio"}>
              {rec.state === "requesting" ? <Loader2 size={34} className="animate-spin" /> : clip ? (pb.playing ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" className="ml-1" />) : <Mic size={38} />}
            </Button>
            {clip ? <VoiceWave peaks={clip.peaks.slice(Math.floor(clip.peaks.length / 2))} progress={pb.active ? Math.max(0, (pb.positionMs / clip.durationMs) * 2 - 1) : 0} className="h-12 flex-1" onSeek={(r) => playVoice(previewId, clip.url, clip.durationMs, (0.5 + r / 2) * clip.durationMs)} /> : liveSide(false)}
          </div>
          <p className="mt-5 text-sm">{recording ? "Grabando… suelta para terminar" : clip ? "Escucha tu audio antes de seguir" : rec.state === "requesting" ? "Permite el micrófono…" : "Mantén pulsado para grabar"}</p>
          <p className="mt-1 text-2xs text-muted-foreground">Máximo {commerce.voiceMaxSeconds} s · menos de 1 s no se guarda.</p>
          {(rec.error === "denied" || rec.error === "unsupported" || rec.error === "failed" || !rec.supported) && !clip && <button type="button" onClick={() => audioFile.current?.click()} className="mx-auto mt-3 flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary"><FileAudio size={15} />Elegir un audio del dispositivo</button>}
          <input ref={audioFile} type="file" accept="audio/*" className="hidden" aria-label="Elegir un audio del dispositivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void rec.fromFile(f); e.target.value = ""; }} /></>}
        <div className="mt-8 flex items-center justify-around"><Button variant="secondary" size="icon" aria-label="Cancelar" onClick={() => { stopAllVoices(); rec.cancel(); setStep(media ? 1 : 0); }} className="h-12 w-12 rounded-full"><X size={20} /></Button><Button variant="secondary" size="icon" aria-label="Borrar audio" disabled={!clip && !recording} onClick={() => { stopAllVoices(); if (recording) rec.cancel(); else rec.discard(); }} className="h-12 w-12 rounded-full"><Trash2 size={20} /></Button><Button size="icon" aria-label="Usar este audio" disabled={!clip} onClick={() => { stopAllVoices(); setStep(3); }} className="h-14 w-14 rounded-full bg-spot-gradient shadow-glow disabled:opacity-40"><Check size={24} /></Button></div>
      </div>}

      {/* Revisar y publicar */}
      {step === 3 && clip && <>
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border">{media && (media.kind === "photo" ? <img src={media.url} alt="Vista previa del Spot" className="aspect-video w-full object-cover" /> : <video src={media.url} autoPlay muted loop playsInline aria-label="Vista previa del vídeo" className="aspect-video w-full bg-black object-cover" />)}
          <div className={media ? "absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-background/90 p-2 backdrop-blur" : "flex items-center gap-2 rounded-xl bg-card p-3"}><Button variant="icon" size="icon" aria-label={pb.playing ? "Pausar tu audio" : "Escuchar tu audio"} onClick={() => toggleVoice(previewId, clip.url, clip.durationMs)}>{pb.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</Button><VoiceWave peaks={clip.peaks} progress={pb.active ? pb.positionMs / clip.durationMs : 0} playhead={pb.active} className="flex-1" onSeek={(r) => playVoice(previewId, clip.url, clip.durationMs, r * clip.durationMs)} /><span className="text-xs tabular-nums text-muted-foreground">{formatClock(clip.durationMs)}</span></div></div>

        <label className="mt-5 block text-left">
          <span className="flex items-center gap-2 text-sm font-bold"><Type size={16} className="text-primary" />Título <span className="ml-auto text-2xs font-normal text-muted-foreground">{title.length}/{TITLE_MAX}</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))} maxLength={TITLE_MAX} enterKeyHint="done" placeholder="Ej.: Concierto sorpresa en la Alameda" aria-describedby="titulo-ayuda"
            className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary" />
          <small id="titulo-ayuda" className="mt-1 block text-2xs text-muted-foreground">Es lo único escrito: lo demás lo cuentas con tu voz.</small>
        </label>

        <div className="mt-5"><SignAs anon={anon} onChange={setAnon} /></div>
        <h3 className="mt-6 text-base font-bold">Haz que encuentren tu voz</h3>
        <div className="mt-3 space-y-2">
          {([[Headphones, "Tema", "topic"], [MapPin, "Zona", "zona"], [Shield, "Precisión de la ubicación", "precision"], [Users, "Quién puede escucharte", "vis"]] as const).map(([I, a, k]) =>
            <Button key={a} variant="secondary" onClick={() => setPick(k)} disabled={k === "precision" && hidden} className="flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left"><I className="shrink-0 text-primary" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">{a}</strong><small className="block truncate font-normal text-muted-foreground">{k === "zona" ? zoneLabel : k === "precision" && hidden ? "Sin ubicación" : opts[k][sel[k]]}</small></span><span className="text-muted-foreground">›</span></Button>)}
        </div>
        <h3 className="mt-6 text-base font-bold">Conversación</h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"><MessageCircle className="shrink-0 text-primary" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">Respuestas de voz</strong><small className="block text-muted-foreground">{replies ? "Permitir que te respondan hablando" : "No recibir respuestas a este Spot"}</small></span><Toggle on={replies} onChange={setReplies} label="Respuestas de voz" /></div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"><Flame className="shrink-0 text-live" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">Está pasando ahora</strong><small className="block text-muted-foreground">{live ? "Destacar en lo que sucede ahora" : "Publicar sin marcar como acontecimiento actual"}</small></span><Toggle on={live} onChange={setLive} label="Está pasando ahora" /></div>
        </div>
        <h3 className="mt-6 text-base font-bold">Privacidad y alcance <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3>
        <div className="mt-3 space-y-2">
          <Button variant="secondary" onClick={() => setIncogOpen(true)} className="flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left"><Ghost className="shrink-0 text-accent" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">Modo Incógnito</strong><small className="block font-normal text-muted-foreground">{incognito.active ? "Activo: publicarás como Incógnito verificado" : "Oculta tu identidad pública. Spotly te sigue verificando"}</small></span><span className="text-muted-foreground">›</span></Button>
          <Button variant="secondary" onClick={() => setBoostOpen(true)} className="flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left"><Rocket className="shrink-0 text-premium" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">Impulsar Spot</strong><small className="block font-normal text-muted-foreground">{boosted ? "Impulso añadido" : "Más distribución. Prioridad, no visitas garantizadas"}</small></span><span className="text-muted-foreground">›</span></Button>
          <Button variant="secondary" onClick={() => app.open("promo-perfil")} className="flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left"><Users className="shrink-0 text-primary" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">Promocionar perfil</strong><small className="block font-normal text-muted-foreground">Compra exposición, no seguidores</small></span><span className="text-muted-foreground">›</span></Button>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/60 p-3 text-sm"><span>Coste de publicar</span><strong className="text-primary">Gratis</strong></div>
        {boosted && <p className="mt-1 text-2xs text-muted-foreground">Impulso ya pagado con tu saldo o método de pago. Saldo actual: 💎 {credits.toLocaleString("es-ES")} · listo para usar.</p>}
        {gatePub && <div className="mt-4">{gatePub}</div>}
        <Button className="mt-4 w-full bg-spot-gradient text-foreground" disabled={!!gatePub || publishing || !titleOk} onClick={() => void publish()}>{publishing ? <><Loader2 size={16} className="animate-spin" />Publicando…</> : titleOk ? "PUBLICAR SPOT" : "Ponle un título para publicar"}</Button>
        <p className="mt-2 text-center text-2xs text-muted-foreground">Publicar, ser descubierto y hacerte viral es gratis.</p>
      </>}

      {pick && pick !== "zona" && <BottomSheet title={titles[pick]} onClose={() => setPick(null)} z={60}><div className="space-y-1">
        {opts[pick].map((o, i) => <Button key={o} variant="ghost" onClick={() => { setSel({ ...sel, [pick]: i }); setPick(null); }} className="flex h-auto w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-foreground">{o}{sel[pick] === i && <Check size={16} className="text-primary" />}</Button>)}</div></BottomSheet>}
      {pick === "zona" && <BottomSheet title="Zona del Spot" onClose={() => setPick(null)} z={60}>
        <Button variant="secondary" onClick={() => { setHidden(true); setPick(null); }} className="mb-3 flex h-auto w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm">Ubicación oculta (no sale en el mapa){hidden && <Check size={16} className="text-primary" />}</Button>
        <PlaceBrowser allowProvince={false} selected={hidden ? undefined : city} onPick={(n) => { setCity(n); setHidden(false); saveMyCity(n); setPick(null); }} />
      </BottomSheet>}
      {incogOpen && <IncognitoSheet onClose={() => setIncogOpen(false)} />}
    </main></div>;
}
