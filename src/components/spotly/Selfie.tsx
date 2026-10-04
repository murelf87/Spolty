import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, ScanFace, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LIVE, grabFrame, loadLiveness, readFace } from "@/lib/liveness";

const STEPS = [
  { title: "Mira al frente y parpadea", sub: "Mantén la cara centrada y parpadea una vez." },
  { title: "Gira la cabeza hacia un lado", sub: "Despacio, hasta que se complete." },
  { title: "Ahora hacia el otro lado", sub: "Gira hacia el lado contrario." },
] as const;

type Cam = "starting" | "live" | "denied" | "none" | "insecure" | "error";
type Engine = "loading" | "ready" | "failed";

/**
 * Selfie en tiempo real con cámara real y detección en el dispositivo.
 * onDone(primerFotograma, manual): manual=true si no hubo detección automática (irá a revisión manual).
 */
export function SelfieStep({ onDone }: { onDone: (frame: string | null, manual: boolean) => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const frames = useRef<string[]>([]);
  const [cam, setCam] = useState<Cam>("starting");
  const [engine, setEngine] = useState<Engine>("loading");
  const [step, setStep] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [hint, setHint] = useState("Preparando la cámara…");
  const [ok, setOk] = useState(false); // la cara está bien encuadrada
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(false);
  const done = useRef(false);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; }, []);

  /* 1 · Cámara real */
  useEffect(() => {
    let dead = false;
    setCam("starting"); setStale(false);
    (async () => {
      if (!window.isSecureContext) { setCam("insecure"); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setCam("none"); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const v = video.current;
        if (v) { v.srcObject = s; await v.play().catch(() => undefined); }
        setCam("live"); setHint("Coloca tu cara dentro del óvalo");
      } catch (e) {
        if (dead) return;
        const n = (e as DOMException)?.name;
        setCam(n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" || n === "OverconstrainedError" ? "none" : "error");
      }
    })();
    return () => { dead = true; stop(); };
  }, [attempt, stop]);

  /* 2 · Motor de detección (local) */
  useEffect(() => {
    let dead = false;
    setEngine("loading");
    loadLiveness().then(() => { if (!dead) setEngine("ready"); }).catch(() => { if (!dead) setEngine("failed"); });
    return () => { dead = true; };
  }, [attempt]);

  useEffect(() => () => { frames.current.forEach((u) => { if (u !== frames.current[0]) URL.revokeObjectURL(u); }); }, []);

  /* 3 · Bucle de reto-respuesta */
  useEffect(() => {
    if (cam !== "live" || engine !== "ready") return undefined;
    let dead = false;
    let timer = 0;
    const ears: number[] = [];
    let cur = 0, hold = 0, closed = false, blinked = false, firstTurn: "a" | "b" | null = null;
    let started = Date.now();
    const loop = async () => {
      const v = video.current;
      if (dead || !v || done.current) return;
      try {
        if (v.readyState >= 2) {
          const r = await readFace(v);
          if (dead) return;
          if (r.kind === "none") { setOk(false); setHint("No veo tu cara. Mira a la cámara."); hold = 0; }
          else if (r.kind === "many") { setOk(false); setHint("Solo debe aparecer una persona."); hold = 0; }
          else if (r.size < LIVE.minSize) { setOk(false); setHint("Acércate un poco más."); hold = 0; }
          else if (Math.abs(r.cx) > LIVE.maxOffset || Math.abs(r.cy) > LIVE.maxOffset) { setOk(false); setHint("Centra tu cara en el óvalo."); hold = 0; }
          else {
            setOk(true);
            const side: "a" | "b" | null = r.yaw < LIVE.turn ? "a" : r.yaw > 1 - LIVE.turn ? "b" : null;
            let pass = false;
            if (cur === 0) {
              const frontal = r.yaw > LIVE.frontal[0] && r.yaw < LIVE.frontal[1];
              setHint(frontal ? "Parpadea ahora" : "Mira de frente");
              if (frontal) {
                // Línea base = percentil 80 de los últimos fotogramas (ojo abierto); robusta al ruido.
                ears.push(r.ear); if (ears.length > 24) ears.shift();
                if (ears.length >= 8) {
                  const base = [...ears].sort((a, b) => a - b)[Math.floor(ears.length * 0.8)]!;
                  if (r.ear < base * LIVE.blinkDrop) closed = true;
                  else if (closed && r.ear > base * LIVE.blinkRecover) blinked = true;
                }
                pass = blinked;
              }
            } else if (cur === 1) {
              setHint(side ? "Mantén la posición" : "Gira la cabeza despacio");
              if (side) { hold++; if (hold >= LIVE.hold) { pass = true; firstTurn = side; } } else hold = 0;
            } else {
              const other = side && side !== firstTurn;
              setHint(other ? "Mantén la posición" : side ? "Hacia el lado contrario" : "Gira hacia el otro lado");
              if (other) { hold++; if (hold >= LIVE.hold) pass = true; } else hold = 0;
            }
            if (pass) {
              const url = await grabFrame(v);
              if (url) { frames.current.push(url); setThumbs([...frames.current]); }
              cur++; hold = 0; started = Date.now(); setStep(cur); setStale(false);
              if (cur >= STEPS.length) {
                done.current = true; setHint("¡Selfie completado!");
                window.setTimeout(() => { stop(); onDone(frames.current[0] ?? null, false); }, 900);
                return;
              }
            }
          }
          if (Date.now() - started > LIVE.stepTimeoutMs) setStale(true);
        }
      } catch { /* un fotograma fallido no detiene el bucle */ }
      timer = window.setTimeout(loop, 40);
    };
    loop();
    return () => { dead = true; window.clearTimeout(timer); };
  }, [cam, engine, attempt, onDone, stop]);

  /* Alternativa manual: foto con la cámara del sistema (revisión manual posterior). */
  const onFile = (f?: File) => {
    if (!f || !/^image\//.test(f.type)) return;
    done.current = true; stop();
    onDone(URL.createObjectURL(f), true);
  };

  const retry = () => { frames.current = []; setThumbs([]); setStep(0); done.current = false; setAttempt((a) => a + 1); };
  const blocked = cam === "denied" || cam === "none" || cam === "insecure" || cam === "error";
  const msg: Record<Exclude<Cam, "starting" | "live">, [string, string]> = {
    denied: ["Permiso de cámara denegado", "Permite la cámara para este sitio en los ajustes del navegador o del sistema y pulsa «Reintentar». Las vistas previas incrustadas pueden bloquearla; en la app instalada o abriendo la web directamente funciona."],
    none: ["No encontramos ninguna cámara", "Conecta una cámara o usa tu móvil. También puedes hacerte una foto con la cámara del sistema."],
    insecure: ["La cámara requiere conexión segura", "Abre Spotly desde una dirección https:// o desde la app instalada."],
    error: ["No se pudo abrir la cámara", "Puede que otra aplicación la esté usando. Ciérrala e inténtalo de nuevo."],
  };

  return (
    <>
      <h1 className="mt-1 text-center text-[1.3125rem] font-bold">Haz un selfie en tiempo real</h1>
      <p className="mb-3 mt-1 text-center text-[0.8125rem] text-muted-foreground">Mira a la cámara y sigue las instrucciones.</p>

      <div className={`relative mx-auto mt-1 h-[18.75rem] w-[14.375rem] rounded-[50%] p-[0.1875rem] transition-shadow ${ok ? "bg-gradient-to-b from-emerald-400 to-[var(--spot-blue)] shadow-[0_0_28px_#22e28a]" : "bg-gradient-to-b from-[var(--spot-blue)] via-[var(--spot-fuchsia)] to-[var(--spot-blue)] shadow-[0_0_28px_var(--spot-fuchsia)]"}`}>
        <div className="relative h-full w-full overflow-hidden rounded-[50%] bg-card">
          <video ref={video} playsInline muted autoPlay aria-label="Vista de tu cámara" className={"absolute inset-0 h-full w-full -scale-x-100 object-cover " + (cam === "live" ? "" : "invisible")} />
          {cam !== "live" && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-muted-foreground">
              {cam === "starting" ? <Loader2 className="animate-spin" size={30} /> : <ScanFace size={44} />}
            </div>
          )}
          {cam === "live" && ok && <span className="spot-scan pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />}
        </div>
        <span className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-2xs font-semibold backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${cam === "live" ? "animate-pulse bg-emerald-400" : "bg-muted-foreground"}`} />{cam === "live" ? "En vivo" : cam === "starting" ? "Abriendo…" : "Cámara apagada"}
        </span>
      </div>

      {blocked ? (
        <div className="mx-auto mt-5 max-w-[20rem] text-center" role="alert">
          <ShieldAlert className="mx-auto text-live" size={26} />
          <h2 className="mt-2 text-[1rem] font-semibold">{msg[cam][0]}</h2>
          <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">{msg[cam][1]}</p>
          <Button className="mt-4 w-full rounded-full bg-spot-gradient text-white" onClick={retry}><RefreshCw size={16} />Reintentar</Button>
          <Button variant="outline" className="mt-2 w-full rounded-full" onClick={() => file.current?.click()}><Upload size={16} />Hacerme una foto con la cámara del sistema</Button>
          <p className="mt-2 text-2xs text-muted-foreground">Sin detección automática, tu foto pasará a revisión manual.</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-center text-[1.0625rem] font-semibold" aria-live="polite">{step < STEPS.length ? STEPS[step]!.title : "¡Selfie completado!"}</p>
          <p className="min-h-[1.125rem] text-center text-[0.8125rem] text-muted-foreground" aria-live="polite">{engine === "loading" && cam === "live" ? "Preparando el detector facial…" : engine === "failed" ? "No se pudo cargar el detector." : hint}</p>
          <div className="mt-3 flex justify-center gap-4">{STEPS.map((s, i) => (
            <span key={s.title} aria-label={`${s.title}${i < step ? ", hecho" : ""}`} className={"relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl border-2 " + (i < step ? "border-emerald-400" : i === step ? "border-primary shadow-glow" : "border-border")}>
              {thumbs[i] ? <img src={thumbs[i]} alt="" className="h-full w-full object-cover" /> : <Camera size={22} className="text-muted-foreground" />}
              {i < step && <span className="absolute inset-0 grid place-items-center bg-emerald-500/50 text-white"><Check size={20} /></span>}
            </span>))}
          </div>
          {(engine === "failed" || stale) && (
            <div className="mx-auto mt-4 max-w-[20rem] text-center">
              <p className="text-[0.75rem] text-muted-foreground">{engine === "failed" ? "Tu dispositivo no pudo ejecutar la detección." : "¿Te cuesta? Mejora la luz, quítate gafas de sol o gorra y acércate."}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={retry}><RefreshCw size={15} />Reintentar</Button>
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => { const v = video.current; if (!v) return; void grabFrame(v).then((u) => { done.current = true; stop(); onDone(u, true); }); }}>Enviar a revisión</Button>
              </div>
            </div>
          )}
        </>
      )}
      <input ref={file} type="file" accept="image/*" capture="user" className="hidden" aria-label="Hacer foto con la cámara del sistema" onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="mt-3 pb-2 text-center text-3xs text-muted-foreground">El análisis se hace en tu dispositivo: el vídeo no se graba ni se envía. En producción, la prueba de vida la valida además un proveedor KYC.</p>
    </>
  );
}
