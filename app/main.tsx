/**
 * Apps nativas de iPhone y Android (Capacitor): la app de producción como web estática empaquetada en la app, con la
 * nube activada. Se compila con vite.app.config.ts (ver docs/APPS_NATIVAS.md). Sin service worker: Capacitor ya
 * sirve los archivos desde el propio móvil.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Index } from "@/routes/index";
import "@/styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Index />
  </QueryClientProvider>,
);
