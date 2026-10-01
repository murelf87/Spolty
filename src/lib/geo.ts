import provData from "@/data/es-provincias.json";
import munData from "@/data/es-municipios.json";

/**
 * Geografía completa de España.
 * - 52 provincias (50 + Ceuta y Melilla; incluye Illes Balears, Las Palmas y Santa Cruz de Tenerife): códigos INE y geometría real (IGN, simplificada).
 * - 8.131 municipios: nombres y agrupación por provincia según el INE.
 * Fuentes: npm «es-atlas» (IGN) y «@doncicuto/es-municipalities» (INE), ambas licencia MIT.
 */
export type Province = { c: string; n: string; r: string; k: string; d: string; x: number; y: number };
export const viewBox = provData.viewBox as [number, number, number, number];
export const provinces = provData.provinces as Province[];
export const provinceByCode = new Map(provinces.map((p) => [p.c, p]));
const mun = munData as Record<string, string[]>;

export const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const municipiosOf = (code: string): string[] => mun[code] ?? [];
export const totalMunicipios = Object.values(mun).reduce((a, l) => a + l.length, 0);
export const communities = Array.from(new Set(provinces.map((p) => p.r))).sort((a, b) => a.localeCompare(b, "es"));

export type PlaceHit = { name: string; prov: Province; kind: "provincia" | "capital" | "municipio" };
let flat: { name: string; n: string; prov: Province }[] | null = null;
const index = () => (flat ??= provinces.flatMap((p) => municipiosOf(p.c).map((name) => ({ name, n: norm(name), prov: p }))));

/** Búsqueda sin tildes en provincias y en los 8.131 municipios. Los que empiezan por el texto van primero. */
export function searchPlaces(q: string, limit = 60): PlaceHit[] {
  const t = norm(q.trim());
  if (!t) return [];
  const out: PlaceHit[] = [];
  for (const p of provinces) if (norm(p.n).includes(t)) out.push({ name: p.n, prov: p, kind: "provincia" });
  const starts: PlaceHit[] = []; const has: PlaceHit[] = [];
  for (const m of index()) {
    const i = m.n.indexOf(t);
    if (i < 0) continue;
    const hit: PlaceHit = { name: m.name, prov: m.prov, kind: norm(m.prov.k) === m.n ? "capital" : "municipio" };
    (i === 0 ? starts : has).push(hit);
    if (starts.length >= limit) break;
  }
  return [...out, ...starts, ...has].slice(0, limit);
}

/** Provincia a la que pertenece un municipio (o una provincia si el nombre coincide con ella). */
export function provinceOfPlace(name: string): Province | undefined {
  const t = norm(name);
  return provinces.find((p) => norm(p.n) === t) ?? index().find((m) => m.n === t)?.prov;
}
export const isCapital = (name: string) => provinces.some((p) => norm(p.k) === norm(name));

/** Proyección usada por el mapa (misma que generó los trazados). Canarias van en recuadro propio. */
const K = 52, LAT0 = 43.9, LON0 = -9.5, COSL = Math.cos((39.5 * Math.PI) / 180);
export const projectLonLat = (lon: number, lat: number, canarias = false): [number, number] => {
  if (canarias) { lon += 8.4; lat += 5.6; }
  return [(lon - LON0) * COSL * K, (LAT0 - lat) * K];
};
