// ============================================================
// Skeleton Loading Component
// ============================================================

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const baseStyles: Record<string, string> = {
    text: 'h-4 w-full rounded-md',
    circular: 'h-12 w-12 rounded-full',
    rectangular: 'h-24 w-full rounded-[var(--radius-card)]',
    card: 'h-40 w-full rounded-[var(--radius-card)]',
  };

  return (
    <div
      className={cn('skeleton animate-shimmer', baseStyles[variant], className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a booking card */
export function BookingCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-[var(--radius-card)] border border-surface-100 dark:border-surface-800 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for the seat map */
export function SeatMapSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-40 mx-auto" />
      <div className="max-w-xs mx-auto space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex justify-center gap-3">
            <Skeleton className="h-12 w-12 rounded-[var(--radius-seat)]" />
            <Skeleton className="h-12 w-12 rounded-[var(--radius-seat)]" />
            {i > 0 && <Skeleton className="h-12 w-12 rounded-[var(--radius-seat)]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for route cards */
export function RouteCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-[var(--radius-card)] border border-surface-100 dark:border-surface-800 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}
