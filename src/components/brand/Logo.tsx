import React from 'react';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/logo.png';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
}

const sizeMap = {
  xs: { icon: 40, text: 'text-base' },
  sm: { icon: 56, text: 'text-lg' },
  md: { icon: 64, text: 'text-xl' },
  lg: { icon: 88, text: 'text-2xl' },
};

export const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  variant = 'full',
  theme = 'dark',
}) => {
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const textColor = theme === 'dark' ? 'text-white' : 'text-primary-dark';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Logo image — sem fundo branco, já é arredondado */}
      <img
        src={logoImage}
        alt="GastroGestor"
        width={iconSize}
        height={iconSize}
        className="object-contain flex-shrink-0 drop-shadow-md"
        style={{ width: iconSize, height: iconSize }}
      />

      {/* Text logo */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <span className={cn('font-bold leading-tight', textSize, textColor)}>
            Gastro<span className="text-cta">Gestor</span>
            <span className="text-[10px] font-normal opacity-60 ml-1">(beta)</span>
          </span>
          <span className={cn(
            'text-xs font-medium opacity-70',
            theme === 'dark' ? 'text-white' : 'text-muted-foreground'
          )}>
            Gestão Food Delivery
          </span>
        </div>
      )}
    </div>
  );
};

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className,
}) => {
  return (
    <img
      src={logoImage}
      alt="GastroGestor"
      width={size}
      height={size}
      className={cn('object-contain', className)}
    />
  );
};

export default Logo;
