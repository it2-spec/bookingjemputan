// ============================================================
// Admin Dashboard Page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users,
  Bus,
  Lock,
  Unlock,
  FileSpreadsheet,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SeatMap } from '../../components/booking/SeatMap';
import { useAdminBookings } from '../../hooks/useBooking';
import { useRoutes } from '../../hooks/useRoutes';
import { useRealtimeBookings } from '../../hooks/useRealtimeBookings';
import {
  getTomorrowDate,
  formatDateIndonesian,
  getVehicleType,
  getMaxSeats,
  isBookingClosed,
} from '../../lib/vehicleLogic';
import { getVehicleIcon } from '../../lib/utils';
import type { Route, VehicleType } from '../../lib/types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [selectedRouteForMap, setSelectedRouteForMap] = useState<{ route: Route; vehicleType: VehicleType } | null>(null);
  const { data: routes, isLoading: routesLoading } = useRoutes();
  const { data: bookings = [], isLoading: bookingsLoading, refetch } = useAdminBookings(selectedDate);

  useRealtimeBookings(null, selectedDate);

  const isClosed = isBookingClosed(selectedDate);

  // Group bookings by route
  const routeStats = routes?.map((route) => {
    const routeBookings = bookings.filter(
      (b) => b.route_id === route.id && b.status === 'confirmed'
    );
    const confirmedCount = routeBookings.length;
    const vehicleType = getVehicleType(confirmedCount);
    const maxSeats = getMaxSeats(vehicleType);

    return {
      route,
      confirmedCount,
      vehicleType,
      maxSeats,
      remainingSeats: maxSeats - confirmedCount,
    };
  });

  const totalConfirmed = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <div className="space-y-5">
      {/* Header & Date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
            Ringkasan Operasional
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {formatDateIndonesian(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-sm text-surface-800 dark:text-surface-200"
          />
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lock status banner */}
      <Card className={isClosed ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isClosed ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-surface-900 dark:text-surface-100">
                {isClosed ? 'Booking Terkunci (Lewat 20:00 WIB)' : 'Booking Masih Terbuka'}
              </span>
              <Badge variant={isClosed ? 'warning' : 'success'}>
                {isClosed ? 'Locked' : 'Open'}
              </Badge>
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {isClosed
                ? 'Jenis armada terkunci. Tidak dapat otomatis downgrade jika ada pembatalan.'
                : 'Pemesanan dan penyesuaian otomatis armada masih berjalan.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center text-primary-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-400">Total Penumpang</p>
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{totalConfirmed}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-400">Total Rute</p>
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{routes?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-surface-400">Daftar Penumpang</p>
              <button
                onClick={() => navigate('/admin/passengers')}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5"
              >
                Lihat Detail <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Routes & Vehicle Status List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
          Status Armada per Rute
        </h2>

        {routesLoading || bookingsLoading ? (
          <p className="text-sm text-surface-500 py-4">Memuat data...</p>
        ) : (
          routeStats?.map((stat, i) => (
            <motion.div
              key={stat.route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-2xl">
                      {getVehicleIcon(stat.vehicleType)}
                    </div>
                    <div>
                      <h3 className="font-bold text-surface-900 dark:text-surface-100 text-base font-[family-name:var(--font-display)]">
                        {stat.route.route_name}
                      </h3>
                      <p className="text-xs text-surface-500">
                        Armada: <span className="font-semibold text-surface-800 dark:text-surface-200">{stat.vehicleType}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-100 dark:border-surface-800">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-surface-400">Terisi / Kapasitas</p>
                      <p className="text-sm font-bold text-surface-800 dark:text-surface-200">
                        {stat.confirmedCount} / {stat.maxSeats} Kursi
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedRouteForMap({ route: stat.route, vehicleType: stat.vehicleType })}
                      >
                        Visual Kursi 💺
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/passengers?route=${stat.route.id}&date=${selectedDate}`)}
                      >
                        Daftar Penumpang
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Visual Seat Map Dialog for Admin */}
      <Dialog
        isOpen={!!selectedRouteForMap}
        onClose={() => setSelectedRouteForMap(null)}
        title={`Visual Denah Kursi - ${selectedRouteForMap?.route.route_name || ''}`}
      >
        <div className="space-y-4 py-2">
          {selectedRouteForMap && (
            <SeatMap
              vehicleType={selectedRouteForMap.vehicleType}
              bookings={bookings.filter(b => b.route_id === selectedRouteForMap.route.id)}
              selectedSeat={null}
              onSeatSelect={() => {}}
            />
          )}
          <p className="text-center text-xs text-surface-400">
            Hover / Tap pada nomor kursi merah untuk melihat nama penumpang.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
