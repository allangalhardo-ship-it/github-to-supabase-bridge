import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Evita injeção automática para não duplicar registro (registramos no src/main.tsx)
      injectRegister: null,
      includeAssets: ["favicon.png", "icon-512.png"],
      devOptions: {
        enabled: false, // Disable SW in dev to avoid caching issues
      },
      manifest: {
        name: "GastroGestor",
        short_name: "GastroGestor",
        description: "Gestão para Gastronomia - Food Delivery",
        theme_color: "#22C55E",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Não cachear JS/CSS agressivamente - o Vite já adiciona hashes nos nomes
        globPatterns: ["**/*.{ico,png,svg,woff,woff2}"],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Navegação SEMPRE vai para rede primeiro, sem cache
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML/navegação: SEMPRE busca da rede, cache só como fallback offline
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
            options: {
              cacheName: "pages-cache",
            },
          },
          {
            // JS/CSS: Stale-while-revalidate para pegar novo em background
            urlPattern: /\.(js|css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hora
              },
            },
          },
          {
            urlPattern: /^https:\/\/krpvggbewyqamldhvmyk\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/krpvggbewyqamldhvmyk\.supabase\.co\/storage\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
