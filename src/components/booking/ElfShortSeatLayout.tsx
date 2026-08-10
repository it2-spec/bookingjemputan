// ============================================================
// Elf Short Seat Layout (14 Passenger Seats + Driver)
// ============================================================
// Layout Grid (4 Columns):
// Row 1: [  1   ] [ null ] [ null ] [DRIVER]
// Row 2: [ null ] [  2   ] [  3   ] [  4   ]
// Row 3: [ null ] [  5   ] [  6   ] [  7   ]
// Row 4: [ null ] [  8   ] [  9   ] [ 10   ]
// Row 5: [ 11   ] [ 12   ] [ 13   ] [ 14   ]

import { motion } from 'motion/react';
import { SeatButton } from './SeatButton';
import type { SeatStatus } from '../../lib/types';

interface ElfShortSeatLayoutProps {
  seats: Map<number, { status: SeatStatus; bookedBy?: string }>;
  onSeatClick: (seatNumber: number) => void;
}

export function ElfShortSeatLayout({ seats, onSeatClick }: ElfShortSeatLayoutProps) {
  const getSeat = (num: number) =>
    seats.get(num) || { status: 'available' as SeatStatus };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center"
    >
      <div className="relative bg-slate-50 border-2 border-slate-200 rounded-3xl p-4 pt-7 pb-8 w-[290px]">
        {/* Windshield */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-36 h-6 bg-primary-100 border-2 border-slate-200 rounded-t-2xl flex items-center justify-center">
          <span className="text-[9px] font-semibold text-primary-600 uppercase tracking-wider">
            Depan
          </span>
        </div>

        {/* Row 1: [1, null, null, DRIVER] */}
        <div className="grid grid-cols-4 gap-2 items-center mb-3">
          <SeatButton
            seatNumber={1}
            status={getSeat(1).status}
            bookedByName={getSeat(1).bookedBy}
            onClick={() => onSeatClick(1)}
            size="sm"
          />
          <div className="w-11 h-11" />
          <div className="w-11 h-11" />
          <div className="w-11 h-11 rounded-[var(--radius-seat)] bg-slate-200 border-2 border-slate-300 flex flex-col items-center justify-center">
            <span className="text-xs">🚐</span>
            <span className="text-[8px] font-bold text-slate-600 uppercase">Driver</span>
          </div>
        </div>

        {/* Row 2: [null, 2, 3, 4] */}
        <div className="grid grid-cols-4 gap-2 items-center mb-3">
          <div className="w-11 h-11" />
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

        {/* Row 3: [null, 5, 6, 7] */}
        <div className="grid grid-cols-4 gap-2 items-center mb-3">
          <div className="w-11 h-11" />
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
          <SeatButton
            seatNumber={7}
            status={getSeat(7).status}
            bookedByName={getSeat(7).bookedBy}
            onClick={() => onSeatClick(7)}
            size="sm"
          />
        </div>

        {/* Row 4: [null, 8, 9, 10] */}
        <div className="grid grid-cols-4 gap-2 items-center mb-3">
          <div className="w-11 h-11" />
          <SeatButton
            seatNumber={8}
            status={getSeat(8).status}
            bookedByName={getSeat(8).bookedBy}
            onClick={() => onSeatClick(8)}
            size="sm"
          />
          <SeatButton
            seatNumber={9}
            status={getSeat(9).status}
            bookedByName={getSeat(9).bookedBy}
            onClick={() => onSeatClick(9)}
            size="sm"
          />
          <SeatButton
            seatNumber={10}
            status={getSeat(10).status}
            bookedByName={getSeat(10).bookedBy}
            onClick={() => onSeatClick(10)}
            size="sm"
          />
        </div>

        {/* Row 5: [11, 12, 13, 14] */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <SeatButton
            seatNumber={11}
            status={getSeat(11).status}
            bookedByName={getSeat(11).bookedBy}
            onClick={() => onSeatClick(11)}
            size="sm"
          />
          <SeatButton
            seatNumber={12}
            status={getSeat(12).status}
            bookedByName={getSeat(12).bookedBy}
            onClick={() => onSeatClick(12)}
            size="sm"
          />
          <SeatButton
            seatNumber={13}
            status={getSeat(13).status}
            bookedByName={getSeat(13).bookedBy}
            onClick={() => onSeatClick(13)}
            size="sm"
          />
          <SeatButton
            seatNumber={14}
            status={getSeat(14).status}
            bookedByName={getSeat(14).bookedBy}
            onClick={() => onSeatClick(14)}
            size="sm"
          />
        </div>
      </div>
    </motion.div>
  );
}
