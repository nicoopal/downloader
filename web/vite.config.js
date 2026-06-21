import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "maskable-512.png"],
      manifest: {
        name: "Pal's Downloader",
        short_name: "Pal's",
        description: "Bajá audio y video de cualquier lado, entre amigos.",
        lang: "es",
        dir: "ltr",
        theme_color: "#4cb91e",
        background_color: "#dff5ff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Aparece en el menú "Compartir" de Android al instalar la PWA.
        // Llega como GET a /share?title=&text=&url= → la app extrae el link.
        share_target: {
          action: "/share",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
});
