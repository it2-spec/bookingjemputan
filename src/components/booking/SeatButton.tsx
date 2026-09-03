// ============================================================
// Seat Button Component
// ============================================================

import { motion } from 'motion/react';
import { Moon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SeatStatus } from '../../lib/types';

interface SeatButtonProps {
  seatNumber: number;
  status: SeatStatus;
  onClick?: () => void;
  bookedByName?: string;
  isOvertime?: boolean;
  size?: 'sm' | 'md';
  isDraggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

const statusStyles: Record<SeatStatus, string> = {
  available:
    'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 hover:border-emerald-400 cursor-pointer',
  booked:
    'bg-red-100 border-red-300 text-red-800 hover:opacity-90',
  selected:
    'bg-amber-100 border-amber-400 text-amber-800 ring-2 ring-amber-400 cursor-pointer',
  disabled:
    'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed',
};

export function SeatButton({
  seatNumber,
  status,
  onClick,
  bookedByName,
  isOvertime = false,
  size = 'md',
  isDraggable = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: SeatButtonProps) {
  const isClickable = !!onClick;

  return (
    <div
      data-seat-number={seatNumber}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        'flex flex-col items-center gap-0.5 select-none relative',
        isDraggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <motion.button
        type="button"
        whileTap={isClickable && !isDraggable ? { scale: 0.9 } : undefined}
        whileHover={isClickable && !isDragging ? { scale: isDragOver ? 1.1 : 1.05 } : undefined}
        onClick={onClick}
        disabled={!isClickable && !isDraggable}
        title={
          bookedByName
            ? `${bookedByName}${isOvertime ? ' (🌙 Terdata Lembur / Off Pulang)' : ''}${isDraggable ? ' (Geser untuk pindah / tukar posisi)' : ''}`
            : `Kursi ${seatNumber}`
        }
        className={cn(
          'seat-shape relative flex items-center justify-center border-2 font-bold transition-all duration-200',
          size === 'sm' ? 'w-11 h-11 text-sm' : 'w-13 h-13 text-base',
          isOvertime
            ? 'bg-purple-100 border-purple-400 text-purple-900 ring-1 ring-purple-300 shadow-2xs'
            : statusStyles[status],
          isClickable && 'cursor-pointer',
          isDraggable && 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400 hover:shadow-md',
          isDragging && 'opacity-40 scale-95 border-dashed border-blue-500 shadow-inner',
          isDragOver && 'ring-4 ring-blue-500 ring-offset-2 scale-110 z-20 shadow-xl bg-blue-100 border-blue-500'
        )}
        aria-label={`Kursi ${seatNumber} - ${
          isOvertime
            ? 'Terdata Lembur (Off Pulang)'
            : status === 'available'
            ? 'Tersedia'
            : status === 'booked'
            ? 'Sudah dipesan'
            : status === 'selected'
            ? 'Dipilih'
            : 'Tidak tersedia'
        }`}
      >
        <span>{seatNumber}</span>

        {/* Overtime Moon Indicator Badge */}
        {isOvertime && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-xs text-[9px]"
            title="Lembur (Tidak Pulang Reguler 16:30)"
          >
            <Moon className="w-2.5 h-2.5" />
          </span>
        )}
      </motion.button>

      {/* Name display below seat number */}
      {(status === 'booked' || status === 'selected') && bookedByName ? (
        <span
          className={cn(
            'text-[9px] font-medium max-w-[60px] truncate leading-tight text-center',
            isOvertime ? 'text-purple-800 font-bold' : 'text-slate-700'
          )}
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
