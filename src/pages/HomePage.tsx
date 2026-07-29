// ============================================================
// Home Page
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Bus,
  Ticket,
  ChevronRight,
  Calendar,
  MapPin,
  Armchair,
  Clock,
  Shield,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { BookingCardSkeleton } from '../components/ui/Skeleton';
import { Dialog } from '../components/ui/Dialog';
import { SeatMap } from '../components/booking/SeatMap';
import { useAuth } from '../context/AuthContext';
import { useActiveBooking, useCancelBooking, useRouteBookings } from '../hooks/useBooking';
import { useRoutes } from '../hooks/useRoutes';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';
import {
  getTomorrowDate,
  formatDateIndonesian,
  getTimeUntilDeadline,
  isBookingOpen,
  getVehicleType,
} from '../lib/vehicleLogic';
import { getGreeting, getVehicleIcon, padZero } from '../lib/utils';
import toast from 'react-hot-toast';

export default function HomePage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const tomorrowDate = getTomorrowDate();

  const { data: activeBooking, isLoading: bookingLoading } = useActiveBooking(
    employee?.id || null,
    tomorrowDate
  );

  const { data: activeRouteBookings = [] } = useRouteBookings(
    activeBooking?.route_id || null,
    tomorrowDate
  );

  const { data: routes } = useRoutes();
  useRealtimeBookings();

  // Countdown timer & dialog state
  const [countdown, setCountdown] = useState(getTimeUntilDeadline());
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVisualMapDialog, setShowVisualMapDialog] = useState(false);
  const cancelBooking = useCancelBooking();

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilDeadline());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const bookingOpen = isBookingOpen();

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    try {
      await cancelBooking.mutateAsync(activeBooking.id);
      toast.success('Booking berhasil dibatalkan');
      setShowCancelDialog(false);
    } catch {
      toast.error('Gagal membatalkan booking');
    }
  };

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {getGreeting()} 👋
          </p>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
            {employee?.name}
          </h1>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
            {employee?.department}
          </p>
        </div>
        {employee?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors cursor-pointer flex items-center gap-1.5 font-semibold text-xs border border-primary-200 dark:border-primary-800"
            aria-label="Admin Panel"
          >
            <Shield className="w-4 h-4" />
            <span>Admin Panel</span>
          </button>
        )}
      </motion.div>

      {/* Admin Quick Banner Access */}
      {employee?.role === 'admin' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            hoverable
            className="bg-gradient-to-r from-slate-900 to-slate-800 border-none text-white cursor-pointer"
            onClick={() => navigate('/admin')}
            animate={false}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-400/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-bold font-[family-name:var(--font-display)]">
                    Dashboard Operasional Admin
                  </p>
                  <p className="text-xs text-slate-300">
                    Kelola penumpang, unduh Excel, & pantau armada
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Countdown / Deadline */}
      {bookingOpen && countdown && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-primary-600 to-primary-700 border-none text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-200 font-medium">
                  Batas Booking Hari Ini
                </p>
                <p className="text-sm text-primary-100 mt-0.5">
                  Untuk {formatDateIndonesian(tomorrowDate)}
                </p>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <TimeUnit value={countdown.hours} label="Jam" />
                <span className="text-primary-300 text-lg font-bold">:</span>
                <TimeUnit value={countdown.minutes} label="Min" />
                <span className="text-primary-300 text-lg font-bold">:</span>
                <TimeUnit value={countdown.seconds} label="Det" />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {!bookingOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Booking Ditutup
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Booking telah ditutup. Silakan hubungi Admin apabila terdapat kebutuhan khusus.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Active Booking */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
            Booking Aktif
          </h2>
        </div>

        {bookingLoading ? (
          <BookingCardSkeleton />
        ) : activeBooking ? (
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-500" />
                  <span className="font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
                    {(activeBooking as any).route?.route_name || 'Rute'}
                  </span>
                </div>
                <Badge variant="success" dot>
                  Dikonfirmasi
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDateIndonesian(activeBooking.departure_date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>07:30 WIB</span>
                </div>
                <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
                  <Armchair className="w-3.5 h-3.5" />
                  <span>Kursi {activeBooking.seat_number}</span>
                </div>
                <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
                  <Bus className="w-3.5 h-3.5" />
                  {(() => {
                    const currentVehicle = getVehicleType(activeRouteBookings.filter(b => b.status === 'confirmed').length);
                    return <span>{getVehicleIcon(currentVehicle)} {currentVehicle}</span>;
                  })()}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setShowVisualMapDialog(true)}
                >
                  Lihat Denah Kursi 💺
                </Button>
                {bookingOpen && (
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    icon={<XCircle className="w-4 h-4" />}
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Batalkan
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mb-3">
              <Ticket className="w-7 h-7 text-primary-500 dark:text-primary-400" />
            </div>
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Belum ada booking aktif
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 mb-4">
              Pesan shuttle untuk besok sekarang
            </p>
            {bookingOpen && (
              <Button
                onClick={() => navigate('/booking')}
                size="md"
                icon={<Ticket className="w-4 h-4" />}
              >
                Pesan Shuttle
              </Button>
            )}
          </Card>
        )}
      </motion.div>

      {/* Quick actions - Route availability */}
      {bookingOpen && !activeBooking && routes && routes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              Rute Tersedia
            </h2>
            <button
              onClick={() => navigate('/booking')}
              className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5 cursor-pointer"
            >
              Lihat semua <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {routes.map((route, i) => (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => navigate(`/booking?route=${route.id}`)}
                  animate={false}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
                        {route.route_name}
                      </p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">
                        Berangkat 07:30 WIB
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-surface-300 dark:text-surface-600" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Cancel booking dialog */}
      <Dialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        title="Batalkan Booking"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Apakah Anda yakin ingin membatalkan booking ini? Tindakan ini tidak dapat
            dibatalkan.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowCancelDialog(false)}
            >
              Tidak
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleCancelBooking}
              isLoading={cancelBooking.isPending}
            >
              Ya, Batalkan
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Visual Seat Map Dialog for Employee Active Booking */}
      <Dialog
        isOpen={showVisualMapDialog}
        onClose={() => setShowVisualMapDialog(false)}
        title={`Denah Kursi - ${(activeBooking as any)?.route?.route_name || ''}`}
      >
        <div className="space-y-4 py-2">
          {activeBooking && (
            <SeatMap
              vehicleType={getVehicleType(activeRouteBookings.filter(b => b.status === 'confirmed').length)}
              bookings={activeRouteBookings}
              selectedSeat={activeBooking.seat_number}
              onSeatSelect={() => {}}
            />
          )}
          <p className="text-center text-xs text-surface-400">
            Kursi berwarna kuning (No. {activeBooking?.seat_number}) adalah kursi Anda.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/15 rounded-lg px-2 py-1 min-w-[36px] text-center">
        <span className="text-lg font-bold font-mono">{padZero(value)}</span>
      </div>
      <span className="text-[9px] text-primary-300 mt-0.5">{label}</span>
    </div>
  );
}
