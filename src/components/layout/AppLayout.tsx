import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo, LogoMark } from '@/components/brand/Logo';
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
  HelpCircle,
  Info,
  MessageSquare,
  Tags,
  BarChart3,
  Bot,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Crown, Sparkles } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Navigation structure with categories
const navCategories = [
  {
    label: 'Início',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/insumos', icon: Carrot, label: 'Insumos' },
      { to: '/produtos', icon: UtensilsCrossed, label: 'Produtos' },
      { to: '/receitas', icon: ChefHat, label: 'Receitas' },
      { to: '/precificacao', icon: Tags, label: 'Precificação' },
    ],
  },
  {
    label: 'Operações',
    items: [
      { to: '/estoque', icon: PackageOpen, label: 'Estoque' },
      { to: '/producao', icon: Factory, label: 'Produção' },
      { to: '/compras', icon: FileSpreadsheet, label: 'Compras' },
      { to: '/movimentacoes', icon: ShoppingCart, label: 'Vendas' },
    ],
  },
  {
    label: 'Análises',
    items: [
      { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { to: '/caixa', icon: Wallet, label: 'Caixa' },
      { to: '/assistente', icon: Bot, label: 'Assistente IA' },
    ],
  },
  {
    label: 'Configurar',
    items: [
      { to: '/clientes', icon: Users, label: 'Clientes' },
      { to: '/custos-fixos', icon: Calculator, label: 'Custos Fixos' },
      { to: '/configuracoes', icon: SlidersHorizontal, label: 'Configurações' },
      { to: '/meus-dados', icon: Users, label: 'Meus Dados' },
    ],
  },
];

const helpItems = [
  { to: '/sobre', icon: Info, label: 'Sobre' },
  { to: '/faq', icon: HelpCircle, label: 'FAQ' },
  { to: '/contato', icon: MessageSquare, label: 'Contato' },
];

const SidebarContent = ({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) => {
  const { usuario, signOut } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = window.location.pathname;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Add admin item to the last category if user is admin
  const allCategories = isAdmin 
    ? navCategories.map((cat, idx) => 
        idx === navCategories.length - 1 
          ? { ...cat, items: [...cat.items, { to: '/admin', icon: Shield, label: 'Admin' }] }
          : cat
      )
    : navCategories;

  // Check if a category contains the active route
  const isCategoryActive = (items: typeof navCategories[0]['items']) => 
    items.some(item => location === item.to);

  const getPlanBadge = () => {
    if (subscription?.plan === 'pro') {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 text-xs">
          <Crown className="h-3 w-3" />
          Pro
        </Badge>
      );
    }
    if (subscription?.plan === 'standard') {
      return (
        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          Standard
        </Badge>
      );
    }
    // Default: Teste (trial period or expired - both show as Teste)
    const daysRemaining = subscription?.trialDaysRemaining ?? 0;
    const daysText = daysRemaining > 0 
      ? `${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`
      : 'expirado';
    return (
      <NavLink to="/assinatura" onClick={onNavigate}>
        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 gap-1 text-xs cursor-pointer hover:opacity-90">
          Teste ({daysText})
        </Badge>
      </NavLink>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header com logo */}
      <div className="p-5 border-b border-sidebar-border">
        <Logo size="sm" theme="dark" />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            {usuario?.nome && (
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {usuario.nome}
              </p>
            )}
            {isAdmin && (
              <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white border-0 gap-1 text-xs flex-shrink-0">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>
          {getPlanBadge()}
        </div>
      </div>

      {/* Navigation with collapsible categories */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-2">
          {allCategories.map((category) => {
            const isActive = isCategoryActive(category.items);
            // Dashboard (Início) doesn't need collapsible
            if (category.items.length === 1) {
              const item = category.items[0];
              return (
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
              );
            }

            return (
              <Collapsible key={category.label} defaultOpen={isActive}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider hover:text-sidebar-foreground/80 transition-colors">
                  {category.label}
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {category.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-2',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* Seção de Ajuda */}
        <div className="px-3 mt-4 pt-4 border-t border-sidebar-border/50">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider hover:text-sidebar-foreground/80 transition-colors">
              Ajuda
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {helpItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-2',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
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
    <div className="fixed inset-0 flex bg-background overflow-hidden">
      {/* Desktop Sidebar - só aparece em telas grandes */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0">
        <SidebarContent isAdmin={isAdmin} />
      </aside>

      {/* Mobile & Tablet - sidebar escondida, abre via menu */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-hidden">
        {/* Header fixo */}
        <div className="flex-shrink-0 bg-primary-dark w-full max-w-full overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Header mobile com botão menu - compacto */}
          <header className="lg:hidden flex items-center justify-between px-3 py-2 w-full max-w-full">
            <div className="flex items-center gap-2 min-w-0">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10 active:bg-white/20 h-8 w-8 flex-shrink-0"
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
            <NotificationSettings className="text-white hover:bg-white/10 h-8 w-8 flex-shrink-0" />
          </header>
        </div>

        {/* Main Content - área com scroll */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-alt overscroll-contain min-w-0 w-full max-w-full"
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="w-full min-w-0 p-4 md:p-6 max-w-7xl mx-auto box-border">
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
