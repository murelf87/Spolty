import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Index } from "@/routes/index";
import "@/styles.css";
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Index /></QueryClientProvider>);
