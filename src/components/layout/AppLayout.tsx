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
import { UpdateIndicator } from '@/components/pwa/UpdateNotification';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
import { useSessionTracker } from '@/hooks/useSessionTracker';
import BottomNav from '@/components/layout/BottomNav';
import VendaRapidaSheet from '@/components/vendas/VendaRapidaSheet';
import {
  Store,
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
  BookOpen,
  Settings2,
  BarChart2,
  Sliders,
  LifeBuoy,
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
    icon: null,
    items: [
      { to: '/dashboard', icon: Store, label: 'Meu Negócio' },
    ],
  },
  {
    label: 'Catálogo',
    icon: BookOpen,
    items: [
      { to: '/insumos', icon: Carrot, label: 'Insumos' },
      { to: '/produtos', icon: UtensilsCrossed, label: 'Produtos' },
      { to: '/receitas', icon: ChefHat, label: 'Receitas' },
      { to: '/precificacao', icon: Tags, label: 'Precificação' },
    ],
  },
  {
    label: 'Operações',
    icon: Settings2,
    items: [
      { to: '/estoque', icon: PackageOpen, label: 'Estoque' },
      { to: '/producao', icon: Factory, label: 'Produção' },
      { to: '/compras', icon: FileSpreadsheet, label: 'Compras' },
      { to: '/movimentacoes', icon: ShoppingCart, label: 'Vendas' },
    ],
  },
  {
    label: 'Análises',
    icon: BarChart2,
    items: [
      { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { to: '/caixa', icon: Wallet, label: 'Caixa' },
      { to: '/assistente', icon: Bot, label: 'Assistente IA' },
    ],
  },
  {
    label: 'Configurar',
    icon: Sliders,
    items: [
      { to: '/clientes', icon: Users, label: 'Clientes' },
      { to: '/custos-fixos', icon: Calculator, label: 'Custos Fixos' },
      { to: '/configuracoes', icon: SlidersHorizontal, label: 'Configurações' },
      { to: '/meus-dados', icon: Users, label: 'Meus Dados' },
    ],
  },
];

const helpItems = {
  label: 'Ajuda',
  icon: HelpCircle,
  items: [
    { to: '/sobre', icon: Info, label: 'Sobre' },
    { to: '/faq', icon: HelpCircle, label: 'FAQ' },
    { to: '/contato', icon: MessageSquare, label: 'Contato' },
  ],
};

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
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
                <CollapsibleTrigger className="group flex items-center justify-between w-full px-3 py-2.5 text-[11px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.1em] hover:text-sidebar-foreground/70 transition-colors">
                  <span className="flex items-center gap-2">
                    {category.icon && <category.icon className="h-3.5 w-3.5" />}
                    {category.label}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  {category.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ml-1',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
                            : 'text-sidebar-foreground/80 font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 opacity-80" />
                      {item.label}
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* Seção de Ajuda */}
        <div className="px-3 mt-4 pt-4 border-t border-sidebar-border/30">
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center justify-between w-full px-3 py-2.5 text-[11px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.1em] hover:text-sidebar-foreground/70 transition-colors">
              <span className="flex items-center gap-2">
                <helpItems.icon className="h-3.5 w-3.5" />
                {helpItems.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-300 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-0.5">
              {helpItems.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ml-1',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
                        : 'text-sidebar-foreground/60 font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 opacity-70" />
                  {item.label}
                </NavLink>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Indicador de atualização + Footer com logout */}
      <div className="p-4 border-t border-sidebar-border/30 space-y-2">
        {/* Indicador de atualização na sidebar */}
        <UpdateIndicator 
          showLabel 
          className="w-full justify-start gap-3 text-[13px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-sidebar-accent rounded-md px-3 py-2" 
        />
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[13px] font-medium text-sidebar-foreground/70 hover:text-red-300 hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vendaRapidaOpen, setVendaRapidaOpen] = useState(false);
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
            
            {/* Indicador de atualização + Notification button */}
            <div className="flex items-center gap-1">
              <UpdateIndicator className="text-emerald-400 hover:bg-white/10 h-8 w-8 flex items-center justify-center flex-shrink-0 rounded" />
              <NotificationSettings className="text-white hover:bg-white/10 h-8 w-8 flex-shrink-0" />
            </div>
          </header>
        </div>

        {/* Main Content - área com scroll */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-alt overscroll-contain min-w-0 w-full max-w-full"
          style={{ 
            paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="w-full min-w-0 p-4 md:p-6 pb-24 lg:pb-6 max-w-7xl mx-auto box-border">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Navigation - mobile only */}
      <BottomNav
        onOpenMenu={() => setOpen(true)}
        onOpenVendaRapida={() => setVendaRapidaOpen(true)}
      />

      {/* Venda Rápida Sheet */}
      <VendaRapidaSheet
        open={vendaRapidaOpen}
        onOpenChange={setVendaRapidaOpen}
      />

      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
};

export default AppLayout;
