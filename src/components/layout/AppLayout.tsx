import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo, LogoMark } from '@/components/brand/Logo';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Carrot,
  PackageOpen,
  ShoppingCart,
  Calculator,
  FileSpreadsheet,
  SlidersHorizontal,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/produtos', icon: UtensilsCrossed, label: 'Produtos' },
  { to: '/insumos', icon: Carrot, label: 'Insumos' },
  { to: '/estoque', icon: PackageOpen, label: 'Estoque' },
  { to: '/vendas', icon: ShoppingCart, label: 'Vendas' },
  { to: '/custos-fixos', icon: Calculator, label: 'Custos Fixos' },
  { to: '/xml-import', icon: FileSpreadsheet, label: 'Importar NF-e' },
  { to: '/configuracoes', icon: SlidersHorizontal, label: 'Configurações' },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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
          {navItems.map((item) => (
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

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-4 p-4 border-b border-border bg-primary-dark">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-primary-dark/80">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo size="sm" theme="dark" />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-surface-alt">
          <div className="container mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
