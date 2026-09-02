// ============================================================
// Shuttle Booking — Vehicle Assignment Logic
// ============================================================

import type { VehicleType } from './types';
import { BOOKING_DEADLINE_HOUR, VEHICLE_SEAT_CAPACITY, WIB_OFFSET } from './constants';

/**
 * Determines the vehicle type based on confirmed passenger count or admin override.
 * 1-6  → Avanza
 * 7-14 → Elf Short
 * 15-16 → Elf Long
 */
export function getVehicleType(confirmedCount: number, manualVehicleType?: string | null): VehicleType {
  if (manualVehicleType && manualVehicleType !== 'Auto' && manualVehicleType !== '') {
    return manualVehicleType as VehicleType;
  }
  if (confirmedCount <= 6) return 'Avanza';
  if (confirmedCount <= 14) return 'Elf Short';
  return 'Elf Long';
}

/**
 * Returns the maximum number of seats for a given vehicle type.
 */
export function getMaxSeats(vehicleType: VehicleType): number {
  return VEHICLE_SEAT_CAPACITY[vehicleType];
}

/**
 * Gets the current time in WIB (UTC+7).
 */
export function getNowWIB(): Date {
  const now = new Date();
  // Convert to WIB by adding the offset
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + WIB_OFFSET * 3600000);
}

/**
 * Checks if the booking deadline has passed for a given date.
 * Booking closes at 20:00 WIB the day before departure.
 *
 * Example: For departure on July 21, booking closes at 20:00 WIB on July 20.
 */
export function isBookingClosed(departureDateStr: string): boolean {
  const now = getNowWIB();
  const departureDate = new Date(departureDateStr + 'T00:00:00');

  // The deadline is 20:00 WIB on the day before departure
  const deadlineDate = new Date(departureDate);
  deadlineDate.setDate(deadlineDate.getDate() - 1);
  deadlineDate.setHours(BOOKING_DEADLINE_HOUR, 0, 0, 0);

  return now >= deadlineDate;
}

/**
 * Checks if booking is currently open for tomorrow.
 * Returns true if current time is before 20:00 WIB today.
 */
export function isBookingOpen(): boolean {
  const now = getNowWIB();
  return now.getHours() < BOOKING_DEADLINE_HOUR;
}

/**
 * Gets tomorrow's date formatted as YYYY-MM-DD.
 * This is the departure date that employees book for.
 */
export function getTomorrowDate(): string {
  const now = getNowWIB();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
}

/**
 * Gets today's date formatted as YYYY-MM-DD.
 */
export function getTodayDate(): string {
  return formatDate(getNowWIB());
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string to Indonesian locale format.
 * Example: "2026-07-21" → "21 Juli 2026"
 */
export function formatDateIndonesian(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a timestamp to time string.
 * Example: "2026-07-20T14:30:00Z" → "14:30 WIB"
 */
export function formatTimeWIB(timestamp: string): string {
  const date = new Date(timestamp);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const wib = new Date(utc + WIB_OFFSET * 3600000);
  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
}

/**
 * Determines if a vehicle type should be locked.
 * After 20:00 WIB, vehicle cannot downgrade (only upgrade or stay).
 *
 * @param currentVehicle - The currently assigned vehicle type
 * @param newVehicle - The vehicle type based on current passenger count
 * @param isLocked - Whether the vehicle lock flag is set
 * @returns The effective vehicle type to use
 */
export function resolveVehicleType(
  currentVehicle: VehicleType | null,
  newVehicle: VehicleType,
  isLocked: boolean
): VehicleType {
  if (!currentVehicle || !isLocked) {
    return newVehicle;
  }

  // Vehicle hierarchy: Avanza < Elf Short < Elf Long
  const hierarchy: Record<VehicleType, number> = {
    'Avanza': 1,
    'Elf Short': 2,
    'Elf Long': 3,
  };

  // Cannot downgrade after lock
  if (hierarchy[newVehicle] < hierarchy[currentVehicle]) {
    return currentVehicle;
  }

  return newVehicle;
}

/**
 * Calculates remaining time until booking deadline.
 * Returns null if deadline has passed.
 */
export function getTimeUntilDeadline(): { hours: number; minutes: number; seconds: number } | null {
  const now = getNowWIB();
  const deadline = new Date(now);
  deadline.setHours(BOOKING_DEADLINE_HOUR, 0, 0, 0);

  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return { hours, minutes, seconds };
}

/**
 * Normalizes bookings for multi-unit vehicles (e.g. 2x Avanza).
 * Ensures every passenger in the unit gets a visible seat (1..maxSeats),
 * even if they originally booked when layout was Elf Short (seat_number > maxSeats).
 */
export function normalizeUnitBookings(
  unitBookings: any[],
  maxSeats: number = 6,
  targetEmployeeId?: string
): { normalizedBookings: any[]; targetSeat: number | null } {
  const occupiedSeats = new Set<number>();
  const normalized: any[] = [];
  const overflow: any[] = [];
  let resolvedTargetSeat: number | null = null;

  // Pass 1: Keep valid seat numbers within range (1..maxSeats) that aren't collided
  for (const b of unitBookings) {
    if (b.seat_number >= 1 && b.seat_number <= maxSeats && !occupiedSeats.has(b.seat_number)) {
      occupiedSeats.add(b.seat_number);
      normalized.push(b);
      if (targetEmployeeId && b.employee_id === targetEmployeeId) {
        resolvedTargetSeat = b.seat_number;
      }
    } else {
      overflow.push(b);
    }
  }

  // Pass 2: Map overflow to available seats (1..maxSeats)
  let nextAvail = 1;
  for (const b of overflow) {
    while (nextAvail <= maxSeats && occupiedSeats.has(nextAvail)) {
      nextAvail++;
    }
    const assignedSeat = nextAvail <= maxSeats ? nextAvail : b.seat_number;
    occupiedSeats.add(assignedSeat);
    normalized.push({
      ...b,
      seat_number: assignedSeat,
    });
    if (targetEmployeeId && b.employee_id === targetEmployeeId) {
      resolvedTargetSeat = assignedSeat;
    }
    nextAvail++;
  }

  return { normalizedBookings: normalized, targetSeat: resolvedTargetSeat };
}

