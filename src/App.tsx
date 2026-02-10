import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
// Force rebuild v2
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { queryClient } from "@/lib/queryConfig";
import AppLayout from "@/components/layout/AppLayout";
import PaywallGuard from "@/components/subscription/PaywallGuard";
import { 
  UpdateProvider, 
  UpdateBanner, 
  useServiceWorkerIntegration 
} from "@/components/pwa/UpdateNotification";
import { triggerServiceWorkerUpdate } from "./main";

// Lazy-loaded pages (Code Splitting)
const Login = lazy(() => import("@/pages/Login"));
const Cadastro = lazy(() => import("@/pages/Cadastro"));
const Assinatura = lazy(() => import("@/pages/Assinatura"));
const PagamentoSucesso = lazy(() => import("@/pages/PagamentoSucesso"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const Insumos = lazy(() => import("@/pages/Insumos"));
const Estoque = lazy(() => import("@/pages/Estoque"));
const Producao = lazy(() => import("@/pages/Producao"));
const Vendas = lazy(() => import("@/pages/Vendas"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const CustosFixos = lazy(() => import("@/pages/CustosFixos"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const XmlImport = lazy(() => import("@/pages/XmlImport"));
const Compras = lazy(() => import("@/pages/Compras"));
const Receitas = lazy(() => import("@/pages/Receitas"));
const Caixa = lazy(() => import("@/pages/Caixa"));
const Precificacao = lazy(() => import("@/pages/Precificacao"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Assistente = lazy(() => import("@/pages/Assistente"));
const Admin = lazy(() => import("@/pages/Admin"));
const MeusDados = lazy(() => import("@/pages/MeusDados"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const TermosDeUso = lazy(() => import("@/pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("@/pages/PoliticaPrivacidade"));
const Sobre = lazy(() => import("@/pages/Sobre"));
const Contato = lazy(() => import("@/pages/Contato"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const VerificarEmail = lazy(() => import("@/pages/VerificarEmail"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ImportarBackup = lazy(() => import("@/pages/ImportarBackup"));
const Cardapio = lazy(() => import("@/pages/Cardapio"));
const CardapioDigital = lazy(() => import("@/pages/CardapioDigital"));

// Loading fallback component
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

// Componente que integra o Service Worker com o sistema de notificações
const ServiceWorkerIntegration = () => {
  useServiceWorkerIntegration();
  return null;
};

// Component to initialize offline sync
const OfflineSyncProvider = ({ children }: { children: React.ReactNode }) => {
  useOfflineSync();
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Landing page pública */}
        <Route path="/home" element={<LandingPage />} />
        
        {/* Cardápio público - não requer login */}
        <Route path="/cardapio/:slug" element={<Cardapio />} />
        
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
        <Route path="/verificar-email" element={<VerificarEmail />} />
        <Route path="/termos-de-uso" element={<TermosDeUso />} />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/contato" element={<Contato />} />
        <Route path="/faq" element={<FAQ />} />
        
        {/* Página de assinatura - acessível para usuários logados, mesmo sem assinatura */}
        <Route path="/assinatura" element={<ProtectedRoute><Assinatura /></ProtectedRoute>} />
        <Route path="/pagamento-sucesso" element={<ProtectedRoute><PagamentoSucesso /></ProtectedRoute>} />
        
        {/* Rotas protegidas por paywall */}
        <Route path="/" element={
          <ProtectedRoute>
            <PaywallGuard>
              <AppLayout />
            </PaywallGuard>
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="insumos" element={<Insumos />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="producao" element={<Producao />} />
          <Route path="movimentacoes" element={<Vendas />} />
          <Route path="vendas" element={<Navigate to="/movimentacoes" replace />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="custos-fixos" element={<CustosFixos />} />
          <Route path="caixa" element={<Caixa />} />
          <Route path="compras" element={<Compras />} />
          <Route path="cardapio-digital" element={<CardapioDigital />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="xml-import" element={<XmlImport />} />
          <Route path="receitas" element={<Receitas />} />
          <Route path="precificacao" element={<Precificacao />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="assistente" element={<Assistente />} />
          <Route path="admin" element={<Admin />} />
          <Route path="meus-dados" element={<MeusDados />} />
          <Route path="importar-backup" element={<ImportarBackup />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UpdateProvider onUpdate={triggerServiceWorkerUpdate}>
        <ServiceWorkerIntegration />
        <UpdateBanner />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <OfflineSyncProvider>
                <AppRoutes />
              </OfflineSyncProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </UpdateProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
