import * as React from 'react';
import { cn } from './cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none h-10 px-4';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--nx-color-primary)] text-[var(--nx-color-primary-foreground)]',
  secondary: 'bg-[var(--nx-color-secondary)] text-[var(--nx-color-secondary-foreground)]',
  ghost: 'bg-transparent text-[var(--nx-color-foreground)]',
  destructive: 'bg-[var(--nx-color-destructive)] text-[var(--nx-color-destructive-foreground)]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], className)} {...props} />;
});
