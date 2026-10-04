import { useEffect, useRef, useState } from "react";
import { Camera, Check, Flame, Ghost, Headphones, ImageIcon, MapPin, MessageCircle, Mic, Music, Pause, Play, Radio, RefreshCw, Rocket, Shield, Trash2, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle, Trust, TopBar, BottomSheet } from "./kit";
import { Wave, type MineSpot } from "./Feed";
import { BoostFlow } from "./BoostFlow";
import { IncognitoSheet } from "./Incognito";
import { LiveBroadcast } from "./LiveBroadcast";
import { useApp } from "./app-context";
import { useGate } from "./Voice";
import { useStore, useMe } from "@/lib/store";
import { commerce, locationPrecision } from "@/lib/spotlyConfig";
import valenciaSunset from "@/assets/spotly-sevilla-noche-ref.jpg";
import sevilleNight from "@/assets/seville-night.jpg";
import { SignAs } from "./Author";

const opts = {
  loc: ["Sevilla · Triana", "Sevilla · Alameda", "Sevilla · Centro", "Ubicación oculta"],
  vis: ["Todos (público)", "Solo cerca (1 km)", "Solo seguidores"],
  topic: ["¿Qué está pasando?", "Planes", "Música", "Comida", "Opiniones", "Algo que contar"],
  precision: locationPrecision.map((p) => p.label),
};
const titles = { loc: "Zona", vis: "Quién puede escucharte", topic: "Tema", precision: "Precisión de la ubicación" } as const;
type Key = keyof typeof opts;
const fmtSecs = (s: number) => `0:${String(s).padStart(2, "0")}`;

