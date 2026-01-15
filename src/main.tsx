import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Atualização automática do PWA: quando uma nova versão estiver disponível,
// força a troca do Service Worker e recarrega o app.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // true => recarrega a página após ativar o novo SW
    updateSW(true);
  },
});

// Garante que, ao abrir o link publicado, o app tente sempre pegar a versão mais nova
// (evita ficar “preso” em cache do Service Worker / PWA).
const ensureFreshApp = () => {
  if (!("serviceWorker" in navigator)) return;

  // Evita loop infinito de reload caso algo dê errado
  const RELOAD_FLAG = "gg_sw_reloaded";

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      // Força o navegador a checar se existe SW/versão nova
      await reg.update();

      // Em alguns cenários, pode ficar aguardando; tentamos “adiantar” a ativação
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // silencioso: não quebra o app se o browser bloquear SW
    }
  });
};

ensureFreshApp();

createRoot(document.getElementById("root")!).render(<App />);

