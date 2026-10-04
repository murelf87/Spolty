import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Check, MapPin, Mic, MicOff, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, StateCard, Waveform } from "./kit";
import { useApp } from "./app-context";
import { setPerm, useMe, useStore } from "@/lib/store";
import { SignAs } from "./Author";
import { commerce } from "@/lib/spotlyConfig";

/**
 * Puerta común para cualquier acción que exige cuenta verificada, micrófono,
 * cámara, ubicación o conexión. Devuelve `null` si se puede continuar, o el
 * estado a mostrar. Así ninguna pantalla “finge” que funciona sin permisos.
 */
export function useGate(need: { verified?: boolean; mic?: boolean; camera?: boolean; location?: boolean; online?: boolean }) {
  const { identity, perms, offline } = useStore();
  const app = useApp();
  if (need.verified && identity !== "approved") {
    const pending = identity === "pending" || identity === "review";
    return <StateCard icon={pending ? ShieldAlert : BadgeCheck} tone={pending ? "premium" : "primary"} title={pending ? "Verificación en curso" : "Verifica tu identidad"} text={pending ? "Estamos revisando tu identidad. Mientras tanto puedes escuchar y explorar, pero no publicar ni responder." : "En Spotly todas las cuentas son de personas verificadas. Completa la verificación para publicar y responder."} action={pending ? "Ver estado" : "Verificarme"} onAction={() => app.open("verificacion")} />;
  }
  if (need.online && offline) return <StateCard icon={WifiOff} tone="muted" title="Sin conexión" text="No podemos enviar esto ahora. Recupera la conexión e inténtalo de nuevo." action="Reintentar" onAction={() => toast.error("Sigues sin conexión")} />;
  if (need.mic && !perms.mic) return <StateCard icon={MicOff} tone="live" title="Micrófono denegado" text="Spotly funciona con tu voz. Permite el micrófono para grabar." action="Permitir micrófono" onAction={() => { setPerm("mic", true); toast.success("Micrófono permitido"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  if (need.camera && !perms.camera) return <StateCard icon={Camera} tone="live" title="Cámara denegada" text="Necesitamos la cámara para esta acción. Puedes usar la galería o permitir la cámara." action="Permitir cámara" onAction={() => { setPerm("camera", true); toast.success("Cámara permitida"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  if (need.location && !perms.location) return <StateCard icon={MapPin} tone="live" title="Ubicación desactivada" text="Sin ubicación no podemos mostrarte lo que pasa cerca ni fijar la zona del Spot." action="Activar ubicación" onAction={() => { setPerm("location", true); toast.success("Ubicación activada"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  return null;
}

/** Respuesta de voz (hoja inferior) con todos sus estados. Firma con tu nombre, o «Anónimo» con Incógnito de pago. */
export function VoiceReply({ name, onClose, onSent }: { name: string; onClose: () => void; onSent?: (r: { anon: boolean; dur: string }) => void }) {
  const me = useMe();
  const { incognito } = useStore();
  const [anon, setAnon] = useState(incognito.active);
  const [rec, setRec] = useState(false);
  const [sent, setSent] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gate = useGate({ verified: true, mic: true, online: true });
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const toggle = () => {
    if (rec) { if (timer.current) clearInterval(timer.current); setRec(false); return; }
    setSecs(0); setRec(true);
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= commerce.voiceMaxSeconds) { if (timer.current) clearInterval(timer.current); setRec(false); return commerce.voiceMaxSeconds; } return s + 1; }), 1000);
  };
  const t = `0:${String(secs).padStart(2, "0")}`;
  return (
    <BottomSheet title={gate || sent ? undefined : `Responder a ${name}`} onClose={onClose} z={70}>
      {gate ?? (sent ? (
        <div className="py-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient"><Check size={30} /></div><h3 className="mt-4 text-lg font-bold">Respuesta enviada</h3><p className="text-sm text-muted-foreground">{anon ? "Ha salido como «Anónimo» 👻." : `Ha salido con tu nombre: ${me.name}.`} {name === "este Spot" ? "Ya aparece en los comentarios." : `${name} escuchará tu voz.`}</p><Button className="mt-5 w-full" onClick={onClose}>Listo</Button></div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{rec ? "Grabando… pulsa para parar" : secs ? "Audio listo para enviar" : "Pulsa y habla"}</p>
          <div className="mx-auto my-4 flex h-10 max-w-xs"><Waveform active={rec} bars={36} /></div>
          <button onClick={toggle} className={(rec ? "spot-pulse " : "") + "mx-auto grid h-20 w-20 place-items-center rounded-full bg-spot-gradient shadow-glow"} aria-label={rec ? "Detener grabación" : "Grabar respuesta"}><Mic size={32} /></button>
          <p className="mt-3 font-semibold">{t} / 0:{commerce.voiceMaxSeconds}</p>
          <div className="mt-4"><SignAs anon={anon} onChange={setAnon} label="Se enviará como" /></div>
          <Button className="mt-3 w-full" disabled={rec || secs === 0} onClick={() => { setSent(true); onSent?.({ anon, dur: t }); }}>Enviar respuesta de voz</Button>
        </div>
      ))}
    </BottomSheet>
  );
}

/** Grabadora mínima (temporizador) para mensajes de voz de negocios y formularios. */
export function useRecorder(max = commerce.voiceMaxSeconds) {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const stop = () => { if (timer.current) clearInterval(timer.current); setRec(false); };
  const toggle = () => {
    if (rec) return stop();
    setSecs(0); setRec(true);
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= max) { stop(); return max; } return s + 1; }), 1000);
  };
  const reset = () => { stop(); setSecs(0); };
  return { rec, secs, toggle, reset, label: `0:${String(secs).padStart(2, "0")}` };
}
