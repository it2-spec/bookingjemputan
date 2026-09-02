// ============================================================
// Shuttle Booking — Utility Functions
// ============================================================

import type { BookingStatus, VehicleType } from './types';

/**
 * Concatenates class names, filtering out falsy values.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Returns a greeting based on current time (WIB).
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

/**
 * Returns the appropriate color scheme for a booking status.
 */
export function getStatusColor(status: BookingStatus): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
      };
    case 'cancelled':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        dot: 'bg-red-500',
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
      };
  }
}

/**
 * Returns an icon/emoji for a vehicle type.
 */
export function getVehicleIcon(type: VehicleType | string): string {
  switch (type) {
    case 'Avanza':
      return '🚗';
    case 'Elf Short':
      return '🚌';
    case 'Elf Long':
      return '🚐';
    default:
      return '🚌';
  }
}


/**
 * Truncates text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generates initials from a name (up to 2 characters).
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Delays execution for a given number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats a number with leading zero if needed.
 */
export function padZero(num: number): string {
  return String(num).padStart(2, '0');
}
