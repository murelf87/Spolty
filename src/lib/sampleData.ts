/**
 * Datos de ejemplo + contratos de datos que el backend deberá cumplir.
 * Cada tipo exportado aquí es el contrato (ver docs/BACKEND_CONTRACT.md).
 * NADA de esto se presenta como real: la UI rotula “ejemplo” donde procede.
 */
import salon from "@/assets/spotly-salon.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import night from "@/assets/seville-night.jpg";
import sunset from "@/assets/valencia-sunset.jpg";
import laura from "@/assets/spotly-laura.jpg";
import me from "@/assets/spotly-me.jpg";
import type { Campaign } from "./store";
import { campaignRadii, campaignDays } from "./spotlyConfig";

export type Business = {
  id: string; name: string; category: string; img: string; distM: number; open: boolean; hours: string;
  phone: string; address: string; about: string; voice: string; voiceDur: string;
  /** Anunciante de terceros con campaña activa compatible (ejemplo). */
  paidBy?: "other"; mine?: boolean; slots?: number; staticOffer?: { title: string; minutes: number };
};

export const businesses: Business[] = [
  { id: "carmen", name: "Peluquería Carmen", category: "Peluquería", img: salon, distM: 230, open: true, hours: "09:30–20:30", phone: "+34955000111", address: "C/ Betis 24, Triana", about: "Peluquería de barrio con 25 años en Triana. Corte, color y peinados.", voice: "Hoy tenemos huecos esta tarde, ven sin cita.", voiceDur: "0:14", mine: true },
  { id: "trinche", name: "Barbería El Trinche", category: "Barbería", img: beach, distM: 480, open: true, hours: "10:00–21:00", phone: "+34955000222", address: "C/ Pureza 8, Triana", about: "Barbería clásica: corte, barba y afeitado a navaja.", voice: "Afeitado a navaja con toalla caliente, pregunta por la oferta.", voiceDur: "0:11", paidBy: "other", slots: 2 },
  { id: "estilosur", name: "Peluquería Estilo Sur", category: "Peluquería", img: festival, distM: 900, open: true, hours: "10:00–20:00", phone: "+34955000333", address: "Av. de Coria 40", about: "Cortes, mechas y tratamientos capilares.", voice: "Reserva tu cita cuando quieras.", voiceDur: "0:08" },
  { id: "marisol", name: "Salón Marisol", category: "Peluquería", img: night, distM: 1400, open: false, hours: "Abre mañana a las 10:00", phone: "+34955000444", address: "C/ San Jacinto 61", about: "Salón de belleza y peluquería.", voice: "Estamos cerrados, ¡hasta mañana!", voiceDur: "0:06" },
  { id: "alameda", name: "Restaurante La Alameda", category: "Restaurante", img: night, distM: 350, open: true, hours: "13:00–23:30", phone: "+34955000555", address: "Alameda de Hércules 12", about: "Cocina andaluza de mercado. Terraza.", voice: "Menú del día y tapas de la casa.", voiceDur: "0:12" },
  { id: "pepe", name: "Casa Pepe", category: "Restaurante", img: festival, distM: 600, open: true, hours: "12:00–00:00", phone: "+34955000666", address: "C/ Castilla 33", about: "Tapas de siempre en Triana.", voice: "Prueba las espinacas con garbanzos.", voiceDur: "0:09", paidBy: "other" },
  { id: "farmtriana", name: "Farmacia Triana 24 h", category: "Farmacia", img: stage, distM: 300, open: true, hours: "Abierta 24 horas", phone: "+34955000777", address: "Plaza del Altozano 2", about: "Farmacia de guardia permanente.", voice: "Abiertos las 24 horas, todos los días.", voiceDur: "0:05" },
  { id: "farmbetis", name: "Farmacia Betis", category: "Farmacia", img: beach, distM: 700, open: true, hours: "09:00–22:00", phone: "+34955000888", address: "C/ Betis 70", about: "Farmacia y ortopedia.", voice: "Servicio de tensión y glucosa sin cita.", voiceDur: "0:07" },
  { id: "salax", name: "Sala X", category: "Bar", img: stage, distM: 1100, open: true, hours: "21:00–03:00", phone: "+34955000999", address: "C/ Torneo 12", about: "Copas y música en directo.", voice: "Esta noche: concierto a las 22:30.", voiceDur: "0:10", staticOffer: { title: "2x1 en copas · hasta medianoche", minutes: 43 } },
  { id: "terraza", name: "Terraza Alameda", category: "Bar", img: sunset, distM: 800, open: true, hours: "17:00–01:00", phone: "+34955001010", address: "Alameda de Hércules 5", about: "Terraza tranquila para tomar una copa.", voice: "Ambiente tranquilo, mesas libres.", voiceDur: "0:08" },
  { id: "gimcentro", name: "Gimnasio Centro Fit", category: "Gimnasio", img: me, distM: 550, open: true, hours: "07:00–22:00", phone: "+34955001111", address: "C/ Feria 14", about: "Sala de musculación y clases dirigidas.", voice: "Prueba gratis un día.", voiceDur: "0:06" },
];

