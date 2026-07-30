// ============================================================
// Route Timeline Card Component
// ------------------------------------------------------------
// Menampilkan satu rute sebagai card dengan timeline vertikal
// mirip jadwal perjalanan di aplikasi KAI Access:
//  - Setiap titik punya nama + estimasi jam tiba
//  - Titik pertama berlabel "Keberangkatan", terakhir "Tujuan"
//  - Status live: "Sudah dilewati" / "Estimasi N menit lagi"
//  - Total durasi & jumlah titik jemput
//  - Titik pilihan pengguna diberi badge "Posisi Anda" + highlight
// ============================================================

import { type ComponentType } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Flag,
  Navigation,
  Check,
  Clock,
  CheckCircle2,
  CircleDot,
  User,
  Timer,
  Bus,
  Ticket,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { RouteSchedule, StopLiveStatus } from '../../lib/types';
import {
  timeToMinutes,
  getStopLiveStatus,
  getEstimateLabel,
  getRouteDurationMinutes,
  getDepartureTime,
  getArrivalTime,
  formatDuration,
} from '../../lib/routeSchedules';

interface RouteTimelineCardProps {
  schedule: RouteSchedule;
  /** Waktu saat ini dalam menit sejak tengah malam (WIB) */
  nowMinutes: number;
  /** Nama titik yang dipilih pengguna sebagai posisi jemput */
  selectedStopName?: string | null;
  /** Callback saat pengguna mengetuk sebuah titik */
  onSelectStop?: (stopName: string) => void;
  /** Callback opsional untuk memesan rute ini */
  onBook?: () => void;
  /** Delay animasi masuk (detik) */
  delay?: number;
}

interface NodeConfig {
  Icon: ComponentType<{ className?: string }>;
  node: string;
  ping: string | null;
}

/**
 * Menentukan tampilan node timeline berdasarkan status & posisinya.
 */
function getNodeConfig(
  status: StopLiveStatus,
  isFirst: boolean,
  isLast: boolean,
  isNext: boolean
): NodeConfig {
  // Titik yang sudah terlewati -> centang biru (selesai)
  if (status === 'passed') {
    return {
      Icon: Check,
      node: 'bg-primary-600 border-primary-600 text-white',
      ping: null,
    };
  }

  // Titik terakhir = tujuan (aksen hijau)
  if (isLast) {
    return isNext
      ? {
          Icon: Flag,
          node: 'bg-emerald-600 border-emerald-600 text-white',
          ping: 'bg-emerald-400',
        }
      : {
          Icon: Flag,
          node: 'bg-white dark:bg-surface-900 border-emerald-400 text-emerald-500',
          ping: null,
        };
  }

  // Titik pertama = keberangkatan
  if (isFirst) {
    return isNext
      ? {
          Icon: Navigation,
          node: 'bg-primary-600 border-primary-600 text-white',
          ping: 'bg-primary-400',
        }
      : {
          Icon: Navigation,
          node: 'bg-white dark:bg-surface-900 border-primary-400 text-primary-500',
          ping: null,
        };
  }

  // Titik tengah = titik jemput
  return isNext
    ? {
        Icon: MapPin,
        node: 'bg-primary-600 border-primary-600 text-white',
        ping: 'bg-primary-400',
      }
    : {
        Icon: MapPin,
        node: 'bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-600 text-surface-400',
        ping: null,
      };
}

