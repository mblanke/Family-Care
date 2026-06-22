import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Home Board",
        short_name: "Home Board",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6feb",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8000", "/healthz": "http://localhost:8000" } },
});
