// ============================================================
// Empty State Component
// ============================================================

import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      <div className="w-20 h-20 rounded-full bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mb-4">
        <div className="text-primary-500 dark:text-primary-400">{icon}</div>
      </div>
      <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-1 font-[family-name:var(--font-display)]">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-xs mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
