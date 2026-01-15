import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo, LogoMark } from '@/components/brand/Logo';
import TrialBanner from '@/components/subscription/TrialBanner';
import OfflineIndicator from '@/components/layout/OfflineIndicator';
import NotificationSettings from '@/components/layout/NotificationSettings';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
import { useSessionTracker } from '@/hooks/useSessionTracker';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Carrot,
  PackageOpen,
  ShoppingCart,
  Users,
  Calculator,
  FileSpreadsheet,
  SlidersHorizontal,
  LogOut,
  Menu,
  ChefHat,
  Factory,
  Wallet,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/produtos', icon: UtensilsCrossed, label: 'Produtos' },
  { to: '/receitas', icon: ChefHat, label: 'Receitas' },
  { to: '/insumos', icon: Carrot, label: 'Insumos' },
  { to: '/estoque', icon: PackageOpen, label: 'Estoque' },
  { to: '/producao', icon: Factory, label: 'Produção' },
  { to: '/compras', icon: FileSpreadsheet, label: 'Compras' },
  { to: '/movimentacoes', icon: ShoppingCart, label: 'Vendas' },
  { to: '/caixa', icon: Wallet, label: 'Caixa' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/custos-fixos', icon: Calculator, label: 'Custos Fixos' },
  { to: '/configuracoes', icon: SlidersHorizontal, label: 'Configurações' },
];

const SidebarContent = ({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) => {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const allNavItems = isAdmin 
    ? [...navItems, { to: '/admin', icon: Shield, label: 'Admin' }]
    : navItems;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header com logo */}
      <div className="p-5 border-b border-sidebar-border">
        <Logo size="sm" theme="dark" />
        {usuario?.nome && (
          <p className="text-xs text-sidebar-foreground/60 mt-2 truncate">
            {usuario.nome}
          </p>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer com logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-red-300 hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  
  // Track user session
  useSessionTracker();
  
  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);
  
  // Initialize alert notifications
  useAlertNotifications();

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Desktop Sidebar - só aparece em telas grandes */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0">
        <SidebarContent isAdmin={isAdmin} />
      </aside>

      {/* Mobile & Tablet - sidebar escondida, abre via menu */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header fixo - Trial Banner + Navigation */}
        <div className="flex-shrink-0 bg-primary-dark" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Trial Banner */}
          <TrialBanner />
          
          {/* Header mobile com botão menu - compacto */}
          <header className="lg:hidden flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10 active:bg-white/20 h-8 w-8"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 border-0">
                  <SidebarContent onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
                </SheetContent>
              </Sheet>
              <Logo size="xs" theme="dark" />
            </div>
            
            {/* Notification button */}
            <NotificationSettings className="text-white hover:bg-white/10 h-8 w-8" />
          </header>
        </div>

        {/* Main Content - área com scroll */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-auto bg-surface-alt overscroll-contain min-w-0"
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="w-full min-w-0 p-4 md:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default AppLayout;
