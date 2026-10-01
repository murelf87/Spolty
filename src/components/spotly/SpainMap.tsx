import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Maximize2, Search } from "lucide-react";
import valencia from "@/assets/valencia-sunset.jpg";
import { norm } from "@/lib/geo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Screen } from "./kit";
import { useApp } from "./app-context";
import sevilla from "@/assets/seville-night.jpg";
import { cn } from "@/lib/utils";
import { municipiosOf, provinceByCode, provinceOfPlace, projectLonLat, provinces, viewBox, type Province } from "@/lib/geo";
import { PlaceBrowser } from "./Places";

export type MapPin = { id: string; name: string; lon: number; lat: number; img?: string; count?: string };
const [VX, VY, W, H] = viewBox;

export const spainCities: MapPin[] = [
  { id: "coruna", name: "A Coruña", lon: -8.4, lat: 43.37, count: "86" }, { id: "bilbao", name: "Bilbao", lon: -2.93, lat: 43.26, count: "120" },
  { id: "barcelona", name: "Barcelona", lon: 2.17, lat: 41.39, count: "290" }, { id: "madrid", name: "Madrid", lon: -3.7, lat: 40.42, count: "324" },
  { id: "valencia", name: "Valencia", lon: -0.38, lat: 39.47, count: "210" }, { id: "sevilla", name: "Sevilla", lon: -5.98, lat: 37.39, count: "246" },
  { id: "malaga", name: "Málaga", lon: -4.42, lat: 36.72, count: "175" }, { id: "murcia", name: "Murcia", lon: -1.13, lat: 37.99, count: "98" },
  { id: "palma", name: "Palma", lon: 2.65, lat: 39.57, count: "74" }, { id: "zaragoza", name: "Zaragoza", lon: -0.88, lat: 41.65, count: "101" },
];

const MAXZ = 14;
type VB = [number, number, number, number];
const clampVB = ([x, y, w]: VB): VB => {
  const nw = Math.min(W, Math.max(W / MAXZ, w)); const nh = (nw * H) / W;
  return [Math.min(VX + W - nw, Math.max(VX, x)), Math.min(VY + H - nh, Math.max(VY, y)), nw, nh];
};

/**
 * Mapa de España interactivo: 52 provincias clicables (teclado incluido), zoom con botones,
 * doble toque, pellizco o Ctrl+rueda, arrastre para mover, vuelo automático a la provincia elegida
 * y etiqueta al pasar/enfocar. Las cifras de los pines son de ejemplo.
 */
