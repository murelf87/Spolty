import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Search, X } from "lucide-react";
import { communities, municipiosOf, norm, provinces, searchPlaces, totalMunicipios, type Province } from "@/lib/geo";
import { cn } from "@/lib/utils";

const PAGE = 80;

/**
 * Explorador de lugares de toda España: 52 provincias (con Ceuta, Melilla, Canarias y Baleares) y 8.131 municipios.
 * Se incrusta en hojas y pantallas; no gestiona el cierre. `onPick` recibe el nombre elegido y su provincia.
 */
export function PlaceBrowser({ onPick, initialProvince, allowProvince = true, selected }: { onPick: (name: string, prov: Province) => void; initialProvince?: string | undefined; allowProvince?: boolean; selected?: string | undefined }) {
  const [q, setQ] = useState("");
  const [prov, setProv] = useState<Province | null>(provinces.find((p) => p.c === initialProvince) ?? null);
  const [inner, setInner] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const hits = useMemo(() => (q.trim() ? searchPlaces(q, 80) : []), [q]);
  const list = useMemo(() => {
    if (!prov) return [];
    const t = norm(inner.trim());
    return municipiosOf(prov.c).filter((m) => !t || norm(m).includes(t));
  }, [prov, inner]);
  const open = (p: Province) => { setProv(p); setInner(""); setLimit(PAGE); setQ(""); };
  const rowCls = "flex min-h-11 w-full items-center gap-3 py-2 text-left";

  const searchBox = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-secondary px-3.5"><Search size={16} className="shrink-0 text-primary" />
      <input value={value} onChange={(e) => { set(e.target.value); setLimit(PAGE); }} aria-label={label} placeholder={label} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      {value && <button aria-label="Borrar búsqueda" onClick={() => set("")}><X size={15} className="text-muted-foreground" /></button>}</label>
  );

  if (prov) {
    const shown = list.slice(0, limit);
    return (
      <div>
        <button onClick={() => setProv(null)} className="mb-2 flex items-center gap-1 text-xs font-semibold text-primary"><ChevronLeft size={15} />Todas las provincias</button>
        <div className="mb-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><MapPin size={20} /></span><span className="min-w-0 flex-1"><strong className="block text-base">{prov.n}</strong><small className="text-muted-foreground">{prov.r} · {municipiosOf(prov.c).length} {municipiosOf(prov.c).length === 1 ? "municipio" : "municipios"} · capital {prov.k}</small></span></div>
        {allowProvince && <button onClick={() => onPick(prov.n, prov)} className={cn("mb-2 flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-sm font-semibold", selected === prov.n ? "border-primary bg-primary/10" : "border-border bg-card")}>Toda la provincia de {prov.n}<ChevronRight size={16} className="text-muted-foreground" /></button>}
        {municipiosOf(prov.c).length > 12 && searchBox(inner, setInner, `Buscar en ${prov.n}`)}
        <div className="mt-2 divide-y divide-border">
          {shown.map((m) => <button key={m} onClick={() => onPick(m, prov)} className={rowCls}><MapPin size={15} className={selected === m ? "text-primary" : "text-muted-foreground"} /><span className={cn("min-w-0 flex-1 truncate text-sm", selected === m && "font-bold text-primary")}>{m}</span>{norm(m) === norm(prov.k) && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-3xs font-bold text-primary">Capital</span>}<ChevronRight size={15} className="text-muted-foreground" /></button>)}
        </div>
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ningún municipio coincide con “{inner}”.</p>}
        {list.length > limit && <button onClick={() => setLimit(limit + PAGE)} className="mt-2 w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-primary">Mostrar más ({list.length - limit} restantes)</button>}
      </div>
    );
  }

  return (
    <div>
      {searchBox(q, setQ, "Buscar ciudad, pueblo o provincia…")}
      <p className="mt-2 text-2xs text-muted-foreground">{provinces.length} provincias · {String(totalMunicipios).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} municipios (Ceuta, Melilla, Canarias y Baleares incluidos)</p>
      {q.trim() ? (
        <div className="mt-1 divide-y divide-border">
          {hits.map((h) => <button key={h.kind + h.prov.c + h.name} onClick={() => h.kind === "provincia" ? open(h.prov) : onPick(h.name, h.prov)} className={rowCls}><MapPin size={15} className="text-primary" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.name}</span><small className="text-muted-foreground">{h.kind === "provincia" ? `Provincia · ${h.prov.r}` : `${h.kind === "capital" ? "Capital · " : ""}${h.prov.n}`}</small></span><ChevronRight size={15} className="text-muted-foreground" /></button>)}
          {hits.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No encontramos “{q}”. Prueba con otra escritura (se ignoran tildes).</p>}
        </div>
      ) : (
        <div className="mt-2">
          {communities.map((r) => <section key={r} className="mb-3"><h4 className="mb-1 text-2xs font-bold uppercase tracking-wider text-muted-foreground">{r}</h4>
            <div className="divide-y divide-border rounded-xl border border-border bg-card px-3">{provinces.filter((p) => p.r === r).map((p) => <button key={p.c} onClick={() => open(p)} className={rowCls}><span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.n}</span><small className="text-muted-foreground">{municipiosOf(p.c).length} mun.</small><ChevronRight size={15} className="text-muted-foreground" /></button>)}</div></section>)}
        </div>
      )}
    </div>
  );
}
