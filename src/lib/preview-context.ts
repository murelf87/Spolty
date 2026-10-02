import { createContext, useContext } from "react";

/** true cuando la app se renderiza dentro del frame de preview (iPhone mock) */
export const PreviewCtx = createContext(false);

/** Hook: devuelve "absolute" en modo preview, "fixed" en produccion */
export const usePreview = () => useContext(PreviewCtx);

/** Helper: devuelve la clase de posicion correcta segun el modo */
export const usePos = () => useContext(PreviewCtx) ? "absolute" : "fixed";