export function SpainMap({ pins = spainCities, selected, onSelect, className, showNames = true, province, onProvince }: { pins?: MapPin[]; selected?: string | undefined; onSelect?: (p: MapPin) => void; className?: string; showNames?: boolean; province?: string | undefined; onProvince?: (p: Province) => void }) {
  const tiny = provinces.filter((p) => p.c === "51" || p.c === "52");
  const box = useRef<HTMLDivElement | null>(null);
  const paths = useRef<Record<string, SVGPathElement | null>>({});
  const [vb, setVb] = useState<VB>([VX, VY, W, H]);
  const cur = useRef<VB>([VX, VY, W, H]);
  const raf = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, dist: 0 });
  const set = (v: VB) => { const c = clampVB(v); cur.current = c; setVb(c); };

  const flyTo = useCallback((t: VB) => {
    cancelAnimationFrame(raf.current);
    const from = cur.current; const to = clampVB(t); const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 320); const e = 1 - Math.pow(1 - k, 3);
      const v = from.map((f, i) => f + (to[i]! - f) * e) as VB; cur.current = v; setVb(v);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const frame = useCallback((code: string): VB | null => {
    const p = provinceByCode.get(code); if (!p) return null;
    if (code === "51" || code === "52") { const w = W / 4; return [p.x - w / 2, p.y - (w * H) / W / 2, w, (w * H) / W]; }
    const el = paths.current[code]; if (!el) return null;
    const b = el.getBBox(); const w = Math.max(b.width * 1.5, (b.height * 1.5 * W) / H, W / 9);
    const h = (w * H) / W; return [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h];
  }, []);

  // Vuelo a la provincia elegida (también si se elige desde fuera del mapa).
  useEffect(() => { if (!province) return; const f = frame(province); if (f) flyTo(f); }, [province, frame, flyTo]);

  const zoomAt = (factor: number, cx = 0.5, cy = 0.5) => {
    const [x, y, w, h] = cur.current; const nw = Math.min(W, Math.max(W / MAXZ, w / factor)); const nh = (nw * H) / W;
    flyTo([x + (w - nw) * cx, y + (h - nh) * cy, nw, nh]);
  };
  const reset = () => flyTo([VX, VY, W, H]);
  const zoomed = vb[2] < W * 0.98;

  // Ctrl+rueda / pellizco de trackpad (sin secuestrar el scroll normal de la página).
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); const r = el.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * 0.012); const [x, y, w, h] = cur.current; const nw = Math.min(W, Math.max(W / MAXZ, w * f)); const nh = (nw * H) / W;
      const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
      set([x + (w - nw) * cx, y + (h - nh) * cy, nw, nh]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = false; cancelAnimationFrame(raf.current);
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; gesture.current.dist = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev || !box.current) return;
    const r = box.current.getBoundingClientRect(); const [x, y, w, h] = cur.current;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (gesture.current.dist > 0) {
        const f = d / gesture.current.dist; const nw = Math.min(W, Math.max(W / MAXZ, w / f)); const nh = (nw * H) / W;
        const cx = ((a!.x + b!.x) / 2 - r.left) / r.width, cy = ((a!.y + b!.y) / 2 - r.top) / r.height;
        set([x + (w - nw) * cx, y + (h - nh) * cy, nw, nh]);
      }
      gesture.current.dist = d; gesture.current.moved = true; return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 3) return;
    if (!gesture.current.moved && !zoomed) { gesture.current.moved = Math.hypot(dx, dy) > 6; if (!gesture.current.moved) return; }
    gesture.current.moved = true;
    if (zoomed) set([x - (dx * w) / r.width, y - (dy * h) / r.height, w, h]);
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); gesture.current.dist = 0; window.setTimeout(() => { if (ptrs.current.size === 0) gesture.current.moved = false; }, 0); };
  const pick = (p: Province) => { if (gesture.current.moved) return; onProvince?.(p); const f = frame(p.c); if (f) flyTo(f); };
  const name = hover ? provinceByCode.get(hover) : undefined;
  const sel = province ? provinceByCode.get(province) : undefined;

  return (
    <div ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={(e) => { if ((e.target as Element).tagName === "svg") { const r = box.current!.getBoundingClientRect(); zoomAt(2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } }}
      className={cn("spot-neon-map relative touch-none select-none overflow-hidden rounded-2xl border border-border", className)} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}`} className="block h-full w-full" role="group" aria-label="Mapa de España por provincias. Toca una provincia para verla.">
        <defs><filter id="es-glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <rect x="-14" y="455" width="200" height="106" rx="10" fill="none" stroke="var(--border)" strokeDasharray="5 4" />
        <text x="-6" y="472" fontSize="11" fill="var(--muted-foreground)">Canarias</text>
        <g filter="url(#es-glow)" strokeLinejoin="round">
          {provinces.map((p) => {
            const on = province === p.c; const hv = hover === p.c;
            return <path key={p.c} ref={(el) => { paths.current[p.c] = el; }} d={p.d} role="button" tabIndex={0} aria-label={`${p.n}, ${p.r}`} aria-pressed={on}
              onClick={() => pick(p)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(p.c); }} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.c)} onBlur={() => setHover(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProvince?.(p); const f = frame(p.c); if (f) flyTo(f); } }}
              className="cursor-pointer outline-none transition-[fill,fill-opacity] duration-150" fill={on ? "var(--accent)" : hv ? "var(--accent)" : "var(--primary)"} fillOpacity={on ? 0.6 : hv ? 0.4 : province ? 0.14 : 0.2} stroke={on || hv ? "var(--accent)" : "var(--primary)"} strokeWidth={on ? 2 : hv ? 1.6 : 0.8} vectorEffect="non-scaling-stroke" />;
          })}
        </g>
        {tiny.map((p) => <g key={p.c} onClick={() => pick(p)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(p.c); }} onPointerLeave={() => setHover(null)} role="button" tabIndex={0} aria-label={`${p.n}, ${p.r}`} aria-pressed={province === p.c} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProvince?.(p); const f = frame(p.c); if (f) flyTo(f); } }} className="cursor-pointer outline-none"><circle cx={p.x} cy={p.y} r={9} fill={province === p.c ? "var(--accent)" : "var(--primary)"} fillOpacity={province === p.c ? 0.6 : 0.35} stroke={province === p.c ? "var(--accent)" : "var(--primary)"} strokeWidth="1" vectorEffect="non-scaling-stroke" /><text x={p.x + 12} y={p.y + 4} fontSize="11" fill="var(--foreground)">{p.n}</text></g>)}
      </svg>
      {pins.map((p) => {
        const [ax, ay] = projectLonLat(p.lon, p.lat);
        const l = ((ax - vb[0]) / vb[2]) * 100, t = ((ay - vb[1]) / vb[3]) * 100;
        if (l < -4 || l > 104 || t < -4 || t > 104) return null;
        const on = selected === p.id;
        return (
          <button key={p.id} onClick={() => { if (gesture.current.moved) return; onSelect?.(p); const pr = provinceOfPlace(p.name); if (pr) { onProvince?.(pr); const f = frame(pr.c); if (f) flyTo(f); } }} aria-label={`${p.name}${p.count ? `, ${p.count} personas cerca` : ""}`} aria-pressed={on}
            className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${l}%`, top: `${t}%`, zIndex: on ? 3 : 2 }}>
            <span className={cn("grid place-items-center rounded-full border-2 bg-background/90 font-bold", on ? "h-8 w-8 border-accent text-[10px] shadow-glow" : "h-6 w-6 border-primary text-[8px]")}>{p.count ?? "·"}</span>
            {showNames && <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-background/80 px-1 text-[9px] font-semibold">{p.name}</span>}
          </button>
        );
      })}
      {name && (() => { const l = ((name.x - vb[0]) / vb[2]) * 100, t = ((name.y - vb[1]) / vb[3]) * 100; return <span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-accent/60 bg-background/95 px-2 py-1 text-[11px] font-semibold shadow-glow" style={{ left: `${Math.min(88, Math.max(12, l))}%`, top: `${Math.max(8, t)}%` }}>{name.n}</span>; })()}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
        <button aria-label="Acercar" onClick={() => zoomAt(1.8)} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/85 text-lg font-bold backdrop-blur">+</button>
        <button aria-label="Alejar" onClick={() => zoomAt(1 / 1.8)} disabled={!zoomed} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/85 text-lg font-bold backdrop-blur disabled:opacity-40">−</button>
        {(zoomed || sel) && <button aria-label="Ver toda España" onClick={reset} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/85 backdrop-blur"><Maximize2 size={16} /></button>}
      </div>
      <span className="sr-only" aria-live="polite">{sel ? `Provincia seleccionada: ${sel.n}` : ""}</span>
    </div>
  );
}

/** Lámina 5 · Mapa completo: mapa real por provincias (52), buscador de municipios (8.131) y tarjeta de lugar. */
export function SpainScreen({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const [tab, setTab] = useState<"Mapa" | "Provincias" | "Municipios">("Mapa");
  const [sel, setSel] = useState<string | null>(null);
  const [prov, setProv] = useState<Province | null>(null);
  const [browse, setBrowse] = useState<string | undefined>(undefined);
  const c = spainCities.find((x) => x.id === sel);
  const go = (name: string) => { onBack(); app.openPhotoWall(name); };
  return (
    <Screen title="Mapa completo" sub="52 provincias · 8.131 municipios" onBack={onBack} z={55}>
      <div className="grid grid-cols-3 rounded-full border border-border bg-card p-1">{(["Mapa", "Provincias", "Municipios"] as const).map((x) => <Button key={x} variant="ghost" onClick={() => { setTab(x); setBrowse(undefined); }} className={"h-9 rounded-full px-1 text-[13px] " + (tab === x ? "spot-active-pill text-foreground" : "text-muted-foreground")}>{x === "Municipios" ? "Buscar municipio" : x}</Button>)}</div>
      {tab === "Mapa" && <>
        <SpainMap className="mt-3 w-full" selected={sel ?? undefined} province={prov?.c} onSelect={(p) => { setSel(p.id); const pr = provinceOfPlace(p.name); if (pr) setProv(pr); }} onProvince={(p) => { setProv(p); setSel(null); }} />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Toca una provincia (Ceuta, Melilla, Canarias y Baleares incluidas) o una ciudad activa.</p>
        {c && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-3"><img src={sevilla} alt="" className="h-14 w-14 rounded-xl object-cover" /><span className="min-w-0 flex-1"><strong className="block text-lg">{c.name}</strong><small className="block text-muted-foreground">{c.count} personas con actividad ahora · cifra de ejemplo</small></span></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => go(c.name)}>Ver fotos</Button><Button onClick={() => { toast(`Mostrando ${c.name} en el mapa`); onBack(); app.goMap(); }}>Ver en mapa</Button></div>
          </div>
        )}
        {prov && !c && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <strong className="block text-lg">{prov.n}</strong><small className="block text-muted-foreground">{prov.r} · {municipiosOf(prov.c).length} {municipiosOf(prov.c).length === 1 ? "municipio" : "municipios"} · capital {prov.k}</small>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { setBrowse(prov.c); setTab("Municipios"); }}>Ver municipios</Button><Button onClick={() => go(prov.n)}>Ver fotos</Button></div>
          </div>
        )}
      </>}
      {tab === "Provincias" && <ProvinceList onPick={(pr) => { setProv(pr); setBrowse(pr.c); setTab("Municipios"); }} />}
      {tab === "Municipios" && <div className="mt-3"><PlaceBrowser key={browse ?? "all"} initialProvince={browse} onPick={(name) => go(name)} /></div>}
      <p className="mt-3 text-[11px] text-muted-foreground">Geografía oficial (IGN e INE). Las cifras de actividad son de ejemplo hasta conectar el backend.</p>
    </Screen>
  );
}

