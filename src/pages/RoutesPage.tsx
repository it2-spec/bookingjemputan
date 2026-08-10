// ============================================================
// Routes Page — "Rute Jemputan"
// ------------------------------------------------------------
// Menampilkan seluruh rute jemputan sebagai card timeline
// (gaya KAI Access). Pengguna dapat mengetuk sebuah titik untuk
// menandai posisi jemputnya ("Posisi Anda"). Pilihan disimpan
// di localStorage agar tetap ada setelah halaman dimuat ulang.
// Status titik (sudah dilewati / estimasi) mengikuti jam WIB.
// ============================================================

import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bus, Sunrise, Sunset } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { RouteTimelineCard } from '../components/shared/RouteTimelineCard';
import { useRoutes } from '../hooks/useRoutes';
import { useAuth } from '../context/AuthContext';
import { isBookingOpen, getNowWIB } from '../lib/vehicleLogic';
import { getSchedulesForDirection, getNowMinutes } from '../lib/routeSchedules';
import { padZero, cn } from '../lib/utils';
import type { RouteDirection } from '../lib/types';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'shuttle_pickup_selection_v1';

type SelectionMap = Record<string, string>;

interface DirectionOption {
  value: RouteDirection;
  label: string;
  icon: ComponentType<{ className?: string }>;
  time: string;
}

/** Pilihan arah perjalanan: masuk (pagi) & pulang (sore, rute dibalik). */
const DIRECTION_OPTIONS: DirectionOption[] = [
  { value: 'masuk', label: 'Masuk', icon: Sunrise, time: '06:00' },
  { value: 'pulang', label: 'Pulang', icon: Sunset, time: '16:30' },
];

function loadSelection(): SelectionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelectionMap) : {};
  } catch {
    return {};
  }
}

function saveSelection(selection: SelectionMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Abaikan bila localStorage tidak tersedia (mode privat, dll.)
  }
}

function formatClock(date: Date): string {
  return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

export default function RoutesPage() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { data: dbRoutes } = useRoutes();
  const bookingOpen = isBookingOpen();

  // Arah perjalanan: masuk (pagi) atau pulang (sore, rute dibalik)
  const [direction, setDirection] = useState<RouteDirection>('masuk');
  const schedules = useMemo(() => getSchedulesForDirection(direction), [direction]);

  // Jam live (WIB) — diperbarui tiap 30 detik agar status titik ikut update
  const [nowMinutes, setNowMinutes] = useState<number>(() => getNowMinutes());
  const [clock, setClock] = useState<string>(() => formatClock(getNowWIB()));

  useEffect(() => {
    const id = setInterval(() => {
      setNowMinutes(getNowMinutes());
      setClock(formatClock(getNowWIB()));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Titik jemput pilihan pengguna per rute (persisten)
  const [selected, setSelected] = useState<SelectionMap>(() => loadSelection());

  const handleSelectStop = (routeName: string, stopName: string) => {
    setSelected((prev) => {
      const next: SelectionMap = { ...prev };
      if (next[routeName] === stopName) {
        delete next[routeName]; // ketuk lagi untuk membatalkan pilihan
      } else {
        next[routeName] = stopName;
      }
      saveSelection(next);
      return next;
    });
  };

  // Nama rute -> rute di database (untuk tombol "Pesan Rute Ini")
  const routeMap = useMemo(() => {
    const map = new Map<string, string>();
    (dbRoutes || []).forEach((r) => map.set(r.route_name, r.id));
    return map;
  }, [dbRoutes]);

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
          Rute Jemputan
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Jadwal & estimasi tiba kendaraan di setiap titik jemput
        </p>
      </motion.div>

      {/* Toggle arah perjalanan */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
      >
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
          {DIRECTION_OPTIONS.map((opt) => {
            const active = direction === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDirection(opt.value)}
                aria-pressed={active}
                className={cn(
                  'relative rounded-[10px] px-3 py-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  active
                    ? 'text-primary-700'
                    : 'text-slate-600'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="direction-toggle"
                    className="absolute inset-0 bg-white rounded-[10px] shadow-card"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span
                    className={cn(
                      'text-[11px] font-mono tabular-nums',
                      active
                        ? 'text-primary-500'
                        : 'text-slate-500'
                    )}
                  >
                    {opt.time}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Jam live */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
      >
        <Card
          animate={false}
          className="bg-gradient-to-r from-primary-600 to-primary-700 border-none text-white"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] text-primary-200 font-medium">
                  Waktu Saat Ini (WIB)
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums leading-none mt-0.5">
                  {clock}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-primary-200 text-right leading-snug">
              Status titik diperbarui otomatis mengikuti jam
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Legenda */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card animate={false} padding="sm">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />
              Sudah dilewati
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-600 ring-2 ring-primary-200 dark:ring-primary-900" />
              Titik berikutnya
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900" />
              Akan datang
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Tujuan
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Daftar rute */}
      <div key={direction} className="space-y-4">
        {schedules.map((schedule, i) => {
          const dbRouteId = routeMap.get(schedule.routeName);
          const canBook = bookingOpen && !!dbRouteId;
          const isAssigned = employee?.assigned_route_id
            ? employee.assigned_route_id === dbRouteId
            : schedule.routeName.toLowerCase().includes('karawang barat');

          return (
            <RouteTimelineCard
              key={schedule.routeName}
              schedule={schedule}
              nowMinutes={nowMinutes}
              selectedStopName={selected[schedule.routeName] ?? null}
              onSelectStop={(name) => handleSelectStop(schedule.routeName, name)}
              onBook={
                canBook
                  ? () => {
                      if (isAssigned) {
                        navigate(`/booking?route=${dbRouteId}`);
                      } else {
                        toast.error(
                          `Anda terdaftar untuk rute ${
                            employee?.assigned_route_name || 'Karawang Barat'
                          }. Silakan ubah rute di Profil jika ingin pindah rute.`,
                          { duration: 4000 }
                        );
                      }
                    }
                  : undefined
              }
              delay={0.15 + i * 0.08}
            />
          );
        })}
      </div>

      {/* Catatan */}
      <p className="text-center text-[11px] text-slate-600 px-4">
        Estimasi waktu bersifat perkiraan dan dapat berubah tergantung kondisi
        lalu lintas.
      </p>
    </div>
  );
}
