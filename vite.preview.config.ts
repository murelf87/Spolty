import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

/** Build de vista previa estática (un solo HTML). No forma parte de la app de producción. */
export default defineConfig({
  root: "preview",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@vladmandic/face-api": path.resolve(__dirname, "src/lib/face-api-stub.ts") } },
  define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://preview.invalid"), "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("preview"), "process.env": "{}" },
  build: { outDir: "../dist-preview", emptyOutDir: true, assetsInlineLimit: 100000000, chunkSizeWarningLimit: 100000, minify: "esbuild" },
});
