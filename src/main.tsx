import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { setUpdateCallback, triggerUpdateBanner } from "./components/pwa/UpdateBanner";

// Registra o Service Worker com callback para atualização
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Apenas mostra o banner - NÃO força atualização automática
    // O usuário decide quando atualizar clicando no banner
    triggerUpdateBanner();
  },
  onOfflineReady() {
    console.log("App pronto para uso offline");
  },
});

// Define o callback que será chamado quando o usuário clicar em "Atualizar"
setUpdateCallback(() => {
  updateSW(true);
});

// Garante que, ao abrir o link publicado, o app tente sempre pegar a versão mais nova
// (evita ficar "preso" em cache do Service Worker / PWA).
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

      // Em alguns cenários, pode ficar aguardando; tentamos "adiantar" a ativação
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // silencioso: não quebra o app se o browser bloquear SW
    }
  });
};

ensureFreshApp();

createRoot(document.getElementById("root")!).render(<App />);
