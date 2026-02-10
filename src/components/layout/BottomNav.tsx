import { NavLink, useLocation } from 'react-router-dom';
import { Store, UtensilsCrossed, Tags, Menu, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onOpenMenu: () => void;
  onOpenVendaRapida: () => void;
}

const navItems = [
  { to: '/dashboard', icon: Store, label: 'Início' },
  { to: '/produtos', icon: UtensilsCrossed, label: 'Produtos' },
  { to: '__venda__', icon: Plus, label: 'Vender', isCta: true },
  { to: '/precificacao', icon: Tags, label: 'Preços' },
  { to: '__menu__', icon: Menu, label: 'Menu' },
];

const BottomNav = ({ onOpenMenu, onOpenVendaRapida }: BottomNavProps) => {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          if (item.to === '__menu__') {
            return (
              <button
                key="menu"
                onClick={onOpenMenu}
                className="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted-foreground active:scale-95 transition-transform"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          if (item.isCta) {
            return (
              <button
                key="venda"
                onClick={onOpenVendaRapida}
                className="flex flex-col items-center justify-center gap-0.5 -mt-4 active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                  <item.icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-semibold text-primary mt-0.5">{item.label}</span>
              </button>
            );
          }

          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-0.5 w-16 h-full active:scale-95 transition-transform"
            >
              <item.icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
