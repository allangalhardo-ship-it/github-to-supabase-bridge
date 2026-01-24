import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { notifyUpdateAvailable } from "./components/pwa/UpdateNotification";

// ============================================================================
// SISTEMA DE VERSÕES - ARQUITETURA PROFISSIONAL
// ============================================================================
// 
// PRINCÍPIOS:
// 1. NUNCA atualizar automaticamente durante o uso
// 2. O USUÁRIO decide quando atualizar
// 3. Verificação periódica em background (30 min)
// 4. Indicador persistente quando há atualização
//
// FLUXO:
// 1. Usuário abre o app → SW verifica em background
// 2. Nova versão detectada → SW fica em "waiting", app mostra banner
// 3. Usuário clica "Atualizar" → SW ativa, página recarrega
//
// ============================================================================

// Armazena a função de atualização do Service Worker
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

// Intervalo de verificação de atualizações (30 minutos)
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

// Registra o Service Worker com modo "prompt" (usuário decide quando atualizar)
const updateSW = registerSW({
  immediate: true,
  
  onNeedRefresh() {
    // Nova versão disponível - SW está em "waiting"
    // Apenas notifica o app, NÃO força atualização
    console.log('[SW] Nova versão detectada - aguardando ação do usuário');
    notifyUpdateAvailable();
  },
  
  onOfflineReady() {
    console.log('[SW] App pronto para uso offline');
  },
  
  onRegisteredSW(swUrl, registration) {
    console.log('[SW] Service Worker registrado:', swUrl);
    
    // Configura verificação periódica de atualizações
    if (registration) {
      setInterval(() => {
        console.log('[SW] Verificando atualizações...');
        registration.update().catch((err) => {
          console.warn('[SW] Erro ao verificar atualizações:', err);
        });
      }, UPDATE_CHECK_INTERVAL);
    }
  },
  
  onRegisterError(error) {
    console.error('[SW] Erro ao registrar Service Worker:', error);
  },
});

// Armazena referência para uso externo
updateServiceWorker = updateSW;

/**
 * Função exportada para ser chamada quando o usuário clica em "Atualizar"
 * Isso ativa o novo Service Worker e recarrega a página
 */
export const triggerServiceWorkerUpdate = () => {
  if (updateServiceWorker) {
    console.log('[SW] Aplicando atualização...');
    updateServiceWorker(true);
  }
};

/**
 * Força verificação de atualização (útil para chamar manualmente)
 */
export const checkForUpdates = async () => {
  if (!("serviceWorker" in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('[SW] Verificação manual concluída');
    }
  } catch (error) {
    console.warn('[SW] Erro na verificação manual:', error);
  }
};

// Renderiza o app
createRoot(document.getElementById("root")!).render(<App />);
