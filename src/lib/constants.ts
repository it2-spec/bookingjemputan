// ============================================================
// Shuttle Booking — Application Constants
// ============================================================

import type { VehicleType } from './types';

/** Booking closes at 19:00 WIB every day */
export const BOOKING_DEADLINE_HOUR = 19;

/** All shuttles depart at 05:30 WIB */
export const DEPARTURE_TIME = '05:30';

/** Maximum total capacity across all vehicle types */
export const MAX_CAPACITY = 18;

/** Vehicle capacity thresholds */
export const VEHICLE_THRESHOLDS = {
  avanza: { min: 1, max: 6 },
  elfShort: { min: 7, max: 14 },
  elfLong: { min: 15, max: 18 },
} as const;

/** Vehicle type labels (Indonesian) */
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  'Avanza': 'Toyota Avanza',
  'Elf Short': 'Isuzu Elf Short',
  'Elf Long': 'Isuzu Elf Long',
};

/** Seat capacity per vehicle type */
export const VEHICLE_SEAT_CAPACITY: Record<VehicleType, number> = {
  'Avanza': 6,
  'Elf Short': 14,
  'Elf Long': 18,
};

/** Available routes */
export const ROUTE_NAMES = [
  'Karawang Barat 1 (Tanjung Pura, Kertabumi)',
  'Karawang Barat 2 (Dewi Sri, Tuparev, Galuh Mas)',
  'Karawang Timur',
  'Cikampek',
] as const;

/** Booking status labels (Indonesian) */
export const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Dikonfirmasi',
  cancelled: 'Dibatalkan',
  closed: 'Ditutup',
};

/** Bottom navigation items */
export const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/booking', label: 'Booking', icon: 'ticket' },
  { path: '/history', label: 'Riwayat', icon: 'history' },
  { path: '/profile', label: 'Profil', icon: 'user' },
] as const;

/** WIB timezone offset (UTC+7) */
export const WIB_OFFSET = 7;

/** App metadata */
export const APP_NAME = 'Shuttle Booking';
export const APP_VERSION = '1.0.0';
