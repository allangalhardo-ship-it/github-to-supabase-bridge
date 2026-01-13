import React from 'react';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
}

const sizeMap = {
  sm: { icon: 32, text: 'text-lg' },
  md: { icon: 40, text: 'text-xl' },
  lg: { icon: 56, text: 'text-2xl' },
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
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo Image */}
      <img
        src={logoImage}
        alt="GastroGestor"
        width={iconSize}
        height={iconSize}
        className="flex-shrink-0 object-contain"
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
