import React from 'react';
import { cn } from '@/lib/utils';

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
      {/* Custom SVG Logo Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Background circle */}
        <circle cx="32" cy="32" r="30" fill="#34C759" />
        
        {/* Inner gradient overlay */}
        <circle cx="32" cy="32" r="26" fill="#3BAF63" />
        
        {/* Chef hat - top */}
        <ellipse cx="32" cy="20" rx="14" ry="8" fill="white" />
        <rect x="20" y="18" width="24" height="12" rx="2" fill="white" />
        
        {/* Chef hat - band */}
        <rect x="18" y="28" width="28" height="6" rx="1" fill="#0D773B" />
        
        {/* Plate */}
        <ellipse cx="32" cy="46" rx="18" ry="6" fill="white" opacity="0.95" />
        <ellipse cx="32" cy="44" rx="14" ry="4" fill="#E8F6ED" />
        
        {/* Steam lines */}
        <path
          d="M26 38 C26 36, 28 36, 28 38 C28 40, 26 40, 26 38"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <path
          d="M32 36 C32 34, 34 34, 34 36 C34 38, 32 38, 32 36"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <path
          d="M38 38 C38 36, 40 36, 40 38 C40 40, 38 40, 38 38"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        
        {/* Decorative dots */}
        <circle cx="22" cy="14" r="2" fill="white" opacity="0.6" />
        <circle cx="42" cy="14" r="2" fill="white" opacity="0.6" />
      </svg>

      {/* Text logo */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <span className={cn('font-bold leading-tight', textSize, textColor)}>
            Gastro<span className="text-cta">Gestor</span>
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="#34C759" />
      
      {/* Inner gradient overlay */}
      <circle cx="32" cy="32" r="26" fill="#3BAF63" />
      
      {/* Chef hat - top */}
      <ellipse cx="32" cy="20" rx="14" ry="8" fill="white" />
      <rect x="20" y="18" width="24" height="12" rx="2" fill="white" />
      
      {/* Chef hat - band */}
      <rect x="18" y="28" width="28" height="6" rx="1" fill="#0D773B" />
      
      {/* Plate */}
      <ellipse cx="32" cy="46" rx="18" ry="6" fill="white" opacity="0.95" />
      <ellipse cx="32" cy="44" rx="14" ry="4" fill="#E8F6ED" />
      
      {/* Steam lines */}
      <path
        d="M26 38 C26 36, 28 36, 28 38 C28 40, 26 40, 26 38"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M32 36 C32 34, 34 34, 34 36 C34 38, 32 38, 32 36"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M38 38 C38 36, 40 36, 40 38 C40 40, 38 40, 38 38"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      
      {/* Decorative dots */}
      <circle cx="22" cy="14" r="2" fill="white" opacity="0.6" />
      <circle cx="42" cy="14" r="2" fill="white" opacity="0.6" />
    </svg>
  );
};

export default Logo;