const featured = ["28", "08", "46", "41", "15"];
const thumb: Record<string, string> = { "41": sevilla, "46": valencia };

/** Lámina 8 · «Selecciona una provincia»: las 52 provincias con su número real de municipios (INE). */
function ProvinceList({ onPick }: { onPick: (p: Province) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const order = [...featured.map((c) => provinces.find((p) => p.c === c)).filter((p): p is Province => !!p), ...provinces.filter((p) => !featured.includes(p.c)).sort((a, b) => a.n.localeCompare(b.n, "es"))];
  const nq = norm(q);
  const list = nq ? order.filter((p) => norm(p.n).includes(nq)) : all ? order : order.slice(0, 8);
  return (
    <div className="mt-3">
      <h2 className="text-lg font-bold">Selecciona una provincia</h2>
      <label className="mt-2 flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4"><Search size={16} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar provincia…" aria-label="Buscar provincia" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" /></label>
      <ul className="mt-3 space-y-2">
        {list.map((p) => { const n = municipiosOf(p.c).length; return (
          <li key={p.c}><button onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left">
            {thumb[p.c] ? <img src={thumb[p.c]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-spot-gradient text-lg font-bold text-primary-foreground">{p.n.slice(0, 1)}</span>}
            <span className="min-w-0 flex-1"><strong className="block truncate">{p.n}</strong><small className="text-muted-foreground">{n.toLocaleString("es-ES")} {n === 1 ? "municipio" : "municipios"}</small></span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button></li>); })}
        {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No hay ninguna provincia con ese nombre.</li>}
      </ul>
      {!nq && !all && <Button variant="secondary" className="mt-3 w-full" onClick={() => setAll(true)}>Ver las {provinces.length} provincias</Button>}
    </div>
  );
}