export function RouteTimelineCard({
  schedule,
  nowMinutes,
  selectedStopName = null,
  onSelectStop,
  onBook,
  delay: animDelay = 0,
}: RouteTimelineCardProps) {
  const stops = schedule.stops;
  const durationMin = getRouteDurationMinutes(schedule);
  const departure = getDepartureTime(schedule);
  const arrival = getArrivalTime(schedule);

  // Indeks titik berikutnya yang akan disinggahi kendaraan
  const nextIndex = stops.findIndex(
    (s) => getStopLiveStatus(timeToMinutes(s.time), nowMinutes) !== 'passed'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: animDelay }}
    >
      <Card animate={false} className="overflow-hidden">
        {/* ---------- Header ---------- */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center text-2xl shrink-0">
            {schedule.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)] leading-tight">
              {schedule.routeName}
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              Berangkat {departure} • Tiba {arrival} WIB
            </p>
          </div>
          <Badge variant="info" size="sm">
            <Timer className="w-3.5 h-3.5" />
            {formatDuration(durationMin)}
          </Badge>
        </div>

        {/* ---------- Ringkasan ---------- */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 rounded-lg px-2.5 py-1">
            <MapPin className="w-3.5 h-3.5 text-surface-400" />
            {stops.length} titik jemput
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 rounded-lg px-2.5 py-1">
            <Bus className="w-3.5 h-3.5 text-surface-400" />
            {departure} WIB
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 rounded-lg px-2.5 py-1">
            <Flag className="w-3.5 h-3.5 text-surface-400" />
            Tujuan {arrival} WIB
          </span>
        </div>

        {/* ---------- Petunjuk ---------- */}
        <p className="mt-3 text-[11px] text-surface-400 dark:text-surface-500 flex items-center gap-1">
          <User className="w-3 h-3" />
          Ketuk titik untuk menandai posisi jemput Anda
        </p>

        {/* ---------- Timeline ---------- */}
        <div className="mt-3 border-t border-surface-100 dark:border-surface-800 pt-4">
          {stops.map((stop, i) => {
            const stopMin = timeToMinutes(stop.time);
            const status = getStopLiveStatus(stopMin, nowMinutes);
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            const isNext = i === nextIndex;
            const isSelected = stop.name === selectedStopName;
            const cfg = getNodeConfig(status, isFirst, isLast, isNext);
            const NodeIcon = cfg.Icon;

            return (
              <button
                key={`${stop.name}-${stop.time}`}
                type="button"
                onClick={() => onSelectStop?.(stop.name)}
                aria-pressed={isSelected}
                className="group w-full text-left flex gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl"
              >
                {/* Node + garis penghubung */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'relative w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition-colors',
                      cfg.node,
                      isSelected &&
                        'ring-2 ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-surface-900'
                    )}
                  >
                    {cfg.ping && (
                      <span
                        className={cn(
                          'absolute inset-0 rounded-full animate-ping opacity-60',
                          cfg.ping
                        )}
                      />
                    )}
                    <NodeIcon className="w-4 h-4 relative z-10" />
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        'w-0.5 flex-1 rounded-full mt-0.5',
                        status === 'passed'
                          ? 'bg-primary-500'
                          : 'bg-surface-200 dark:bg-surface-700'
                      )}
                    />
                  )}
                </div>

                {/* Konten titik */}
                <div
                  className={cn(
                    'flex-1 min-w-0 rounded-xl px-3 py-2 transition-colors',
                    !isLast && 'mb-3',
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-300 dark:ring-primary-700'
                      : 'group-hover:bg-surface-50 dark:group-hover:bg-surface-800/40'
                  )}
                >
                  {/* Baris 1: jam + label + badge posisi */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-sm font-bold font-mono tabular-nums',
                          status === 'passed'
                            ? 'text-surface-400 dark:text-surface-500'
                            : isNext || status === 'arriving'
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-surface-900 dark:text-surface-100'
                        )}
                      >
                        {stop.time}
                      </span>
                      {isFirst && (
                        <Badge variant="info" size="sm">
                          Keberangkatan
                        </Badge>
                      )}
                      {isLast && (
                        <Badge variant="success" size="sm">
                          Tujuan
                        </Badge>
                      )}
                    </div>
                    {isSelected && (
                      <Badge variant="info" size="sm">
                        <User className="w-3 h-3" />
                        Posisi Anda
                      </Badge>
                    )}
                  </div>

                  {/* Baris 2: nama titik */}
                  <p
                    className={cn(
                      'mt-0.5 font-semibold leading-snug',
                      status === 'passed'
                        ? 'text-surface-500 dark:text-surface-400'
                        : 'text-surface-900 dark:text-surface-100'
                    )}
                  >
                    {stop.name}
                  </p>

                  {/* Baris 3: status live */}
                  <div className="mt-1">
                    {status === 'passed' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-surface-400 dark:text-surface-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sudah dilewati
                      </span>
                    )}
                    {status === 'arriving' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CircleDot className="w-3.5 h-3.5" />
                        Kendaraan tiba di titik ini
                      </span>
                    )}
                    {status === 'upcoming' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400">
                        <Clock className="w-3.5 h-3.5" />
                        {isNext ? 'Titik berikutnya • ' : ''}
                        {getEstimateLabel(stopMin, nowMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ---------- Aksi pesan ---------- */}
        {onBook && (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            className="mt-4"
            icon={<Ticket className="w-4 h-4" />}
            onClick={onBook}
          >
            Pesan Rute Ini
          </Button>
        )}
      </Card>
    </motion.div>
  );
}
