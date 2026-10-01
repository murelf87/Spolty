/**
 * Spotly · configuración comercial y de producto.
 *
 * TODO backend: estos valores deben venir de un endpoint administrable
 * (GET /v1/config/commerce) y cachearse en el cliente. Aquí solo hay valores
 * de ejemplo para que la interfaz funcione; NINGUNA pantalla debe escribir
 * precios, multiplicadores, duraciones, radios o paquetes a mano: siempre se
 * leen de este módulo.
 */

export const commerce = {
  /** 1 € = N créditos. Sirve para mostrar siempre el equivalente antes de pagar. */
  creditsPerEur: 100,
  currency: "EUR",
  voiceMaxSeconds: 30,
  /** Frecuencia máxima con la que una misma persona verá un Spot impulsado. */
  frequencyCapPerUserPerDay: 3,
  /** Descanso mínimo entre dos impactos del mismo Spot a la misma persona. */
  restBetweenImpactsMinutes: 45,
};

export type CreditPack = { id: string; credits: number; bonus: number; priceEur: number; popular?: boolean };
export const creditPacks: CreditPack[] = [
  { id: "p100", credits: 100, bonus: 0, priceEur: 0.99 },
  { id: "p550", credits: 550, bonus: 50, priceEur: 4.99 },
  { id: "p1200", credits: 1200, bonus: 200, priceEur: 9.99, popular: true },
  { id: "p3200", credits: 3200, bonus: 700, priceEur: 24.99 },
];

/** Incógnito de pago por tiempo. `minutes: null` = permanente. */
export type IncognitoOption = { id: string; label: string; minutes: number | null; priceEur: number };
export const incognitoOptions: IncognitoOption[] = [
  { id: "15m", label: "15 min", minutes: 15, priceEur: 0.29 },
  { id: "1h", label: "1 hora", minutes: 60, priceEur: 0.59 },
  { id: "6h", label: "6 horas", minutes: 360, priceEur: 1.49 },
  { id: "24h", label: "24 horas", minutes: 1440, priceEur: 2.49 },
  { id: "7d", label: "7 días", minutes: 10080, priceEur: 5.99 },
  { id: "perm", label: "Permanente", minutes: null, priceEur: 9.99 },
];
export const incognitoExtensions = ["15m", "1h", "24h"];
export const incognitoWarnMinutes = 10;

export const locationPrecision = [
  { id: "exact", label: "Exacta", hint: "Punto concreto. Puede delatar quién eres.", risky: true },
  { id: "approx", label: "Aproximada", hint: "Unos 300 m a la redonda." },
  { id: "zone", label: "Solo zona / municipio", hint: "Barrio o municipio, sin más detalle." },
  { id: "hidden", label: "Oculta", hint: "Sin ubicación pública (solo si el Spot lo permite)." },
] as const;
export type Precision = (typeof locationPrecision)[number]["id"];

/** Impulso de Spots. `mult` es prioridad/frecuencia, NO garantía de visualizaciones. */
export type BoostLevel = { id: string; label: string; mult: number; priceEur: number; minutes: number; sub: string; hot?: boolean };
export const boostLevels: BoostLevel[] = [
  { id: "n", label: "Normal (Gratis)", mult: 1, priceEur: 0, minutes: 0, sub: "Distribución estándar" },
  { id: "x2", label: "x2 Visibilidad", mult: 2, priceEur: 0.99, minutes: 30, sub: "Más oportunidades de aparecer" },
  { id: "x5", label: "x5 Visibilidad", mult: 5, priceEur: 2.49, minutes: 60, sub: "Alta presencia en el scroll", hot: true },
  { id: "x10", label: "x10 Visibilidad", mult: 10, priceEur: 4.99, minutes: 60, sub: "Máxima difusión" },
];
export const topNowPriceEur = 1.99;
export const boostRadii = [
  { id: "1", label: "1 km", km: 1 },
  { id: "2", label: "2 km", km: 2 },
  { id: "5", label: "5 km", km: 5 },
  { id: "10", label: "10 km", km: 10 },
];
export const boostAreas = ["Solo mi ciudad", "Provincia", "Toda Andalucía", "Toda España"];

/** Promoción de perfil: se compra EXPOSICIÓN, nunca seguidores. */
export type PromoIntensity = { id: string; label: string; priceEur: number; hours: number; sub: string };
export const promoIntensities: PromoIntensity[] = [
  { id: "soft", label: "Suave", priceEur: 1.99, hours: 24, sub: "Aparece en algunas recomendaciones" },
  { id: "mid", label: "Media", priceEur: 4.99, hours: 72, sub: "Más presencia en “Descubre gente cerca”" },
  { id: "high", label: "Alta", priceEur: 9.99, hours: 168, sub: "Presencia máxima en tu zona" },
];

/** Campañas hiperlocales de negocios. */
export const campaignRadii = [
  { id: "0.5", label: "500 m", km: 0.5 },
  { id: "1", label: "1 km", km: 1 },
  { id: "2", label: "2 km", km: 2 },
  { id: "5", label: "5 km", km: 5 },
  { id: "10", label: "10 km", km: 10 },
  { id: "muni", label: "Municipio", km: 25 },
];
export const campaignDays = ["L", "M", "X", "J", "V", "S", "D"];
export const campaignBudget = { minPerDay: 2, maxPerDay: 100, step: 1, defaultPerDay: 8, days: [3, 7, 14, 30] };
/** Coste por mil impresiones (ejemplo) para ESTIMAR alcance; no es una garantía. */
export const campaignCpmEur = 4;
export const flashDurations = [30, 60, 120, 240];
export const availabilityWindows = [30, 60, 90, 120];
export const availabilityMaxSlots = 8;

export const businessCategories = ["Peluquería", "Barbería", "Bar", "Restaurante", "Cafetería", "Gimnasio", "Taller", "Farmacia", "Ocio", "Comercio", "Servicios"];

export const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
export const eurToCredits = (n: number) => Math.round(n * commerce.creditsPerEur);
export const fmtCredits = (n: number) => "💎 " + n.toLocaleString("es-ES");
/** Precio siempre con su equivalente en créditos. */
export const priceLabel = (priceEur: number) => (priceEur === 0 ? "Gratis" : `${eur(priceEur)} · ${eurToCredits(priceEur)} cr`);
export const estimateReach = (budgetEur: number) => {
  const imp = Math.round((budgetEur / campaignCpmEur) * 1000);
  return [Math.round(imp * 0.7), Math.round(imp * 1.3)] as const;
};

/** Acceso y cuentas. TODO backend: edad mínima y política de contraseñas deben coincidir con Supabase Auth. */
export const auth = {
  minAge: 18,
  minPassword: 8,
  /** Segundos antes de poder reenviar un código o enlace. */
  resendSeconds: 30,
  /** Fallos de contraseña seguidos antes de bloquear el botón unos segundos (el servidor aplica su propio límite). */
  maxFails: 5,
  lockSeconds: 30,
};

/**
 * Verificación de identidad por niveles.
 * - basic: gratis. SOLO selfie en tiempo real (prueba de persona real). Sin documento ni teléfono.
 * - premium: de pago. Documento + selfie + teléfono (SMS) y, opcional, redes sociales. Asterisco público.
 * - creator: de pago. Premium + revisión manual de creador.
 * TODO backend: precios administrables (GET /v1/config/verification). Importes de EJEMPLO.
 */
export const verificationPricesEur = { basic: 0, premium: 4.99, creator: 9.99 } as const;
