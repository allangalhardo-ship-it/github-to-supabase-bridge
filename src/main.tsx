import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { notifyUpdateAvailable } from "./components/pwa/UpdateNotification";

// ============================================================================
// SISTEMA DE VERSÕES - ARQUITETURA PROFISSIONAL v3
// ============================================================================
// 
// PRINCÍPIOS:
// 1. NUNCA atualizar automaticamente durante o uso
// 2. O USUÁRIO decide quando atualizar (via banner ou indicador)
// 3. SEM verificação periódica em background (zero polling)
// 4. Verificação única no load da página (opcional no login/refresh)
//
// CAUSA DE "RELOADS AUTOMÁTICOS":
// - Ambiente de preview Lovable: HMR do Vite recarrega a página quando há
//   mudanças no código. Isso é normal durante desenvolvimento.
// - Em produção: PWA NUNCA recarrega automaticamente.
//
// ============================================================================

// Armazena a função de atualização do Service Worker
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

// Registra o Service Worker com modo "prompt" (usuário decide quando atualizar)
// IMPORTANTE: immediate: false = só registra após window.load
const updateSW = registerSW({
  // NÃO registra imediatamente - aguarda o app carregar completamente
  immediate: false,
  
  onNeedRefresh() {
    // Nova versão disponível - SW está em "waiting"
    // Apenas notifica o app, NUNCA força atualização
    console.log('[PWA] Nova versão detectada - aguardando ação do usuário');
    notifyUpdateAvailable();
    
    // Log de debug para identificar momento exato
    if (import.meta.env.DEV) {
      console.log('[PWA Debug] onNeedRefresh chamado em:', new Date().toISOString());
    }
  },
  
  onOfflineReady() {
    console.log('[PWA] App pronto para uso offline');
  },
  
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registrado:', swUrl);
    
    // NÃO fazemos polling/verificação periódica
    // O usuário verá a atualização no próximo refresh natural
    
    // Debug: monitorar eventos do SW para diagnosticar reloads
    if (import.meta.env.DEV && registration) {
      registration.addEventListener('updatefound', () => {
        console.log('[PWA Debug] updatefound event em:', new Date().toISOString());
      });
    }
  },
  
  onRegisterError(error) {
    console.error('[PWA] Erro ao registrar Service Worker:', error);
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
    console.log('[PWA] Aplicando atualização iniciada pelo usuário...');
    updateServiceWorker(true);
  }
};

/**
 * Força verificação de atualização (útil para chamar manualmente)
 * Não causa reload - apenas verifica se há nova versão
 */
export const checkForUpdates = async () => {
  if (!("serviceWorker" in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('[PWA] Verificação manual concluída');
    }
  } catch (error) {
    console.warn('[PWA] Erro na verificação manual:', error);
  }
};

// ============================================================================
// RENDERIZAÇÃO DO APP
// ============================================================================

createRoot(document.getElementById("root")!).render(<App />);
