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
  xs: { icon: 36, text: 'text-base', padding: 'p-1' },
  sm: { icon: 48, text: 'text-lg', padding: 'p-1.5' },
  md: { icon: 56, text: 'text-xl', padding: 'p-1.5' },
  lg: { icon: 72, text: 'text-2xl', padding: 'p-1.5' },
};

export const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  variant = 'full',
  theme = 'dark',
}) => {
  const { icon: iconSize, text: textSize, padding } = sizeMap[size];
  
  const textColor = theme === 'dark' ? 'text-white' : 'text-primary-dark';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Image with white background */}
      <div className={cn('bg-white rounded-xl shadow-sm flex-shrink-0', padding)}>
        <img
          src={logoImage}
          alt="GastroGestor"
          width={iconSize}
          height={iconSize}
          className="object-contain"
        />
      </div>

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
