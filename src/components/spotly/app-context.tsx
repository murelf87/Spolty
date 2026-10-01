import { createContext, useContext } from "react";
import type { Sheet } from "./Extras";

/** Acciones globales de navegación que cualquier pantalla puede invocar. */
export type AppActions = {
  open: (s: Sheet) => void;
  openHot: (id: string) => void;
  openBiz: (id: string) => void;
  openIncognitoSpot: () => void;
  openPhotoWall: (place?: string) => void;
  goMap: () => void;
  create: () => void;
};
const noop = () => {};
export const AppCtx = createContext<AppActions>({ open: noop, openHot: noop, openBiz: noop, openIncognitoSpot: noop, openPhotoWall: noop, goMap: noop, create: noop });
export const useApp = () => useContext(AppCtx);
