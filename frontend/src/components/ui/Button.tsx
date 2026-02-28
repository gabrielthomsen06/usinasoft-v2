import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-orange-600 focus:ring-orange-300 disabled:bg-orange-300',
  secondary:
    'bg-secondary text-white hover:bg-gray-700 focus:ring-gray-400 disabled:bg-gray-400',
  outline:
    'bg-transparent text-primary border border-primary hover:bg-orange-50 focus:ring-orange-200 disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-300 disabled:bg-red-300',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
        'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
