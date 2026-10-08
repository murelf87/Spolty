import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Camera, Ghost, ImageIcon, Trash2, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, TopBar } from "./kit";
import { IncognitoSheet } from "./Incognito";
import { useMe, useStore } from "@/lib/store";
import { eur, incognitoOptions } from "@/lib/spotlyConfig";

/**
 * Autoría de los audios: cada audio lleva el nombre y la foto de quien habla. La única excepción es el Incógnito
 * de pago, con el que aparece un fantasma y «Anónimo» (Spotly sigue sabiendo qué cuenta publica).
 */

/** Tu foto de perfil, o tu inicial si no tienes foto. El tamaño (y el de la inicial) lo pone className. */
export function MeAvatar({ className = "h-10 w-10", src, name }: { className?: string; src?: string | null; name?: string }) {
  const me = useMe();
  const photo = src === undefined ? me.avatar : src;
  const who = name ?? me.name;
  return photo
    ? <img src={photo} alt={who} className={"shrink-0 rounded-full object-cover " + className} />
    : <span role="img" aria-label={who} className={"grid shrink-0 place-items-center rounded-full bg-spot-gradient font-bold text-foreground " + className}>{(who.trim()[0] ?? "?").toUpperCase()}</span>;
}

/** Avatar de un autor anónimo: fantasma en lugar de la foto. */
export function AnonAvatar({ className = "h-10 w-10", size = 18 }: { className?: string; size?: number }) {
  return <span role="img" aria-label="Anónimo" className={"grid shrink-0 place-items-center rounded-full border border-accent/60 bg-accent/20 text-foreground " + className}><Ghost size={size} /></span>;
}

/** Precio más bajo del Incógnito, para anunciar «Anónimo · desde …». */
const anonFrom = () => eur(Math.min(...incognitoOptions.map((o) => o.priceEur)));

/**
 * «Se publicará como…» en todo lo que envías con tu voz: tu nombre por defecto; «Anónimo» con fantasma solo con el
 * Incógnito de pago activo. Si no lo tienes, el botón abre la compra y, al terminar, el audio queda en anónimo.
 */
export function SignAs({ anon, onChange, label = "Se publicará como" }: { anon: boolean; onChange: (v: boolean) => void; label?: string }) {
  const me = useMe();
  const { incognito } = useStore();
  const [buy, setBuy] = useState(false);
  useEffect(() => { if (buy && incognito.active) { onChange(true); setBuy(false); } }, [buy, incognito.active, onChange]);
  useEffect(() => { if (!incognito.active && anon) onChange(false); }, [incognito.active, anon, onChange]);
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-left">
      <div className="flex items-center gap-3">
        {anon ? <AnonAvatar className="h-10 w-10" /> : <MeAvatar className="h-10 w-10 text-sm" />}
        <span className="min-w-0 flex-1">
          <small className="block truncate text-2xs text-muted-foreground">{label}</small>
          <strong className="block truncate text-sm">{anon ? "Anónimo" : me.name}</strong>
        </span>
        <button type="button" aria-pressed={anon} onClick={() => (incognito.active ? onChange(!anon) : setBuy(true))}
          className={"flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold " + (anon ? "border-accent/70 bg-accent/20 text-foreground" : "border-border text-foreground/85")}>
          <Ghost size={15} />{anon ? "Usar mi nombre" : incognito.active ? "Ir anónimo" : "Anónimo"}
        </button>
      </div>
      {!incognito.active && <p className="mt-2 text-2xs leading-snug text-muted-foreground">Salir como «Anónimo» (con fantasma) requiere Incógnito de pago, desde {anonFrom()}.</p>}
      {buy && <IncognitoSheet onClose={() => setBuy(false)} z={90} />}
    </div>
  );
}

/**
 * Versión compacta de «Se publicará como…» para el panel de grabación: chip con tu foto y nombre, o fantasma y
 * «Anónimo» con Incógnito de pago activo. Sin Incógnito, tocarlo abre la compra y al terminar queda en anónimo.
 */
export function SignAsChip({ anon, onChange }: { anon: boolean; onChange: (v: boolean) => void }) {
  const me = useMe();
  const { incognito } = useStore();
  const [buy, setBuy] = useState(false);
  useEffect(() => { if (buy && incognito.active) { onChange(true); setBuy(false); } }, [buy, incognito.active, onChange]);
  useEffect(() => { if (!incognito.active && anon) onChange(false); }, [incognito.active, anon, onChange]);
  return (
    <>
      <button type="button" aria-pressed={anon} onClick={() => (incognito.active ? onChange(!anon) : setBuy(true))}
        aria-label={anon ? "Se enviará como Anónimo. Tocar para usar tu nombre" : `Se enviará como ${me.name}. Tocar para ir anónimo`}
        className={"flex min-h-8 min-w-0 max-w-[60%] items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-2xs font-semibold " + (anon ? "border-accent/70 bg-accent/15 text-foreground" : "border-border bg-secondary/60 text-foreground/85")}>
        {anon ? <AnonAvatar className="h-6 w-6" size={12} /> : <MeAvatar className="h-6 w-6 text-3xs" />}
        <span className="truncate">{anon ? "Anónimo" : `Como ${me.name}`}</span>
        <Ghost size={12} className="shrink-0 opacity-70" />
      </button>
      {buy && <IncognitoSheet onClose={() => setBuy(false)} z={95} />}
    </>
  );
}

