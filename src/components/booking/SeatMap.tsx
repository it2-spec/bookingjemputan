// ============================================================
// Seat Map Component — Orchestrates Vehicle Layouts
// ============================================================

import { useState, useMemo, useRef } from 'react';
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
  allowDragDrop?: boolean;
  onSeatSwap?: (sourceSeat: number, targetSeat: number) => Promise<void> | void;
}

export function SeatMap({
  vehicleType,
  bookings,
  selectedSeat,
  onSeatSelect,
  onSeatClickWithBooking,
  allowBookedClick = false,
  allowDragDrop = false,
  onSeatSwap,
}: SeatMapProps) {
  const [draggingSeat, setDraggingSeat] = useState<number | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<number | null>(null);
  const touchSourceSeatRef = useRef<number | null>(null);

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

  // Desktop HTML5 Drag Handlers
  const handleDragStart = (seatNumber: number, e: React.DragEvent) => {
    if (!allowDragDrop) return;
    setDraggingSeat(seatNumber);
    e.dataTransfer.setData('text/plain', seatNumber.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (seatNumber: number, e: React.DragEvent) => {
    if (!allowDragDrop || !draggingSeat || draggingSeat === seatNumber) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSeat !== seatNumber) {
      setDragOverSeat(seatNumber);
    }
  };

  const handleDragLeave = (seatNumber: number) => {
    if (dragOverSeat === seatNumber) {
      setDragOverSeat(null);
    }
  };

  const handleDrop = (targetSeat: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceSeat = Number(e.dataTransfer.getData('text/plain')) || draggingSeat;
    setDraggingSeat(null);
    setDragOverSeat(null);
    if (sourceSeat && sourceSeat !== targetSeat && onSeatSwap) {
      onSeatSwap(sourceSeat, targetSeat);
    }
  };

  // Mobile Touch Handlers
  const handleTouchStart = (seatNumber: number) => {
    if (!allowDragDrop) return;
    const seatInfo = seatMap.get(seatNumber);
    const hasPassenger = Boolean(seatInfo?.bookedBy) || seatInfo?.status === 'booked' || seatInfo?.status === 'selected';
    if (!hasPassenger) return;

    touchSourceSeatRef.current = seatNumber;
    setDraggingSeat(seatNumber);
  };

  const handleTouchMove = (_seatNumber: number, e: React.TouchEvent) => {
    if (!allowDragDrop || !touchSourceSeatRef.current) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const seatContainer = targetElement?.closest('[data-seat-number]');
    if (seatContainer) {
      const targetNum = Number(seatContainer.getAttribute('data-seat-number'));
      if (targetNum && targetNum !== touchSourceSeatRef.current) {
        setDragOverSeat(targetNum);
        return;
      }
    }
    setDragOverSeat(null);
  };

  const handleTouchEnd = () => {
    if (!allowDragDrop || !touchSourceSeatRef.current) return;
    const source = touchSourceSeatRef.current;
    const target = dragOverSeat;

    touchSourceSeatRef.current = null;
    setDraggingSeat(null);
    setDragOverSeat(null);

    if (source && target && source !== target && onSeatSwap) {
      onSeatSwap(source, target);
    }
  };

  const layoutDragProps = {
    allowDragDrop,
    draggingSeat,
    dragOverSeat,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return (
    <div className="flex flex-col items-center">
      {/* Vehicle type label */}
      <motion.div
        key={vehicleType}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-3 px-4 py-2 rounded-full bg-primary-50 border border-primary-200"
      >
        <span className="text-lg">{getVehicleIcon(vehicleType)}</span>
        <span className="text-sm font-bold text-primary-700">
          {VEHICLE_LABELS[vehicleType]}
        </span>
      </motion.div>

      {/* Admin Drag & Drop Guide Banner */}
      {allowDragDrop && (
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium flex items-center gap-1.5 shadow-2xs max-w-xs text-center">
          <span className="text-sm">🔄</span>
          <span><strong>Drag & Drop Aktif:</strong> Geser kursi penumpang untuk memindahkan atau menukar posisi duduk.</span>
        </div>
      )}

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
            <AvanzaSeatLayout
              seats={seatMap}
              onSeatClick={handleSeatClick}
              {...layoutDragProps}
            />
          )}
          {vehicleType === 'Elf Short' && (
            <ElfShortSeatLayout
              seats={seatMap}
              onSeatClick={handleSeatClick}
              {...layoutDragProps}
            />
          )}
          {vehicleType === 'Elf Long' && (
            <ElfLongSeatLayout
              seats={seatMap}
              onSeatClick={handleSeatClick}
              {...layoutDragProps}
            />
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
