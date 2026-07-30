// ============================================================
// Shuttle Booking — Static Route Schedules (Jadwal Jemput)
// ------------------------------------------------------------
// Sumber data statis untuk daftar titik jemput beserta estimasi
// waktu tiba kendaraan di setiap titik.
//
// Konvensi:
//  - Waktu menggunakan format 24 jam 'HH:MM' dalam WIB.
//  - Titik pertama  = titik keberangkatan ("Keberangkatan").
//  - Titik terakhir = tujuan akhir ("Tujuan").
//  - Urutan array `stops` adalah urutan perjalanan sebenarnya.
// ============================================================

import type { RouteDirection, RouteSchedule, RouteStop, StopLiveStatus } from './types';
import { getNowWIB } from './vehicleLogic';

/**
 * Jadwal statis seluruh rute jemputan.
 * Data ini dapat dipindahkan ke tabel database (mis. `route_stops`)
 * di masa depan tanpa mengubah komponen tampilan.
 */
export const ROUTE_SCHEDULES: RouteSchedule[] = [
  {
    routeName: 'Karawang Barat',
    icon: '🏭',
    stops: [
      { name: 'Alfamart Tanjung Pura', time: '05:30' },
      { name: 'Gempol', time: '05:35' },
      { name: 'Kertabumi', time: '05:45' },
      { name: 'RS. Dewi Sri', time: '05:50' },
      { name: 'Mercure', time: '05:55' },
      { name: 'Galuh Mas', time: '06:00' },
      { name: 'Pindayungan', time: '06:10' },
      { name: 'Cidomba', time: '06:15' },
      { name: 'Lampu Merah Surcip', time: '06:20' },
      { name: 'PT Sakae Riken Indonesia', time: '06:30' },
    ],
  },
  {
    routeName: 'Karawang Timur',
    icon: '🏢',
    stops: [
      { name: 'Wadas', time: '05:30' },
      { name: 'Lamaran', time: '05:45' },
      { name: 'Johar', time: '06:00' },
      { name: 'Pindayungan', time: '06:10' },
      { name: 'Cidomba', time: '06:15' },
      { name: 'Lampu Merah Surya Cipta', time: '06:25' },
      { name: 'PT. Sakae Riken Indonesia', time: '06:40' },
    ],
  },
  {
    routeName: 'Cikampek',
    icon: '🏗️',
    stops: [
      { name: 'TB Muara Raya', time: '05:45' },
      { name: 'Alfamart Pancawati', time: '05:50' },
      { name: 'SPBE Cikampek', time: '05:55' },
      { name: 'Pabrik Pur', time: '06:05' },
      { name: 'Pawarengan', time: '06:20' },
      { name: 'Indomaret RS Karya Husada', time: '06:25' },
      { name: 'PT. Asietex', time: '06:30' },
      { name: 'PT. Sakae Riken Indonesia', time: '07:00' },
    ],
  },
];

/**
 * Cari jadwal berdasarkan nama rute (cocok dengan `routes.route_name`).
 */
export function getScheduleByRouteName(
  routeName: string
): RouteSchedule | undefined {
  return ROUTE_SCHEDULES.find((s) => s.routeName === routeName);
}

// ------------------------------------------------------------
// Direction (arah perjalanan) helpers
// ------------------------------------------------------------

/** Jam keberangkatan arah pulang dari kantor (PT XYZ). */
export const PULANG_START_TIME = '16:30';

/** Label tampilan untuk tiap arah. */
export const DIRECTION_LABELS: Record<RouteDirection, string> = {
  masuk: 'Masuk',
  pulang: 'Pulang',
};

/**
 * Konversi menit sejak tengah malam menjadi string 'HH:MM' (24 jam).
 * Contoh: 990 -> '16:30'
 */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Membangun jadwal arah pulang dari jadwal arah masuk.
 *
 * Rute dibalik (titik terakhir menjadi titik pertama) dan berangkat
 * pada PULANG_START_TIME. Durasi antar-titik dipertahankan sama dengan
 * arah masuk (cermin), sehingga estimasi waktu tetap realistis.
 *
 * Contoh (Karawang Barat):
 *  Masuk : Galuh Mas 06:00 -> ... -> PT XYZ 06:30
 *  Pulang: PT XYZ 16:30 -> ... -> Galuh Mas 17:00
 */
