import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "./kit";
import { useMe } from "@/lib/store";
import { VoiceComposer, type ReplyTarget } from "./VoiceThread";
import { addVoiceNote, type VoiceNote } from "@/lib/voice/notes";
import { api, cloudErrorText, cloudOn, db } from "@/lib/cloud";
import { formatClock } from "@/lib/voice/recorder";

export { useGate } from "./Gate";

/**
 * Responder (o mandar un mensaje) con tu voz desde cualquier sitio, en una hoja inferior con el panel de grabación
 * común. La voz se guarda en su conversación: `threadId` (comentarios de un Spot, una foto, un Hot Spot…) o, para
 * un mensaje a una persona, su chat de voz (con la nube, `toUserId` abre o reutiliza el chat privado real con ella).
 * Firma con tu nombre, o «Anónimo» con Incógnito de pago.
 */
export function VoiceReply({ name, onClose, onSent, mode = "reply", threadId, target, toUserId }: {
  name: string; onClose: () => void; onSent?: ((r: { anon: boolean; dur: string; note: VoiceNote }) => void) | undefined;
  mode?: "reply" | "message"; threadId?: string | undefined; target?: ReplyTarget | undefined; toUserId?: string | null | undefined;
}) {
  const me = useMe();
  const [sent, setSent] = useState<{ anon: boolean } | null>(null);
  const direct = !!toUserId && cloudOn();
  const where = threadId ?? `chat:${name}`;
  return (
    <BottomSheet title={sent ? undefined : mode === "message" ? `Mensaje de voz para ${name}` : `Responder a ${name}`} onClose={onClose} z={70}>
      {sent ? (
        <div className="py-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient"><Check size={30} /></div><h3 className="mt-4 text-lg font-bold">{mode === "message" ? "Mensaje enviado" : "Respuesta enviada"}</h3><p className="text-sm text-muted-foreground">{sent.anon ? "Ha salido como «Anónimo» 👻." : `Ha salido con tu nombre: ${me.name}.`} {mode === "message" ? `Está en tu chat de voz con ${name}.` : "Ya aparece en la conversación, enlazada a su audio."}</p><Button className="mt-5 w-full" onClick={onClose}>Listo</Button></div>
      ) : (
        <VoiceComposer autoFocus target={target ?? (mode === "reply" ? { name, atMs: 0, durationMs: 0 } : undefined)} sendLabel={mode === "message" ? "Enviar mensaje de voz" : "Enviar respuesta de voz"}
          allowAnon={!direct}
          onSend={async (clip, anon) => {
            let thread = where;
            if (direct) {
              try { thread = `chat:${await api.openDirectChat(db(), toUserId!)}`; }
              catch (e) { toast.error(cloudErrorText(e)); return false; }
            }
            const note = addVoiceNote({ threadId: thread, parentId: target?.id ?? null, replyAtMs: target?.atMs, clip, anon: direct ? false : anon });
            setSent({ anon: direct ? false : anon });
            onSent?.({ anon, dur: formatClock(clip.durationMs), note });
            return true;
          }} />
      )}
    </BottomSheet>
  );
}
