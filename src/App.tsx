import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { queryClient } from "@/lib/queryConfig";
import AppLayout from "@/components/layout/AppLayout";
import PaywallGuard from "@/components/subscription/PaywallGuard";
import UpdateBanner, { useUpdateBanner } from "@/components/pwa/UpdateBanner";
import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
import Assinatura from "@/pages/Assinatura";
import Dashboard from "@/pages/Dashboard";
import Produtos from "@/pages/Produtos";
import Insumos from "@/pages/Insumos";
import Estoque from "@/pages/Estoque";
import Producao from "@/pages/Producao";
import Vendas from "@/pages/Vendas";
import Clientes from "@/pages/Clientes";
import CustosFixos from "@/pages/CustosFixos";
import Configuracoes from "@/pages/Configuracoes";
import XmlImport from "@/pages/XmlImport";
import Compras from "@/pages/Compras";
import Receitas from "@/pages/Receitas";
import Caixa from "@/pages/Caixa";
import Precificacao from "@/pages/Precificacao";
import Relatorios from "@/pages/Relatorios";
import Assistente from "@/pages/Assistente";
import Admin from "@/pages/Admin";
import MeusDados from "@/pages/MeusDados";
import NotFound from "@/pages/NotFound";
import TermosDeUso from "@/pages/TermosDeUso";
import PoliticaPrivacidade from "@/pages/PoliticaPrivacidade";
import Sobre from "@/pages/Sobre";
import Contato from "@/pages/Contato";
import FAQ from "@/pages/FAQ";

// Componente para exibir o banner de atualização
const PWAUpdateBanner = () => {
  const { showBanner, handleUpdate } = useUpdateBanner();
  
  if (!showBanner) return null;
  
  return <UpdateBanner onUpdate={handleUpdate} />;
};

// Component to initialize offline sync
const OfflineSyncProvider = ({ children }: { children: React.ReactNode }) => {
  useOfflineSync();
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
      <Route path="/sobre" element={<Sobre />} />
      <Route path="/contato" element={<Contato />} />
      <Route path="/faq" element={<FAQ />} />
      
      {/* Página de assinatura - acessível para usuários logados, mesmo sem assinatura */}
      <Route path="/assinatura" element={<ProtectedRoute><Assinatura /></ProtectedRoute>} />
      
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
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="xml-import" element={<XmlImport />} />
        <Route path="receitas" element={<Receitas />} />
        <Route path="precificacao" element={<Precificacao />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="assistente" element={<Assistente />} />
        <Route path="admin" element={<Admin />} />
        <Route path="meus-dados" element={<MeusDados />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PWAUpdateBanner />
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