export function CreateSpot({ onClose, onPublished }: { onClose: () => void; onPublished: (m: NonNullable<MineSpot>) => void }) {
  const app = useApp();
  const { incognito, credits } = useStore();
  const me = useMe();
  /* Firma del Spot: tu nombre, o «Anónimo» con fantasma si tienes Incógnito (de pago) activo. */
  const [anon, setAnon] = useState(incognito.active);
  useEffect(() => { if (incognito.active) setAnon(true); }, [incognito.active]);
  const [broadcast, setBroadcast] = useState(false);
  const [step, setStep] = useState(0);
  const [hasMedia, setHasMedia] = useState(false);
  const [mode, setMode] = useState<"FOTO" | "VÍDEO">("FOTO");
  const [front, setFront] = useState(false);
  const [flash, setFlash] = useState(false);
  const [zoom, setZoom] = useState("1x");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [secs, setSecs] = useState(0);
  const [prev, setPrev] = useState(false);
  const [live, setLive] = useState(true);
  const [replies, setReplies] = useState(true);
  const [sel, setSel] = useState<Record<Key, number>>({ loc: 0, vis: 0, topic: 0, precision: 1 });
  const [pick, setPick] = useState<null | Key>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [incogOpen, setIncogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gateCam = useGate({ camera: true });
  const gateMic = useGate({ mic: true });
  const gatePub = useGate({ verified: true, online: true });
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startRec = () => {
    if (recording) return;
    setSecs(0); setRecorded(false); setRecording(true);
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= commerce.voiceMaxSeconds) { stopRec(); return commerce.voiceMaxSeconds; } return s + 1; }), 1000);
  };
  const stopRec = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setRecording(false); setRecorded(true); };
  const next = () => setStep((s) => Math.min(s + 1, 3));
  const publish = () => {
    if (gatePub) return;
    setPublishing(true);
    window.setTimeout(() => { setPublishing(false); setPublished(true); }, 700);
  };
  const finish = () => { onPublished({ boosted, incognito: anon, text: "Atardecer en la Malvarrosa 🌅", visibility: opts.vis[sel.vis]! }); onClose(); };

  if (broadcast) return <LiveBroadcast onClose={onClose} />;

  if (published) {
    const list = [
      anon ? "Publicado como «Anónimo» 👻 · Incógnito verificado" : `Publicado con tu nombre: ${me.name}`,
      sel.vis === 0 ? "En el feed Para todos y en Cerca de ti" : sel.vis === 1 ? "Solo para quien esté a menos de 1 km" : "Solo para tus seguidores",
      "En " + opts.loc[sel.loc],
      sel.precision === 2 ? "Sin ubicación en el mapa" : `En el mapa (${opts.precision[sel.precision]!.toLowerCase()})`,
      boosted ? "Impulsado: más distribución, sin visitas garantizadas" : "Publicar es gratis. Puedes impulsarlo más tarde",
      "Puede llegar a ser un Hot Spot si otras personas lo confirman",
    ];
    return <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background px-6 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[max(5rem,calc(env(safe-area-inset-top)+2rem))] text-center">
      <div className="mx-auto grid h-24 w-24 shrink-0 place-items-center rounded-full bg-spot-gradient shadow-glow"><Check size={46} /></div>
      <h2 className="mt-7 text-3xl font-bold">¡Publicado!</h2><p className="mt-2 text-sm text-muted-foreground">Tu Spot ya está en Spotly</p>
      <div className="mx-auto mt-8 w-full max-w-sm space-y-3 text-left text-sm">{list.map((x) => <p key={x} className="flex items-center gap-3"><Check size={16} className="shrink-0 text-primary" />{x}</p>)}</div>
      <div className="mt-auto pt-8"><Button className="w-full bg-spot-gradient text-foreground" onClick={finish}>Ver mi Spot</Button>
        {!boosted && <Button variant="secondary" className="mt-2 w-full" onClick={() => { finish(); app.open("impulso"); }}><Rocket size={16} />Impulsarlo ahora</Button>}
        <Button variant="ghost" className="mt-2 w-full" onClick={finish}>Seguir explorando</Button></div>
    </div>;
  }

  if (boostOpen) return <BoostFlow preview={hasMedia ? valenciaSunset : undefined} onBack={() => setBoostOpen(false)} onDone={(b) => { setBoostOpen(false); if (b) { setBoosted(true); toast.success("Impulso añadido a tu Spot"); publish(); } else publish(); }} />;

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
    <TopBar title={step === 3 ? "Tu Spot está listo" : ""} onBack={step === 0 ? onClose : () => setStep((s) => s - 1)} close={step === 0} sticky border={false} />
    <main className="mx-auto max-w-md p-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      {step === 0 && <>
        {/* Story-style top strip */}
        <div className="-mx-5 -mt-5 flex gap-3 overflow-x-auto px-5 pt-4 pb-5 scrollbar-none" style={{scrollbarWidth:"none"}}>
          {(["📸 Foto", "🎙️ Voz", "📹 Vídeo", "🔴 Directo", "👻 Incógnito"] as const).map((s) => (
            <button key={s} onClick={() => {
              if (s === "📸 Foto") { setHasMedia(true); setStep(1); }
              else if (s === "🎙️ Voz") { setHasMedia(false); setStep(2); }
              else if (s === "📹 Vídeo") { setHasMedia(true); setMode("VÍDEO"); setStep(1); }
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
          {/* Foto — full width */}
          <button onClick={() => { setHasMedia(true); setStep(1); }} className="col-span-2 relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--spot-blue)] to-[var(--spot-fuchsia)] text-foreground"><Camera size={26} /></span>
              <div>
                <strong className="block text-base">Cámara</strong>
                <small className="text-muted-foreground">Haz una foto o graba un vídeo</small>
              </div>
            </div>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">›</span>
          </button>

          {/* Voz — highlight tile */}
          <button onClick={() => { setHasMedia(false); setStep(2); }} className="relative overflow-hidden rounded-2xl bg-spot-gradient p-5 text-left shadow-glow">
            <Mic size={30} className="mb-3" />
            <strong className="block text-sm">Solo voz</strong>
            <small className="block text-2xs font-normal opacity-80">Tu historia, tu voz</small>
          </button>

          {/* Galería */}
          <button onClick={() => { setHasMedia(true); setStep(2); }} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left">
            <ImageIcon size={30} className="mb-3 text-primary" />
            <strong className="block text-sm">Galería</strong>
            <small className="block text-2xs font-normal text-muted-foreground">Elige de tu móvil</small>
          </button>

          {/* Directo */}
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

        {/* Extras row */}
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

      {step === 1 && (gateCam
        ? <div className="mt-6 space-y-3">{gateCam}<Button variant="secondary" className="w-full" onClick={() => { setHasMedia(true); setStep(2); }}><ImageIcon size={16} />Usar una foto de la galería</Button><Button variant="ghost" className="w-full" onClick={() => { setHasMedia(false); setStep(2); }}>Publicar solo con voz</Button></div>
        : <div className="-mx-5 flex min-h-[calc(100vh_-_4.5rem_-_var(--safe-header)_-_max(1.25rem,calc(env(safe-area-inset-bottom)_+_0.75rem)))] flex-col bg-background">
          <div className="relative mx-3 mt-2 flex-1 overflow-hidden rounded-3xl"><img src={valenciaSunset} alt="Vista de cámara" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">{([[X, "Cerrar cámara", () => setStep(0)], [Zap, "Flash", () => setFlash(!flash)], [Music, "Añadir música", () => toast("Música de ejemplo añadida")], [RefreshCw, "Cambiar cámara", () => setFront(!front)]] as const).map(([I, l, f], i) => <button key={i} aria-label={l} onClick={f} className={"grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur " + (i === 1 && flash ? "text-premium" : "")}><I size={18} /></button>)}</div>
            {front && <span className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-background/60 px-3 py-1 text-xs">Cámara frontal</span>}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{["0,5", "1x", "2"].map((z) => <button key={z} onClick={() => setZoom(z)} className={"grid h-8 w-8 place-items-center rounded-full text-2xs font-semibold backdrop-blur " + (zoom === z ? "bg-foreground/90 text-background" : "bg-background/50")}>{z}</button>)}</div></div>
          <div className="mt-3 flex justify-center"><div className="flex rounded-full bg-secondary p-1 text-2xs font-semibold">{(["VÍDEO", "FOTO"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={"rounded-full px-3 py-1 " + (mode === m ? "bg-foreground text-background" : "text-muted-foreground")}>{m}</button>)}</div></div>
          <div className="flex h-28 items-center justify-around"><button onClick={() => { setHasMedia(true); next(); }} aria-label="Elegir de la galería" className="h-12 w-12 overflow-hidden rounded-lg border border-border"><img src={sevilleNight} alt="Galería" className="h-full w-full object-cover" /></button>
            <button aria-label={mode === "VÍDEO" ? "Grabar vídeo" : "Hacer foto"} onClick={() => { setHasMedia(true); next(); }} className="grid h-20 w-20 place-items-center rounded-full border-[5px] border-foreground"><span className={mode === "VÍDEO" ? "h-14 w-14 rounded-full bg-live" : "h-14 w-14 rounded-full bg-foreground"} /></button>
            <Button variant="ghost" size="icon" aria-label="Girar cámara" onClick={() => setFront(!front)}><RefreshCw /></Button></div></div>)}

      {step === 2 && <div className="pt-2 text-center">
        {hasMedia && <div className="relative"><img src={valenciaSunset} alt="Contenido del Spot" className="mx-auto aspect-[4/3] w-full rounded-2xl object-cover" /><Button variant="secondary" onClick={() => setStep(1)} className="absolute bottom-3 right-3 h-8 rounded-md bg-background/70 px-2 text-xs">Editar</Button></div>}
        <h3 className="mt-6 text-xl font-bold">Cuéntalo con tu voz</h3>
        {gateMic ? <div className="mt-4 text-left">{gateMic}</div> : <>
          <p className="mt-1 text-sm text-muted-foreground">{fmtSecs(secs)} / {fmtSecs(commerce.voiceMaxSeconds)}</p>
          <div className="mt-5 flex items-center gap-2"><Wave active={recording} />
            <Button variant="ghost" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startRec(); }} onPointerUp={() => recording && stopRec()} onPointerCancel={() => recording && stopRec()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startRec(); } }} onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (recording) stopRec(); } }} className={(recording ? "spot-pulse " : "") + "grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-primary/60 bg-spot-gradient p-0 text-foreground shadow-glow touch-none"} aria-label="Mantener pulsado para grabar audio"><Mic size={38} /></Button><Wave active={recording} /></div>
          <p className="mt-5 text-sm">{recording ? "Grabando… suelta para terminar" : recorded ? "Audio grabado" : "Mantén pulsado para grabar"}</p>
          <p className="mt-1 text-2xs text-muted-foreground">Máximo {commerce.voiceMaxSeconds} s. Ahora mismo es una grabación de demostración: aún no se sube audio real.</p></>}
        <div className="mt-8 flex items-center justify-around"><Button variant="secondary" size="icon" aria-label="Cancelar" onClick={() => setStep(hasMedia ? 1 : 0)} className="h-12 w-12 rounded-full"><X size={20} /></Button><Button variant="secondary" size="icon" aria-label="Borrar audio" onClick={() => { if (timer.current) clearInterval(timer.current); setRecording(false); setRecorded(false); setSecs(0); }} className="h-12 w-12 rounded-full"><Trash2 size={20} /></Button><Button size="icon" aria-label="Usar este audio" disabled={!recorded} onClick={next} className="h-14 w-14 rounded-full bg-spot-gradient shadow-glow disabled:opacity-40"><Check size={24} /></Button></div>
      </div>}

      {step === 3 && <>
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border">{hasMedia && <img src={valenciaSunset} alt="Vista previa del Spot" className="aspect-video w-full object-cover" />}
          <div className={hasMedia ? "absolute inset-x-3 bottom-3 flex items-center rounded-xl bg-background/90 p-2 backdrop-blur" : "flex items-center rounded-xl bg-card p-3"}><Button variant="icon" size="icon" aria-label="Reproducir audio de ejemplo" onClick={() => setPrev(!prev)}>{prev ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</Button><Wave active={prev} /><span className="text-xs text-muted-foreground">{fmtSecs(secs || 12)}</span></div></div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Vista de ejemplo · todavía no se graba ni guarda audio real.</p>
        <div className="mt-5"><SignAs anon={anon} onChange={setAnon} /></div>
        <h3 className="mt-6 text-base font-bold">Haz que encuentren tu voz</h3>
        <div className="mt-3 space-y-2">{([[Headphones, "Tema", "topic"], [MapPin, "Zona", "loc"], [Shield, "Precisión de la ubicación", "precision"], [Users, "Quién puede escucharte", "vis"]] as const).map(([I, a, k]) =>
          <Button key={a} variant="secondary" onClick={() => setPick(k)} className="flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left"><I className="shrink-0 text-primary" size={19} /><span className="min-w-0 flex-1"><strong className="block text-sm">{a}</strong><small className="block font-normal text-muted-foreground">{opts[k][sel[k]]}</small></span><span className="text-muted-foreground">›</span></Button>)}</div>
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
        <Button className="mt-4 w-full bg-spot-gradient text-foreground" disabled={!!gatePub || publishing} onClick={publish}>{publishing ? "Publicando…" : "PUBLICAR SPOT"}</Button>
        <p className="mt-2 text-center text-2xs text-muted-foreground">Publicar, ser descubierto y hacerte viral es gratis.</p>
      </>}

      {pick && <BottomSheet title={titles[pick]} onClose={() => setPick(null)} z={60}><div className="space-y-1">
        {opts[pick].map((o, i) => <Button key={o} variant="ghost" onClick={() => { setSel({ ...sel, [pick]: i }); setPick(null); }} className="flex h-auto w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-foreground">{o}{sel[pick] === i && <Check size={16} className="text-primary" />}</Button>)}</div></BottomSheet>}
      {incogOpen && <IncognitoSheet onClose={() => setIncogOpen(false)} />}
    </main></div>;
}
