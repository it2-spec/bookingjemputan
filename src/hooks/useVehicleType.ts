// ============================================================
// Shuttle Booking — Vehicle Type Hook
// ============================================================

import { useMemo } from 'react';
import type { Booking, VehicleType } from '../lib/types';
import { getVehicleType, getMaxSeats, resolveVehicleType } from '../lib/vehicleLogic';

interface VehicleInfo {
  vehicleType: VehicleType;
  confirmedCount: number;
  maxSeats: number;
  remainingSeats: number;
  isFull: boolean;
}

/**
 * Determines the current vehicle type and availability based on confirmed bookings.
 */
export function useVehicleType(
  bookings: Booking[],
  isLocked: boolean = false,
  lockedVehicle: VehicleType | null = null,
  manualVehicleType?: string | null
): VehicleInfo {
  return useMemo(() => {
    const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;

    // Base vehicle type based on actual confirmed bookings
    // 1–6 passengers   => Avanza (6 seats)
    // 7–14 passengers  => Elf Short (14 seats)
    // 15–16 passengers => Elf Long (16 seats)
    const calculatedType = getVehicleType(confirmedCount, manualVehicleType);
    const vehicleType = resolveVehicleType(lockedVehicle, calculatedType, isLocked);

    // If current vehicle capacity is reached (6 on Avanza, or 14 on Elf Short),
    // preview the next upgraded vehicle layout (Elf Short / Elf Long) in the booking seat map
    // so prospective passenger can select seat #7 or #15.
    // If they cancel/don't book, confirmedCount remains 6/14 and official status stays Avanza/Elf Short!
    let displayVehicleType = vehicleType;
    const isAuto = !manualVehicleType || manualVehicleType === 'Auto' || manualVehicleType === '';

    if (confirmedCount === 6 && isAuto && !isLocked) {
      displayVehicleType = 'Elf Short';
    } else if (confirmedCount === 14 && isAuto && !isLocked) {
      displayVehicleType = 'Elf Long';
    }

    const displayMaxSeats = getMaxSeats(displayVehicleType);
    const remainingSeats = displayMaxSeats - confirmedCount;

    return {
      vehicleType: displayVehicleType,
      confirmedCount,
      maxSeats: displayMaxSeats,
      remainingSeats: Math.max(0, remainingSeats),
      isFull: confirmedCount >= 16,
    };
  }, [bookings, isLocked, lockedVehicle, manualVehicleType]);
}
