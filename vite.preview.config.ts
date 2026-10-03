import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import postcss, { type AtRule } from "postcss";
import path from "node:path";
import { evalMediaParams, transformValue } from "./preview/phone-css";

/**
 * Build de vista previa estática: un solo HTML que muestra la app dentro de un iPhone en el visor de artifacts.
 * No forma parte de la app de producción (que se compila con vite.config.ts).
 * Uso: npx vite build -c vite.preview.config.ts  →  dist-preview/index.html
 */

/** Adapta el CSS compilado de la app a la pantalla del teléfono (ver preview/phone-css.ts). */
function phoneCss(): Plugin {
  return {
    name: "spotly-preview:phone-css",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
        const root = postcss.parse(String(file.source));
        const media: AtRule[] = [];
        root.walkAtRules("media", (rule) => { media.push(rule); });
        for (const rule of media.reverse()) {
          const result = evalMediaParams(rule.params);
          if (result === true) rule.replaceWith(...(rule.nodes ?? []).slice());
          else if (result === false) rule.remove();
          else rule.params = result;
        }
        root.walkDecls((decl) => { decl.value = transformValue(decl.value); });
        file.source = root.toString();
      }
    },
  };
}

/** El visor de artifacts envuelve la página en su propio <html>/<head>/<body>: se entrega solo el contenido. */
function artifactFragment(): Plugin {
  return {
    name: "spotly-preview:artifact-fragment",
    enforce: "post",
    generateBundle(_options, bundle) {
      const page = bundle["index.html"];
      if (!page || page.type !== "asset") return;
      // Las etiquetas de estructura se quitan solo fuera de <script> y <style>.
      page.source = String(page.source)
        .split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/i)
        .map((chunk, i) => i % 2 === 1 ? chunk : chunk
          .replace(/<!doctype html>/i, "")
          .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "")
          .replace(/<meta (?:charset|name="viewport")[^>]*>/gi, "")
          .replace(/\n\s*\n+/g, "\n"))
        .join("")
        .trim() + "\n";
    },
  };
}

/** Los pesos del detector facial no se usan en la demo (face-api está sustituido por un stub): no se incrustan. */
function skipFaceModels(): Plugin {
  return {
    name: "spotly-preview:skip-face-models",
    enforce: "pre",
    load(id) { return /[\\/]assets[\\/]models[\\/].*\.bin(\?|$)/.test(id) ? 'export default ""' : null; },
  };
}

export default defineConfig({
  root: "preview",
  plugins: [skipFaceModels(), react(), tailwindcss(), phoneCss(), viteSingleFile(), artifactFragment()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@vladmandic/face-api": path.resolve(__dirname, "src/lib/face-api-stub.ts") } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://preview.invalid"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("preview"),
  },
  build: {
    outDir: "../dist-preview",
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
    // Sin esto, rolldown copia cada imagen en base64 en cada sitio donde se usa (el HTML pasaba de 8 MB).
    rolldownOptions: { optimization: { inlineConst: false } },
  },
});
