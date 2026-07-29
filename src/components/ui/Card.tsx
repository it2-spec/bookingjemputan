// ============================================================
// Card Component
// ============================================================

import { type HTMLAttributes, forwardRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  animate?: boolean;
}

const variantStyles = {
  default:
    'bg-white dark:bg-surface-900 shadow-card border border-surface-100 dark:border-surface-800',
  elevated:
    'bg-white dark:bg-surface-900 shadow-float border border-surface-100 dark:border-surface-800',
  glass: 'glass border border-white/20 dark:border-surface-700/50',
  outlined:
    'bg-transparent border-2 border-surface-200 dark:border-surface-700',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      animate = true,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const Component = animate ? motion.div : 'div';
    const animationProps = animate
      ? {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3 },
        }
      : {};

    return (
      <Component
        ref={ref}
        className={cn(
          'rounded-[var(--radius-card)] transition-all duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          hoverable &&
            'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0',
          className
        )}
        {...animationProps}
        {...(props as any)}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';
