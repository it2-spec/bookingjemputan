// ============================================================
// Seat Button Component
// ============================================================

import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { SeatStatus } from '../../lib/types';

interface SeatButtonProps {
  seatNumber: number;
  status: SeatStatus;
  onClick?: () => void;
  bookedByName?: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<SeatStatus, string> = {
  available:
    'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 hover:border-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300 cursor-pointer',
  booked:
    'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300 cursor-not-allowed',
  selected:
    'bg-amber-100 border-amber-400 text-amber-800 ring-2 ring-amber-400 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300 cursor-pointer',
  disabled:
    'bg-surface-100 border-surface-200 text-surface-400 dark:bg-surface-800 dark:border-surface-700 dark:text-surface-500 cursor-not-allowed',
};

export function SeatButton({
  seatNumber,
  status,
  onClick,
  bookedByName,
  size = 'md',
}: SeatButtonProps) {
  const isClickable = status === 'available' || status === 'selected';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.button
        whileTap={isClickable ? { scale: 0.9 } : undefined}
        whileHover={isClickable ? { scale: 1.05 } : undefined}
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        title={bookedByName ? `Dipesan oleh ${bookedByName}` : `Kursi ${seatNumber}`}
        className={cn(
          'seat-shape flex items-center justify-center border-2 font-bold transition-all duration-200',
          size === 'sm' ? 'w-11 h-11 text-sm' : 'w-13 h-13 text-base',
          statusStyles[status]
        )}
        aria-label={`Kursi ${seatNumber} - ${
          status === 'available'
            ? 'Tersedia'
            : status === 'booked'
            ? 'Sudah dipesan'
            : status === 'selected'
            ? 'Dipilih'
            : 'Tidak tersedia'
        }`}
      >
        {seatNumber}
      </motion.button>

      {/* Name display below seat number */}
      {(status === 'booked' || status === 'selected') && bookedByName ? (
        <span
          className="text-[9px] font-medium text-surface-600 dark:text-surface-300 max-w-[60px] truncate leading-tight text-center"
          title={bookedByName}
        >
          {bookedByName.split(' ')[0]}
        </span>
      ) : (
        <span className="text-[9px] opacity-0 h-3">.</span>
      )}
    </div>
  );
}
