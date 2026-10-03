import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { installPhoneRuntime } from "./phone-runtime";
import { Index } from "@/routes/index";
import "@/styles.css";

// Ajustes del teléfono simulado antes de montar la app (estilos inline, scroll, reloj…).
installPhoneRuntime();

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Index />
  </QueryClientProvider>,
);