export function buildReturnSchedule(inbound: RouteSchedule): RouteSchedule {
  const stops = inbound.stops;
  const n = stops.length;
  if (n === 0) return { ...inbound, stops: [] };

  // Durasi tiap segmen pada arah masuk: seg[i] = time[i+1] - time[i]
  const segments: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    segments.push(timeToMinutes(stops[i + 1].time) - timeToMinutes(stops[i].time));
  }

  const returnStops: RouteStop[] = [];
  let current = timeToMinutes(PULANG_START_TIME);
  for (let k = 0; k < n; k++) {
    const original = stops[n - 1 - k]; // ambil dari titik terakhir ke pertama
    returnStops.push({ name: original.name, time: minutesToTime(current) });
    if (k < n - 1) {
      current += segments[n - 2 - k]; // durasi cermin
    }
  }

  return {
    routeName: inbound.routeName,
    icon: inbound.icon,
    stops: returnStops,
  };
}

/**
 * Ambil daftar jadwal untuk arah tertentu.
 * - masuk : jadwal asli (pagi)
 * - pulang: jadwal yang dibalik (sore, mulai 16:30)
 */
export function getSchedulesForDirection(
  direction: RouteDirection
): RouteSchedule[] {
  if (direction === 'masuk') return ROUTE_SCHEDULES;
  return ROUTE_SCHEDULES.map(buildReturnSchedule);
}

// ------------------------------------------------------------
// Time helpers
// ------------------------------------------------------------

/**
 * Konversi string waktu 'HH:MM' menjadi menit sejak tengah malam.
 * Contoh: '06:30' -> 390
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Waktu WIB saat ini dalam menit sejak tengah malam.
 */
export function getNowMinutes(): number {
  const now = getNowWIB();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Format durasi (menit) menjadi label ringkas berbahasa Indonesia.
 * Contoh: 30 -> '30 mnt', 90 -> '1 j 30 m', 60 -> '1 jam'
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} jam` : `${h} j ${m} m`;
}

/**
 * Total durasi perjalanan (titik pertama -> titik terakhir) dalam menit.
 */
export function getRouteDurationMinutes(schedule: RouteSchedule): number {
  if (schedule.stops.length < 2) return 0;
  const first = timeToMinutes(schedule.stops[0].time);
  const last = timeToMinutes(schedule.stops[schedule.stops.length - 1].time);
  return Math.max(0, last - first);
}

/** Jam keberangkatan (waktu titik pertama). */
export function getDepartureTime(schedule: RouteSchedule): string {
  return schedule.stops[0]?.time ?? '-';
}

/** Jam tiba di tujuan (waktu titik terakhir). */
export function getArrivalTime(schedule: RouteSchedule): string {
  return schedule.stops[schedule.stops.length - 1]?.time ?? '-';
}

// ------------------------------------------------------------
// Live status helpers
// ------------------------------------------------------------

/**
 * Status live sebuah titik terhadap waktu saat ini.
 */
export function getStopLiveStatus(
  stopMinutes: number,
  nowMinutes: number
): StopLiveStatus {
  if (nowMinutes > stopMinutes) return 'passed';
  if (nowMinutes === stopMinutes) return 'arriving';
  return 'upcoming';
}

/**
 * Label estimasi yang mudah dibaca untuk sebuah titik.
 * - Sudah lewat    -> 'Sudah dilewati'
 * - Tepat waktunya -> 'Kendaraan tiba di titik ini'
 * - Akan datang    -> 'Estimasi N menit lagi' (atau 'X j Y m lagi' bila >= 1 jam)
 */
export function getEstimateLabel(
  stopMinutes: number,
  nowMinutes: number
): string {
  const diff = stopMinutes - nowMinutes;
  if (diff < 0) return 'Sudah dilewati';
  if (diff === 0) return 'Kendaraan tiba di titik ini';
  if (diff < 60) return `Estimasi ${diff} menit lagi`;
  return `Estimasi ${formatDuration(diff)} lagi`;
}
