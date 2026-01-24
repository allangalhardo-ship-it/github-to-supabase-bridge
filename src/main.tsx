import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { notifyUpdateAvailable } from "./components/pwa/UpdateNotification";

// Variável para armazenar a função de atualização
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

// Registra o Service Worker
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Notifica o app que há atualização disponível
    // O usuário decide quando atualizar
    notifyUpdateAvailable();
  },
  onOfflineReady() {
    console.log("App pronto para uso offline");
  },
});

// Exporta função para atualizar o SW (será chamada pelo UpdateProvider)
updateServiceWorker = updateSW;

export const triggerServiceWorkerUpdate = () => {
  if (updateServiceWorker) {
    updateServiceWorker(true);
  }
};

// Garante que, ao abrir o link publicado, o app tente sempre pegar a versão mais nova
const ensureFreshApp = () => {
  if (!("serviceWorker" in navigator)) return;

  // Evita loop infinito de reload
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

      // Em alguns cenários, pode ficar aguardando; tentamos "adiantar" a ativação
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // silencioso: não quebra o app se o browser bloquear SW
    }
  });
};

ensureFreshApp();

createRoot(document.getElementById("root")!).render(<App />);