function SheetRow({ icon: I, label, onClick, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={"flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-semibold hover:bg-secondary " + (danger ? "text-live" : "text-foreground")}><I size={20} className={danger ? "text-live" : "text-primary"} />{label}</button>;
}

/** Origen de la nueva foto de perfil: cámara frontal, galería o quitarla. */
export function PhotoSourceSheet({ hasPhoto, onClose, onFile, onRemove }: { hasPhoto: boolean; onClose: () => void; onFile: (f: File) => void; onRemove: () => void }) {
  const camera = useRef<HTMLInputElement | null>(null);
  const gallery = useRef<HTMLInputElement | null>(null);
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Elige una foto (JPG, PNG o HEIC)"); return; }
    onFile(f);
  };
  return (
    <BottomSheet title="Foto de perfil" onClose={onClose} z={75}>
      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" aria-label="Hacer una foto" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" aria-label="Elegir una foto" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <SheetRow icon={Camera} label="Hacer una foto" onClick={() => camera.current?.click()} />
      <SheetRow icon={ImageIcon} label="Elegir de la galería" onClick={() => gallery.current?.click()} />
      {hasPhoto && <SheetRow icon={Trash2} label="Quitar foto" danger onClick={onRemove} />}
    </BottomSheet>
  );
}

const OUT = 512;
/** Encuadre circular de la foto: arrastrar para colocar y deslizar para acercar. Devuelve un JPEG cuadrado de 512 px. */
export function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [, setSized] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => { toast.error("No se ha podido abrir esa imagen"); cancel.current(); };
    i.src = url;
  }, [url]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSized((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Medidas en px de diseño (offsetWidth no cambia con la escala de la vista previa). */
  const S = box.current?.offsetWidth || 288;
  const g = img ? (() => {
    const scale = Math.max(S / img.naturalWidth, S / img.naturalHeight) * zoom;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const mx = (w - S) / 2, my = (h - S) / 2;
    return { scale, w, h, x: Math.max(-mx, Math.min(mx, pos.x)), y: Math.max(-my, Math.min(my, pos.y)) };
  })() : null;
  const ratio = () => { const el = box.current; return el ? el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1 : 1; };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => { if (!g) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: g.x, py: g.y }; };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const k = ratio(); setPos({ x: d.px + (e.clientX - d.x) / k, y: d.py + (e.clientY - d.y) / k }); };
  const up = () => { drag.current = null; if (g) setPos({ x: g.x, y: g.y }); };
  const save = () => {
    if (!img || !g) return;
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const ctx = c.getContext("2d");
    if (!ctx) { toast.error("Este navegador no puede recortar la foto"); return; }
    const side = S / g.scale;
    const sx = (g.w / 2 - g.x - S / 2) / g.scale, sy = (g.h / 2 - g.y - S / 2) / g.scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);
    onDone(c.toDataURL("image/jpeg", 0.86));
  };
  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-[520px] flex-col bg-background" role="dialog" aria-modal="true" aria-label="Encuadrar foto de perfil">
      <TopBar title="Encuadra tu foto" sub="Arrastra para colocarla y acerca con el control" onBack={onCancel} close right={<Button size="sm" disabled={!img} onClick={save}>Usar foto</Button>} />
      <main className="flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
        <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="relative aspect-square w-full max-w-[18rem] cursor-grab touch-none select-none overflow-hidden rounded-full bg-secondary shadow-glow ring-2 ring-primary/60 active:cursor-grabbing">
          {img && g
            ? <img src={url} alt="Vista previa de tu foto de perfil" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none" style={{ width: g.w, height: g.h, transform: `translate(calc(-50% + ${g.x}px), calc(-50% + ${g.y}px))` }} />
            : <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Cargando foto…</span>}
        </div>
        <label className="flex w-full max-w-[18rem] items-center gap-3">
          <ZoomOut size={18} className="shrink-0 text-muted-foreground" />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Acercar o alejar la foto" className="h-6 min-w-0 flex-1 accent-primary" />
          <ZoomIn size={18} className="shrink-0 text-muted-foreground" />
        </label>
        <p className="max-w-[18rem] text-center text-2xs text-muted-foreground">Se guarda en este dispositivo y aparece en tu perfil, tus Spots, tus respuestas y tus chats.</p>
      </main>
    </div>
  );
}
