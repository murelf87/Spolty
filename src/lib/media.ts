/**
 * Fotos y vídeos de muestra (contenido demo hasta que exista el backend social).
 * Cada foto de muestra tiene un clip corto de vídeo hecho a partir de ella, para que los Spots
 * marcados como vídeo o reel se reproduzcan de verdad.
 */
import festival from "@/assets/spotly-sevilla-festival.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import sevilleNight from "@/assets/seville-night.jpg";
import sevillaNoche from "@/assets/spotly-sevilla-noche-ref.jpg";
import salon from "@/assets/spotly-salon.jpg";
import laura from "@/assets/spotly-laura.jpg";
import feriaClip from "@/assets/videos/feria.mp4";
import playaClip from "@/assets/videos/playa.mp4";
import conciertoClip from "@/assets/videos/concierto.mp4";
import atardecerClip from "@/assets/videos/atardecer.mp4";
import nocheClip from "@/assets/videos/noche.mp4";
import centroClip from "@/assets/videos/centro.mp4";
import salonClip from "@/assets/videos/salon.mp4";
import lauraClip from "@/assets/videos/laura.mp4";

export type SampleMedia = { img: string; video: string; caption: string; place: string; likes: number };

export const sampleMedia: SampleMedia[] = [
  { img: stage, video: conciertoClip, caption: "Concierto sorpresa junto a la Torre del Oro", place: "Torre del Oro, Sevilla", likes: 1240 },
  { img: festival, video: feriaClip, caption: "Así suena la Feria esta noche", place: "Real de la Feria, Sevilla", likes: 842 },
  { img: beach, video: playaClip, caption: "Atardecer en el beach club", place: "La Malvarrosa, Valencia", likes: 1103 },
  { img: valenciaSunset, video: atardecerClip, caption: "La puesta de sol desde el paseo", place: "Paseo Marítimo, Valencia", likes: 854 },
  { img: sevilleNight, video: nocheClip, caption: "Paseo nocturno por el centro", place: "Centro, Sevilla", likes: 376 },
  { img: sevillaNoche, video: centroClip, caption: "La Giralda iluminada", place: "Santa Cruz, Sevilla", likes: 958 },
  { img: salon, video: salonClip, caption: "Cambio de look en Triana", place: "Triana, Sevilla", likes: 211 },
  { img: laura, video: lauraClip, caption: "Saludo desde la Alameda", place: "Alameda de Hércules, Sevilla", likes: 489 },
];

/** Clip de vídeo hecho a partir de esa foto de muestra (o undefined si la foto no es de muestra). */
export const videoFor = (img: string) => sampleMedia.find((m) => m.img === img)?.video;
