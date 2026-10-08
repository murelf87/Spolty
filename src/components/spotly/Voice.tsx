import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Check, MapPin, Mic, MicOff, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, StateCard, Waveform } from "./kit";
import { useApp } from "./app-context";
import { setPerm, useMe, useStore } from "@/lib/store";
import { VoiceComposer, type ReplyTarget } from "./VoiceThread";
import { addVoiceNote, type VoiceNote } from "@/lib/voice/notes";
import { formatClock } from "@/lib/voice/recorder";
import { commerce } from "@/lib/spotlyConfig";

export { useGate } from "./Gate";

/**
 * Responder (o mandar un mensaje) con tu voz desde cualquier sitio, en una hoja inferior con el panel de grabación
 * común. La voz se guarda en su conversación: `threadId` (comentarios de un Spot, una foto, un Hot Spot…) o, para
 * un mensaje a una persona, su chat de voz. Firma con tu nombre, o «Anónimo» con Incógnito de pago.
 */
export function VoiceReply({ name, onClose, onSent, mode = "reply", threadId, target }: {
  name: string; onClose: () => void; onSent?: ((r: { anon: boolean; dur: string; note: VoiceNote }) => void) | undefined;
  mode?: "reply" | "message"; threadId?: string | undefined; target?: ReplyTarget | undefined;
}) {
  const me = useMe();
  const [sent, setSent] = useState<{ anon: boolean } | null>(null);
  const where = threadId ?? `chat:${name}`;
  return (
    <BottomSheet title={sent ? undefined : mode === "message" ? `Mensaje de voz para ${name}` : `Responder a ${name}`} onClose={onClose} z={70}>
      {sent ? (
        <div className="py-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient"><Check size={30} /></div><h3 className="mt-4 text-lg font-bold">{mode === "message" ? "Mensaje enviado" : "Respuesta enviada"}</h3><p className="text-sm text-muted-foreground">{sent.anon ? "Ha salido como «Anónimo» 👻." : `Ha salido con tu nombre: ${me.name}.`} {mode === "message" ? `Está en tu chat de voz con ${name}.` : "Ya aparece en la conversación, enlazada a su audio."}</p><Button className="mt-5 w-full" onClick={onClose}>Listo</Button></div>
      ) : (
        <VoiceComposer autoFocus target={target ?? (mode === "reply" ? { name, atMs: 0, durationMs: 0 } : undefined)} sendLabel={mode === "message" ? "Enviar mensaje de voz" : "Enviar respuesta de voz"}
          onSend={(clip, anon) => {
            const note = addVoiceNote({ threadId: where, parentId: target?.id ?? null, replyAtMs: target?.atMs, clip, anon });
            setSent({ anon });
            onSent?.({ anon, dur: formatClock(clip.durationMs), note });
          }} />
      )}
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
