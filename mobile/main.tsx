/**
 * Versión instalable para probar Spotly en un móvil (PWA en modo demostración, sin backend).
 * Se compila con vite.mobile.config.ts y se publica en GitHub Pages. No forma parte de la app de producción.
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

// Service worker con alcance relativo: la app funciona instalada y se abre sin conexión tras la primera visita.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
