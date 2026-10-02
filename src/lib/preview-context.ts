import { createContext, useContext } from "react";

/**
 * En el build de preview, VITE_PREVIEW_MODE="1" se define en vite.preview.config.ts.
 * En produccion, la variable no existe → isPreview = false.
 * Esto se resuelve en TIEMPO DE COMPILACION — no hay overhead en runtime.
 */
const IS_PREVIEW = import.meta.env.VITE_PREVIEW_MODE === "1";

export const PreviewCtx = createContext(IS_PREVIEW);

export const usePreview = () => useContext(PreviewCtx);

/** "absolute" en preview, "fixed" en produccion */
export const usePos = () => (IS_PREVIEW ? "absolute" : "fixed");
