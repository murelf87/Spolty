/** Permite arrastrar con el ratón las tiras horizontales (sin barra visible). En táctil ya funciona de forma nativa. */
export function enableDragScroll(): () => void {
  let el: HTMLElement | null = null; let startX = 0; let startLeft = 0; let moved = false;
  const scroller = (t: EventTarget | null): HTMLElement | null => {
    let n = t instanceof HTMLElement ? t : null;
    while (n && n !== document.body) { const o = getComputedStyle(n).overflowX; if ((o === "auto" || o === "scroll") && n.scrollWidth > n.clientWidth + 2) return n; n = n.parentElement; }
    return null;
  };
  const down = (e: MouseEvent) => { if (e.button !== 0) return; el = scroller(e.target); if (!el) return; startX = e.clientX; startLeft = el.scrollLeft; moved = false; };
  const move = (e: MouseEvent) => { if (!el) return; const dx = e.clientX - startX; if (Math.abs(dx) > 4) moved = true; if (moved) { el.scrollLeft = startLeft - dx; e.preventDefault(); } };
  const up = () => { el = null; };
  const click = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
  document.addEventListener("mousedown", down); document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); document.addEventListener("click", click, true);
  return () => { document.removeEventListener("mousedown", down); document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.removeEventListener("click", click, true); };
}