export type HotSpot = { id: string; title: string; place: string; distM: number; people: number; photos: number; audios: number; startedMin: number; confirmedBase: number; img: string };
export const hotspots: HotSpot[] = [
  { id: "h1", title: "Concierto improvisado en la calle Betis", place: "Triana", distM: 420, people: 17, photos: 8, audios: 23, startedMin: 11, confirmedBase: 17, img: stage },
  { id: "h2", title: "Cola enorme en el Mercado de Triana", place: "Triana", distM: 800, people: 9, photos: 3, audios: 12, startedMin: 25, confirmedBase: 9, img: festival },
  { id: "h3", title: "Corte de tráfico junto al Puente", place: "Centro", distM: 1600, people: 12, photos: 5, audios: 14, startedMin: 40, confirmedBase: 12, img: night },
];
export const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

export const people = [
  { name: "Laura", img: laura, note: "Música · Fotografía", dist: "300 m", verified: true },
  { name: "Carlos", img: beach, note: "Deporte · Playa", dist: "450 m", verified: true },
  { name: "Sofía", img: sunset, note: "Cultura · Arte", dist: "1,8 km", verified: true },
  { name: "Marta", img: festival, note: "Gastronomía", dist: "1,2 km", verified: true },
  { name: "Javi", img: stage, note: "Eventos · Barrio", dist: "2,4 km", verified: true },
  { name: "Ana", img: night, note: "Voz de Triana", dist: "600 m", verified: true },
];

/* ---------- Intención de búsqueda (marcador de posición del NLU del servidor) ---------- */
export type Intent = { kind: "local" | "happening" | "unknown"; category?: string | undefined; place?: string | undefined; openNow: boolean; availableNow: boolean; raw: string };
const catWords: [RegExp, string][] = [
  [/peluquer/, "Peluquería"], [/barber/, "Barbería"], [/cenar|cena|comer|restaur|tapas|almorz/, "Restaurante"],
  [/farmaci/, "Farmacia"], [/copa|beber|tomar|bar\b|cerveza|cocktail|cóctel/, "Bar"], [/gimnas|entrenar/, "Gimnasio"], [/taller|mecánic/, "Taller"],
];
export function parseIntent(raw: string): Intent {
  const t = raw.toLowerCase();
  const category = catWords.find(([r]) => r.test(t))?.[1];
  const place = ["triana", "alameda", "nervión", "centro", "macarena"].find((p) => t.includes(p));
  const availableNow = /atender|dispon|hueco|cita ahora|ahora mismo/.test(t) && !!category;
  const openNow = /abiert|ahora/.test(t);
  const happening = /pasando|ocurre|sucede|qué hay|que hay|novedades|cotille/.test(t);
  return { kind: happening ? "happening" : category ? "local" : "unknown", category, place: place ? place[0]!.toUpperCase() + place.slice(1) : undefined, openNow, availableNow, raw };
}

export const campaignEligible = (c: Campaign, distM: number, now: Date) => {
  if (c.status !== "active") return false;
  const km = campaignRadii.find((r) => r.id === c.radiusId)?.km ?? 0;
  if (distM > km * 1000) return false;
  const hm = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = c.from.split(":").map(Number), [th, tm] = c.to.split(":").map(Number);
  if (hm < fh! * 60 + fm! || hm > th! * 60 + tm!) return false;
  return c.days.includes(campaignDays[(now.getDay() + 6) % 7]!);
};

/** Muestras de estadísticas (ejemplo). Se rotulan siempre como tales. */
export const bizStats = {
  kpis: [["Impresiones", "18,4K"], ["Alcance (personas)", "9,2K"], ["Reproducciones del audio", "3,1K"], ["Clics en llamada", "212"], ["Clics en “Cómo llegar”", "348"], ["Reservas iniciadas", "57"], ["Ofertas abiertas", "1,2K"], ["Guardados", "406"]] as const,
  byHour: [["9", 20], ["11", 45], ["13", 90], ["15", 62], ["17", 100], ["19", 70], ["21", 28]] as const,
  byRadius: [["500 m", 100], ["1 km", 74], ["2 km", 48], ["5 km", 21]] as const,
};
