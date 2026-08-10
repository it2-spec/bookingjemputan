// ============================================================
// Route Card Component
// ============================================================

import { motion } from 'motion/react';
import { Clock, Users, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface RouteCardProps {
  routeName: string;
  departureTime: string;
  confirmedCount?: number;
  maxSeats?: number;
  isSelected?: boolean;
  isFull?: boolean;
  onClick?: () => void;
  delay?: number;
}

const routeIcons: Record<string, string> = {
  'Karawang Barat': '🏭',
  'Karawang Timur': '🏢',
  'Cikampek': '🏗️',
};

export function RouteCard({
  routeName,
  departureTime,
  confirmedCount,
  maxSeats,
  isSelected = false,
  isFull = false,
  onClick,
  delay: animDelay = 0,
}: RouteCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: animDelay }}
    >
      <Card
        hoverable={!isFull}
        className={cn(
          'relative overflow-hidden cursor-pointer',
          isSelected && 'ring-2 ring-primary-500 border-primary-200 dark:border-primary-700',
          isFull && 'opacity-60 cursor-not-allowed'
        )}
        onClick={isFull ? undefined : onClick}
        animate={false}
      >
        <div className="flex items-center gap-3">
          {/* Route icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0',
              isSelected
                ? 'bg-primary-100'
                : 'bg-slate-100'
            )}
          >
            {routeIcons[routeName] || '🚌'}
          </div>

          {/* Route info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 font-[family-name:var(--font-display)]">
              {routeName}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5" />
                {departureTime} WIB
              </span>
              {confirmedCount !== undefined && maxSeats !== undefined && (
                <span className="flex items-center gap-1 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                  {confirmedCount}/{maxSeats}
                </span>
              )}
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 shrink-0">
            {isFull ? (
              <Badge variant="danger" size="sm">
                Penuh
              </Badge>
            ) : confirmedCount !== undefined ? (
              <Badge
                variant={confirmedCount > 0 ? 'info' : 'success'}
                size="sm"
                dot
              >
                {confirmedCount > 0 ? `${confirmedCount} kursi` : 'Tersedia'}
              </Badge>
            ) : null}
            {!isFull && (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <motion.div
            layoutId="route-selected"
            className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </Card>
    </motion.div>
  );
}
