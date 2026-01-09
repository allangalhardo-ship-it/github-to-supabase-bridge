import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
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
import Receitas from "@/pages/Receitas";
import Caixa from "@/pages/Caixa";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <div className="min-h-screen flex items-center justify-center">
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
      
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
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
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="xml-import" element={<XmlImport />} />
        <Route path="receitas" element={<Receitas />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
