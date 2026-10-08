/**
 * Enlaces y compartir. Los enlaces abren la app web publicada (VITE_PUBLIC_URL si está definida; si no, la dirección
 * desde la que se usa la app) y la app los entiende al abrirse: ?spot=<id> abre ese Spot.
 * Compartir usa la hoja nativa del móvil (Web Share) cuando existe; si no, copia el enlace.
 */
import { toast } from "sonner";

export function appUrl(): string | null {
  const env = import.meta.env["VITE_PUBLIC_URL"] as string | undefined;
  if (env) return env.replace(/\/+$/, "");
  if (typeof location === "undefined" || !/^https?:$/.test(location.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.hostname.endsWith(".invalid")) return null;
  return `${location.origin}${location.pathname.replace(/\/+$/, "")}`;
}
export const spotLink = (id: string) => { const base = appUrl(); return base ? `${base}/?spot=${encodeURIComponent(id)}` : null; };
export const profileLink = (username: string) => { const base = appUrl(); return base ? `${base}/?perfil=${encodeURIComponent(username)}` : null; };

export async function copyText(text: string, done = "Enlace copiado"): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); toast(done); return true; }
  catch { toast.error("No se pudo copiar. Mantén pulsado el enlace para copiarlo."); return false; }
}
export async function copySpotLink(id: string) {
  const url = spotLink(id);
  if (!url) { toast("Los enlaces funcionarán cuando la app esté publicada en su dirección web."); return false; }
  return copyText(url);
}
/** Hoja nativa de compartir; si no existe, copia el enlace. Devuelve false si se canceló o falló. */
export async function shareLink(opts: { title: string; text?: string | undefined; url: string | null }): Promise<boolean> {
  if (!opts.url) { toast("Los enlaces funcionarán cuando la app esté publicada en su dirección web."); return false; }
  try {
    if (typeof navigator !== "undefined" && navigator.share) { await navigator.share({ title: opts.title, url: opts.url, ...(opts.text ? { text: opts.text } : {}) }); return true; }
  } catch (e) { if ((e as DOMException)?.name === "AbortError") return false; }
  return copyText(opts.url);
}
/** Enlaces para compartir en cada red (los que tienen versión web; el resto usa la hoja nativa o copia). */
export function networkShareUrl(net: string, url: string, text: string): string | null {
  const u = encodeURIComponent(url), t = encodeURIComponent(text), both = encodeURIComponent(`${text} ${url}`);
  switch (net) {
    case "X": return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case "Facebook": return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "WhatsApp": return `https://wa.me/?text=${both}`;
    case "Telegram": return `https://t.me/share/url?url=${u}&text=${t}`;
    case "LinkedIn": return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "Reddit": return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    case "Pinterest": return `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`;
    case "Threads": return `https://www.threads.net/intent/post?text=${both}`;
    case "Bluesky": return `https://bsky.app/intent/compose?text=${both}`;
    case "Correo": return `mailto:?subject=${t}&body=${both}`;
    case "Mensajes": return `sms:?&body=${both}`;
    default: return null; // Instagram, TikTok, Snapchat, Messenger: sin enlace web para compartir
  }
}
