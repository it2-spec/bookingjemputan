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
  seats: Map<number, { status: SeatStatus; bookedBy?: string }>;
  onSeatClick: (seatNumber: number) => void;
}

export function AvanzaSeatLayout({ seats, onSeatClick }: AvanzaSeatLayoutProps) {
  const getSeat = (num: number) =>
    seats.get(num) || { status: 'available' as SeatStatus };

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
          <SeatButton
            seatNumber={1}
            status={getSeat(1).status}
            bookedByName={getSeat(1).bookedBy}
            onClick={() => onSeatClick(1)}
            size="sm"
          />
          <div className="w-11 h-11" />
          <div className="w-11 h-11 rounded-[var(--radius-seat)] bg-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center">
            <span className="text-xs">🚗</span>
            <span className="text-[8px] font-bold text-slate-600 uppercase">Driver</span>
          </div>
        </div>

        {/* Row 2: [2, 3, 4] */}
        <div className="grid grid-cols-3 gap-3 items-center mb-4">
          <SeatButton
            seatNumber={2}
            status={getSeat(2).status}
            bookedByName={getSeat(2).bookedBy}
            onClick={() => onSeatClick(2)}
            size="sm"
          />
          <SeatButton
            seatNumber={3}
            status={getSeat(3).status}
            bookedByName={getSeat(3).bookedBy}
            onClick={() => onSeatClick(3)}
            size="sm"
          />
          <SeatButton
            seatNumber={4}
            status={getSeat(4).status}
            bookedByName={getSeat(4).bookedBy}
            onClick={() => onSeatClick(4)}
            size="sm"
          />
        </div>

        {/* Row 3: [5, 6, null] */}
        <div className="grid grid-cols-3 gap-3 items-center">
          <SeatButton
            seatNumber={5}
            status={getSeat(5).status}
            bookedByName={getSeat(5).bookedBy}
            onClick={() => onSeatClick(5)}
            size="sm"
          />
          <SeatButton
            seatNumber={6}
            status={getSeat(6).status}
            bookedByName={getSeat(6).bookedBy}
            onClick={() => onSeatClick(6)}
            size="sm"
          />
          <div className="w-11 h-11" />
        </div>
      </div>
    </motion.div>
  );
}
