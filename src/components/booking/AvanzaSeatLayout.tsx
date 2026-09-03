// ============================================================
// Avanza Seat Layout (6 Passenger Seats + Driver)
// ============================================================
// Layout Grid (3 Columns):
// Row 1: [  1   ] [ null ] [DRIVER]
// Row 2: [  2   ] [  3   ] [  4   ]
// Row 3: [  5   ] [  6   ] [ null ]

import { motion } from 'motion/react';
import { SeatButton } from './SeatButton';
import type { SeatStatus } from '../../lib/types';

interface AvanzaSeatLayoutProps {
  seats: Map<number, { status: SeatStatus; bookedBy?: string; isOvertime?: boolean }>;
  onSeatClick: (seatNumber: number) => void;
  allowDragDrop?: boolean;
  draggingSeat?: number | null;
  dragOverSeat?: number | null;
  onDragStart?: (seatNumber: number, e: React.DragEvent) => void;
  onDragOver?: (seatNumber: number, e: React.DragEvent) => void;
  onDragLeave?: (seatNumber: number, e: React.DragEvent) => void;
  onDrop?: (seatNumber: number, e: React.DragEvent) => void;
  onTouchStart?: (seatNumber: number, e: React.TouchEvent) => void;
  onTouchMove?: (seatNumber: number, e: React.TouchEvent) => void;
  onTouchEnd?: (seatNumber: number, e: React.TouchEvent) => void;
}

export function AvanzaSeatLayout({
  seats,
  onSeatClick,
  allowDragDrop = false,
  draggingSeat = null,
  dragOverSeat = null,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: AvanzaSeatLayoutProps) {
  const getSeat = (num: number) =>
    seats.get(num) || { status: 'available' as SeatStatus };

  const renderSeat = (num: number) => {
    const seatInfo = getSeat(num);
    const hasPassenger = Boolean(seatInfo.bookedBy) || seatInfo.status === 'booked' || seatInfo.status === 'selected';
    const isDraggable = Boolean(allowDragDrop && hasPassenger);
    const isDragging = draggingSeat === num;
    const isDragOver = dragOverSeat === num && draggingSeat !== num;

    return (
      <SeatButton
        seatNumber={num}
        status={seatInfo.status}
        bookedByName={seatInfo.bookedBy}
        isOvertime={seatInfo.isOvertime}
        onClick={() => onSeatClick(num)}
        size="sm"
        isDraggable={isDraggable}
        isDragging={isDragging}
        isDragOver={isDragOver}
        onDragStart={(e) => onDragStart?.(num, e)}
        onDragOver={(e) => onDragOver?.(num, e)}
        onDragLeave={(e) => onDragLeave?.(num, e)}
        onDrop={(e) => onDrop?.(num, e)}
        onTouchStart={(e) => onTouchStart?.(num, e)}
        onTouchMove={(e) => onTouchMove?.(num, e)}
        onTouchEnd={(e) => onTouchEnd?.(num, e)}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center"
    >
      {/* Vehicle outline */}
      <div className="relative bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 pt-7 pb-8 w-[240px]">
        {/* Windshield */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-primary-100 border-2 border-slate-200 rounded-t-2xl flex items-center justify-center">
          <span className="text-[9px] font-semibold text-primary-600 uppercase tracking-wider">
            Depan
          </span>
        </div>

        {/* Row 1: [1, null, DRIVER] */}
        <div className="grid grid-cols-3 gap-3 items-center mb-4">
          {renderSeat(1)}
          <div className="w-11 h-11" />
          <div className="w-11 h-11 rounded-[var(--radius-seat)] bg-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center">
            <span className="text-xs">🚗</span>
            <span className="text-[8px] font-bold text-slate-600 uppercase">Driver</span>
          </div>
        </div>

        {/* Row 2: [2, 3, 4] */}
        <div className="grid grid-cols-3 gap-3 items-center mb-4">
          {renderSeat(2)}
          {renderSeat(3)}
          {renderSeat(4)}
        </div>

        {/* Row 3: [5, 6, null] */}
        <div className="grid grid-cols-3 gap-3 items-center">
          {renderSeat(5)}
          {renderSeat(6)}
          <div className="w-11 h-11" />
        </div>
      </div>
    </motion.div>
  );
}
