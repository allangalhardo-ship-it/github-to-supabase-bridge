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
  // Versão do build (timestamp ISO para diagnóstico)
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // "prompt" = o usuário decide quando atualizar (não atualiza automaticamente)
      registerType: "prompt",
      // Não injeta registro automático - fazemos manualmente no main.tsx
      injectRegister: null,
      includeAssets: ["favicon.png", "icon-512.png"],
      devOptions: {
        enabled: false, // Desabilita SW em dev para evitar problemas de cache
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
        // Só cacheia assets estáticos (imagens, fontes)
        // JS/CSS têm hash no nome, então são automaticamente invalidados
        globPatterns: ["**/*.{ico,png,svg,woff,woff2}"],
        
        // Limpa caches antigos automaticamente
        cleanupOutdatedCaches: true,
        
        // IMPORTANTE: NÃO ativa automaticamente - usuário decide
        // skipWaiting: false (padrão) - SW novo fica em "waiting"
        // clientsClaim: false (padrão) - não toma controle imediatamente
        
        // Navegação sempre vai para a rede
        navigateFallback: null,
        
        runtimeCaching: [
          {
            // HTML/navegação: SEMPRE busca da rede
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
            options: {
              cacheName: "pages-cache",
            },
          },
          {
            // JS/CSS: Rede primeiro, cache como fallback
            urlPattern: /\.(js|css)$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "static-resources",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
              },
              networkTimeoutSeconds: 3, // Se rede demorar mais de 3s, usa cache
            },
          },
          {
            // API Supabase: Rede primeiro
            urlPattern: /^https:\/\/krpvggbewyqamldhvmyk\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutos
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Storage Supabase: Cache com revalidação
            urlPattern: /^https:\/\/krpvggbewyqamldhvmyk\.supabase\.co\/storage\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
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
