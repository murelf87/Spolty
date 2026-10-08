/**
 * Ajustes en el navegador para la vista previa en iPhone (solo build de preview).
 * Se llama desde preview/main.tsx antes de montar la app. Es una función exportada y no un import
 * con efectos porque package.json declara "sideEffects": false y el build descartaría el import.
 * El tamaño del teléfono lo calcula el script inline de preview/index.html; aquí va lo que necesita la app:
 *  - estilos inline con vh/env() → mismas variables que el CSS compilado,
 *  - window.scrollTo → desplaza la pantalla del teléfono (#root),
 *  - @media de las hojas que inyectan librerías (sonner) → evaluadas a anchura de móvil,
 *  - reloj real en la barra de estado,
 *  - arrastrar con el ratón desplaza en vertical, como un dedo.
 */
import { rewriteMediaInCss, transformValue } from "./phone-css";

const html = document.documentElement;
let installed = false;
const inFrame = () => !html.classList.contains("pv-bleed");
const screenEl = () => document.getElementById("root");

export function installPhoneRuntime() {
  if (installed) return;
  installed = true;

  /* 1. Estilos inline: React escribe style.top = "max(1rem, env(safe-area-inset-top))", style.maxHeight = "68vh"…
        Se reescribe el atributo style en cuanto cambia (el observador corre antes de pintar). En Chromium las
        propiedades de element.style son propias de cada objeto, así que no se pueden interceptar por prototipo. */
  const fixInline = (el: Element) => {
    const style = el.getAttribute("style");
    if (!style) return;
    const fixed = transformValue(style);
    if (fixed !== style) el.setAttribute("style", fixed);
  };
  const fixTree = (node: Node) => {
    if (!(node instanceof Element)) return;
    fixInline(node);
    node.querySelectorAll("[style]").forEach(fixInline);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") fixInline(r.target as Element);
      else r.addedNodes.forEach(fixTree);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });

  /* 2. La app sube al inicio con window.scrollTo al cambiar de pestaña: aquí quien desplaza es la pantalla. */
  const scrollScreen = (x?: number | ScrollToOptions, y?: number) => {
    const el = screenEl();
    if (!el) return;
    if (typeof x === "object") el.scrollTo(x);
    else el.scrollTo(x ?? 0, y ?? 0);
  };
  window.scrollTo = scrollScreen as typeof window.scrollTo;
  window.scroll = scrollScreen as typeof window.scroll;

  /* 3. Hojas de estilo inyectadas en tiempo de ejecución (sonner usa @media (max-width:600px) para su versión móvil). */
  const fixStyle = (node: Node) => {
    if (!(node instanceof HTMLStyleElement) || node.dataset["pv"]) return;
    node.dataset["pv"] = "1";
    const css = node.textContent ?? "";
    if (!css.includes("@media")) return;
    const fixed = rewriteMediaInCss(css);
    if (fixed !== css) node.textContent = fixed;
  };
  document.querySelectorAll("style").forEach(fixStyle); // sonner ya ha insertado su hoja al evaluarse
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(fixStyle))).observe(document.head, { childList: true });

  /* 4. Reloj de la barra de estado. */
  const tick = () => {
    const el = document.querySelector(".pv-time");
    const now = new Date();
    if (el) el.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  };
  tick();
  window.setInterval(tick, 15_000);

  /* 5. Con ratón, arrastrar en vertical desplaza como un dedo (respeta touch-action:none de grabar audio, mapa…). */
  let scroller: HTMLElement | null = null;
  let startX = 0, startY = 0, startTop = 0, decided = false, dragged = false;
  const allowsPanY = (el: Element) => { const t = getComputedStyle(el).touchAction; return t === "auto" || t === "manipulation" || t.includes("pan-y"); };
  const findScroller = (target: Element): HTMLElement | null => {
    for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
      if (!allowsPanY(el)) return null;
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el as HTMLElement;
    }
    return null;
  };
  window.addEventListener("pointerdown", (e) => {
    scroller = null;
    if (e.pointerType !== "mouse" || e.button !== 0 || !inFrame() || !(e.target instanceof Element)) return;
    if (e.target.closest("input, textarea, select, [contenteditable='true'], [role='slider']")) return;
    scroller = findScroller(e.target);
    startX = e.clientX; startY = e.clientY; startTop = scroller?.scrollTop ?? 0; decided = false;
  }, true);
  window.addEventListener("pointermove", (e) => {
    if (!scroller) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      decided = true;
      if (Math.abs(dy) <= Math.abs(dx)) { scroller = null; return; }
      dragged = true;
      html.classList.add("pv-dragging");
    }
    const scale = parseFloat(html.style.getPropertyValue("--pv-s")) || 1;
    scroller.scrollTop = startTop - dy / scale;
  }, true);
  /* Si la pantalla encaja por páginas (feed de Inicio), al soltar se va a la página siguiente o anterior según el
     sentido del arrastre, igual que un dedo, y luego se reactiva el encaje nativo. */
  const snapAfterDrag = (el: HTMLElement) => {
    if (!html.classList.contains("spot-feed-snap") || el !== screenEl()) return;
    const scale = parseFloat(html.style.getPropertyValue("--pv-s")) || 1;
    const pad = parseFloat(getComputedStyle(el).scrollPaddingTop) || 0;
    const box = el.getBoundingClientRect();
    const stops = [...el.querySelectorAll<HTMLElement>(".spot-feed-page, .spot-feed-snap-start")]
      .map((t) => Math.max(0, Math.min(el.scrollHeight - el.clientHeight, (t.getBoundingClientRect().top - box.top) / scale + el.scrollTop - pad)))
      .sort((a, b) => a - b);
    if (!stops.length) return;
    const nearest = (y: number) => stops.reduce((best, s, i) => (Math.abs(s - y) < Math.abs(stops[best]! - y) ? i : best), 0);
    const from = nearest(startTop), moved = el.scrollTop - startTop;
    const to = Math.abs(moved) > 40 ? Math.min(stops.length - 1, Math.max(0, from + Math.sign(moved))) : from;
    html.classList.add("pv-snapping");
    el.scrollTo({ top: stops[to]!, behavior: "smooth" });
    const done = () => { html.classList.remove("pv-snapping"); el.removeEventListener("scrollend", done); };
    el.addEventListener("scrollend", done);
    window.setTimeout(done, 700);
  };
  const endDrag = () => {
    const el = scroller;
    scroller = null;
    if (el && dragged) snapAfterDrag(el);
    html.classList.remove("pv-dragging");
    window.setTimeout(() => { dragged = false; }, 0);
  };
  window.addEventListener("pointerup", endDrag, true);
  window.addEventListener("pointercancel", endDrag, true);
  window.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  window.addEventListener("dragstart", (e) => { if (inFrame() && e.target instanceof HTMLImageElement) e.preventDefault(); }, true);
}
