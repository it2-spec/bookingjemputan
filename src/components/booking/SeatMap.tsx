// ============================================================
// Seat Map Component — Orchestrates Vehicle Layouts
// ============================================================

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AvanzaSeatLayout } from './AvanzaSeatLayout';
import { ElfShortSeatLayout } from './ElfShortSeatLayout';
import { ElfLongSeatLayout } from './ElfLongSeatLayout';
import type { Booking, SeatStatus, VehicleType } from '../../lib/types';
import { getVehicleIcon } from '../../lib/utils';
import { VEHICLE_LABELS } from '../../lib/constants';

interface SeatMapProps {
  vehicleType: VehicleType;
  bookings: Booking[];
  selectedSeat: number | null;
  onSeatSelect: (seatNumber: number) => void;
  onSeatClickWithBooking?: (seatNumber: number, booking?: Booking) => void;
  allowBookedClick?: boolean;
  currentEmployeeId?: string;
}

export function SeatMap({
  vehicleType,
  bookings,
  selectedSeat,
  onSeatSelect,
  onSeatClickWithBooking,
  allowBookedClick = false,
}: SeatMapProps) {
  // Build seat status map
  const seatMap = useMemo(() => {
    const map = new Map<number, { status: SeatStatus; bookedBy?: string; isOvertime?: boolean; booking?: Booking }>();

    // Mark booked seats
    for (const booking of bookings) {
      if (booking.status === 'confirmed') {
        map.set(booking.seat_number, {
          status: 'booked',
          bookedBy: (booking as any).employee?.name || 'Penumpang',
          isOvertime: Boolean((booking as any).is_overtime_no_return),
          booking: booking,
        });
      }
    }

    // Mark selected seat (e.g. employee's own seat during preview/booking)
    if (selectedSeat !== null) {
      const existing = map.get(selectedSeat);
      map.set(selectedSeat, {
        status: 'selected',
        bookedBy: existing?.bookedBy || 'Anda',
        isOvertime: existing?.isOvertime,
        booking: existing?.booking,
      });
    }

    return map;
  }, [bookings, selectedSeat]);

  const handleSeatClick = (seatNumber: number) => {
    const seatInfo = seatMap.get(seatNumber);
    if (onSeatClickWithBooking) {
      onSeatClickWithBooking(seatNumber, seatInfo?.booking);
    }
    if (allowBookedClick) {
      onSeatSelect(seatNumber);
      return;
    }
    if (seatInfo?.status === 'booked') return;
    onSeatSelect(seatNumber);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Vehicle type label */}
      <motion.div
        key={vehicleType}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary-50 border border-primary-200"
      >
        <span className="text-lg">{getVehicleIcon(vehicleType)}</span>
        <span className="text-sm font-bold text-primary-700">
          {VEHICLE_LABELS[vehicleType]}
        </span>
      </motion.div>

      {/* Vehicle layout */}
      <AnimatePresence mode="wait">
        <motion.div
          key={vehicleType}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          {vehicleType === 'Avanza' && (
            <AvanzaSeatLayout seats={seatMap} onSeatClick={handleSeatClick} />
          )}
          {vehicleType === 'Elf Short' && (
            <ElfShortSeatLayout seats={seatMap} onSeatClick={handleSeatClick} />
          )}
          {vehicleType === 'Elf Long' && (
            <ElfLongSeatLayout seats={seatMap} onSeatClick={handleSeatClick} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {[
          { color: 'bg-emerald-100 border-emerald-300', label: 'Tersedia' },
          { color: 'bg-red-100 border-red-300', label: 'Dipesan (Reguler)' },
          { color: 'bg-purple-100 border-purple-400', label: 'Lembur (Off Pulang)' },
          { color: 'bg-amber-100 border-amber-400', label: 'Dipilih' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-md border-2 ${item.color}`}
            />
            <span className="text-xs text-slate-600">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
