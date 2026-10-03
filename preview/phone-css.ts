/**
 * Reescritura de CSS para que la app se comporte como en un iPhone aunque la ventana sea ancha.
 * Solo se usa en el build de vista previa (vite.preview.config.ts) y en preview/phone-runtime.ts.
 *
 *  - Media queries de anchura: se evalúan a 390 px, así `sm:`, `md:` o `min-[1100px]:` no se activan
 *    dentro del teléfono aunque el navegador mida 1400 px.
 *  - vh/svh/dvh/lvh y vw: pasan a depender de --pv-vh / --pv-vw (1 % de la pantalla del teléfono).
 *  - env(safe-area-inset-*): pasa a depender de --pv-safe-* (insets del iPhone simulado).
 *
 * Si las variables no están definidas, los valores caen a las unidades nativas: el CSS sigue siendo válido.
 */
export const PHONE_WIDTH = 390;

const toPx = (value: string, unit: string) => parseFloat(value) * (/^r?em$/i.test(unit) ? 16 : 1);
const compare = (a: number, op: string, b: number) =>
  op === ">=" ? a >= b : op === "<=" ? a <= b : op === ">" ? a > b : op === "<" ? a < b : a === b;

/** Divide por un separador ignorando lo que va entre paréntesis. */
function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0) {
      const m = separator.exec(text.slice(i));
      if (m && m.index === 0) { parts.push(text.slice(start, i)); i += m[0].length - 1; start = i + 1; }
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const NUM = "(-?[\\d.]+)(px|rem|em)";
const MIN_MAX = new RegExp(`^(min|max)-width\\s*:\\s*${NUM}$`, "i");
const RANGE = new RegExp(`^width\\s*(>=|<=|>|<|=)\\s*${NUM}$`, "i");
const RANGE_REV = new RegExp(`^${NUM}\\s*(>=|<=|>|<|=)\\s*width$`, "i");
const RANGE_BOTH = new RegExp(`^${NUM}\\s*(<=|<)\\s*width\\s*(<=|<)\\s*${NUM}$`, "i");

/** true/false si la condición es de anchura; null si es de otro tipo (hover, color-scheme, print…). */
export function evalWidthCondition(condition: string, width = PHONE_WIDTH): boolean | null {
  let c = condition.trim();
  let negate = false;
  const not = /^not\s*\(([\s\S]*)\)$/i.exec(c);
  if (not) { negate = true; c = not[1]!.trim(); }
  const inner = /^\(([\s\S]*)\)$/.exec(c);
  if (inner) c = inner[1]!.trim();
  let m: RegExpExecArray | null;
  let result: boolean | null = null;
  if ((m = MIN_MAX.exec(c))) result = m[1]!.toLowerCase() === "min" ? width >= toPx(m[2]!, m[3]!) : width <= toPx(m[2]!, m[3]!);
  else if ((m = RANGE.exec(c))) result = compare(width, m[1]!, toPx(m[2]!, m[3]!));
  else if ((m = RANGE_REV.exec(c))) result = compare(toPx(m[1]!, m[2]!), m[3]!, width);
  else if ((m = RANGE_BOTH.exec(c))) result = compare(toPx(m[1]!, m[2]!), m[3]!, width) && compare(width, m[4]!, toPx(m[5]!, m[6]!));
  return result === null ? null : negate ? !result : result;
}

/**
 * Evalúa los parámetros de una @media a la anchura del teléfono.
 * true = se cumple siempre, false = nunca, string = condición restante (sin la parte de anchura).
 */
export function evalMediaParams(params: string, width = PHONE_WIDTH): boolean | string {
  const keep: string[] = [];
  for (const original of splitTop(params, /^,/)) {
    let query = original;
    let negate = false;
    const not = /^not\s+([\s\S]*)$/i.exec(query);
    if (not && !/^not\s*\(/i.test(query)) { negate = true; query = not[1]!; }
    let matches = true;
    const rest: string[] = [];
    for (const part of splitTop(query, /^\s+and\s+/i)) {
      if (/^(only\s+)?(all|screen)$/i.test(part)) continue;
      const value = evalWidthCondition(part, width);
      if (value === null) rest.push(part);
      else if (!value) { matches = false; break; }
    }
    if (negate) {
      if (rest.length) { keep.push(original); continue; }
      matches = !matches;
    }
    if (!matches) continue;
    if (!rest.length) return true;
    keep.push(rest.join(" and "));
  }
  return keep.length ? keep.join(", ") : false;
}

/** Reescribe las @media de un texto CSS (para hojas que inyectan librerías como sonner). */
export function rewriteMediaInCss(css: string, width = PHONE_WIDTH): string {
  return css.replace(/@media([^{;]+)\{/g, (_all, params: string) => {
    const r = evalMediaParams(params, width);
    return r === true ? "@media all{" : r === false ? "@media not all{" : `@media ${r}{`;
  });
}

// Se copian tal cual: url(...) y cadenas (puede haber base64 con secuencias como "5vh") y los var(--pv-…)
// ya reescritos, para que aplicar la transformación dos veces no cambie nada.
const PROTECTED = /(url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|var\(--pv-[\w-]+(?:,(?:[^()]|\([^()]*\))*)?\))/gi;
const VIEWPORT_UNIT = /(^|[^\w.\\-])(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(d|s|l)?v(h|w)(?![\w-])/gi;
const SAFE_AREA = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,[^()]*)?\)/gi;

/** Reescribe un valor de declaración CSS (o de un estilo inline) para el teléfono simulado. */
export function transformValue(value: string): string {
  if (!/v[hw]|safe-area/i.test(value)) return value;
  return value
    .split(PROTECTED)
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk;
      return chunk
        .replace(SAFE_AREA, (_m, side: string, fallback = "") => `var(--pv-safe-${side.toLowerCase()}, env(safe-area-inset-${side.toLowerCase()}${fallback}))`)
        .replace(VIEWPORT_UNIT, (_m, before: string, n: string, kind = "", axis: string) => `${before}calc(var(--pv-v${axis.toLowerCase()}, 1${kind}v${axis}) * ${n})`);
    })
    .join("");
}
