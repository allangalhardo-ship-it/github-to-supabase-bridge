import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  prefix?: string;
}

/**
 * Input monetário com máscara brasileira (R$ 1.234,56).
 * Internamente armazena o valor numérico como string (ex: "1234.56")
 * para compatibilidade com parseFloat.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  id,
  className,
  disabled,
  prefix = 'R$',
}: CurrencyInputProps) {
  const formatDisplay = useCallback((numericValue: string): string => {
    if (!numericValue || numericValue === '0' || numericValue === '') return '';
    const num = parseFloat(numericValue);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));

  // Sync display when external value changes (e.g. form reset)
  React.useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value, formatDisplay]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow only digits, comma and dot
    const cleaned = raw.replace(/[^\d.,]/g, '');
    setDisplayValue(cleaned);
  };

  const handleBlur = () => {
    if (!displayValue) {
      onChange('');
      return;
    }

    // Convert Brazilian format to numeric: 1.234,56 -> 1234.56
    let normalized = displayValue
      .replace(/\./g, '') // remove thousand separators
      .replace(',', '.'); // convert decimal comma to dot

    const num = parseFloat(normalized);
    if (isNaN(num) || num < 0) {
      setDisplayValue('');
      onChange('');
      return;
    }

    const numStr = num.toFixed(2);
    onChange(numStr);
    setDisplayValue(formatDisplay(numStr));
  };

  const handleFocus = () => {
    // On focus, show raw number for easier editing
    if (value && parseFloat(value) > 0) {
      const num = parseFloat(value);
      setDisplayValue(num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }));
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={cn(prefix ? 'pl-10' : '', className)}
        disabled={disabled}
      />
    </div>
  );
}

interface PercentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Input percentual com máscara (ex: 12,5%).
 * Armazena internamente como string numérica (ex: "12.5").
 */
export function PercentInput({
  value,
  onChange,
  placeholder = '0,0',
  id,
  className,
  disabled,
}: PercentInputProps) {
  const formatDisplay = useCallback((numericValue: string): string => {
    if (!numericValue || numericValue === '0' || numericValue === '') return '';
    const num = parseFloat(numericValue);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  }, []);

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));

  React.useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value, formatDisplay]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d.,]/g, '');
    setDisplayValue(cleaned);
  };

  const handleBlur = () => {
    if (!displayValue) {
      onChange('');
      return;
    }

    let normalized = displayValue
      .replace(/\./g, '')
      .replace(',', '.');

    const num = parseFloat(normalized);
    if (isNaN(num) || num < 0) {
      setDisplayValue('');
      onChange('');
      return;
    }

    const numStr = num.toString();
    onChange(numStr);
    setDisplayValue(formatDisplay(numStr));
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn('pr-8', className)}
        disabled={disabled}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
        %
      </span>
    </div>
  );
}
