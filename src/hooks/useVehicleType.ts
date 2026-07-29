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
  lockedVehicle: VehicleType | null = null
): VehicleInfo {
  return useMemo(() => {
    const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;

    // Vehicle rules:
    // 1–6 passengers   => Avanza (6 seats)
    // 7–12 passengers  => Elf Short (12 seats)
    // 13–16 passengers => Elf Long (16 seats)
    const calculatedType = getVehicleType(confirmedCount);
    const vehicleType = resolveVehicleType(lockedVehicle, calculatedType, isLocked);

    // If current vehicle capacity is reached (e.g., 6 on Avanza, or 14 on Elf Short),
    // preview the next upgraded vehicle layout (Elf Short / Elf Long) so prospective passenger can select the new seat!
    let displayVehicleType = vehicleType;
    if (confirmedCount === 6 && !isLocked) {
      displayVehicleType = 'Elf Short';
    } else if (confirmedCount === 14 && !isLocked) {
      displayVehicleType = 'Elf Long';
    }

    const displayMaxSeats = getMaxSeats(displayVehicleType);
    const remainingSeats = displayMaxSeats - confirmedCount;

    return {
      vehicleType: displayVehicleType,
      confirmedCount,
      maxSeats: displayMaxSeats,
      remainingSeats: Math.max(0, remainingSeats),
      isFull: confirmedCount >= 18,
    };
  }, [bookings, isLocked, lockedVehicle]);
}
