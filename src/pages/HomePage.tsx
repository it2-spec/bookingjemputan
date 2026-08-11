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
  Navigation,
  Phone,
  UserCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { BookingCardSkeleton } from '../components/ui/Skeleton';
import { Dialog } from '../components/ui/Dialog';
import { SeatMap } from '../components/booking/SeatMap';
import { PassengerLiveTrackerModal } from '../components/booking/PassengerLiveTrackerModal';
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
import { getGreeting, getVehicleIcon, padZero, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
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
  const [showLiveDriverTracker, setShowLiveDriverTracker] = useState(false);
  const [routeDriver, setRouteDriver] = useState<{ name: string; phone: string; nik: string } | null>(null);
  const cancelBooking = useCancelBooking();

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilDeadline());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Assigned Driver for the active booking route
  useEffect(() => {
    if (!activeBooking?.route_id) return;

    const fetchAssignedDriver = async () => {
      try {
        // 1. Check if Admin assigned a driver in invoice_daily_overrides for this date & route
        if (activeBooking.departure_date) {
          const { data: overrideData } = await supabase
            .from('invoice_daily_overrides')
            .select('assigned_driver_id')
            .eq('departure_date', activeBooking.departure_date)
            .eq('route_id', activeBooking.route_id)
            .maybeSingle();

          if (overrideData?.assigned_driver_id) {
            const { data: driverEmp } = await supabase
              .from('employees')
              .select('name, phone, nik')
              .eq('id', overrideData.assigned_driver_id)
              .maybeSingle();

            if (driverEmp) {
              setRouteDriver(driverEmp);
              return;
            }
          }
        }

        // 2. Check permanently assigned driver (assigned_route_id = route_id)
        const { data: routeEmpDriver } = await supabase
          .from('employees')
          .select('name, phone, nik')
          .eq('role', 'driver')
          .eq('assigned_route_id', activeBooking.route_id)
          .limit(1)
          .maybeSingle();

        if (routeEmpDriver) {
          setRouteDriver(routeEmpDriver);
          return;
        }

        // 3. Fallback: get driver from driver_locations
        const { data: locData } = await supabase
          .from('driver_locations')
          .select('driver_id')
          .eq('route_id', activeBooking.route_id)
          .limit(1)
          .maybeSingle();

        if (locData?.driver_id) {
          const { data: locDriver } = await supabase
            .from('employees')
            .select('name, phone, nik')
            .eq('id', locData.driver_id)
            .maybeSingle();

          if (locDriver) {
            setRouteDriver(locDriver);
            return;
          }
        }

        setRouteDriver(null);
      } catch (e) {
        console.error('Error fetching driver info:', e);
      }
    };

    fetchAssignedDriver();

    // Subscribe to realtime changes in invoice_daily_overrides
    const channel = supabase
      .channel('driver-assignment-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_daily_overrides' },
        () => {
          fetchAssignedDriver();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBooking?.route_id, activeBooking?.departure_date]);

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
          <p className="text-sm text-slate-600 font-medium">
            {getGreeting()} 👋
          </p>
          <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
            {employee?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {employee?.department}
          </p>
        </div>
        {employee?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="p-2.5 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer flex items-center gap-1.5 font-semibold text-xs border border-primary-200"
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
          <Card className="bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Booking Ditutup
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
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
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
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
                  <span className="font-bold text-slate-900 font-[family-name:var(--font-display)]">
                    {(activeBooking as any).route?.route_name || 'Rute'}
                  </span>
                </div>
                <Badge variant="success" dot>
                  Dikonfirmasi
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDateIndonesian(activeBooking.departure_date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>05:30 WIB</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Armchair className="w-3.5 h-3.5" />
                  <span>Kursi {activeBooking.seat_number}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Bus className="w-3.5 h-3.5" />
                  {(() => {
                    const currentVehicle = getVehicleType(activeRouteBookings.filter(b => b.status === 'confirmed').length);
                    return <span>{getVehicleIcon(currentVehicle)} {currentVehicle}</span>;
                  })()}
                </div>
              </div>

              {activeBooking.pickup_point && (
                <div className="p-2 bg-slate-100 rounded-lg text-xs flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span><strong>Halte Jemput:</strong> {activeBooking.pickup_point}</span>
                </div>
              )}

              {/* Driver Information Card */}
              {routeDriver ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      👨‍✈️
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Supir Jemputan Anda
                      </p>
                      <p className="text-xs font-bold text-slate-900">{routeDriver.name}</p>
                    </div>
                  </div>
                  {routeDriver.phone && (
                    <a
                      href={`https://wa.me/${routeDriver.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                      title="Hubungi Supir via WhatsApp"
                    >
                      <Phone className="w-3 h-3" /> Hubungi
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    👨‍✈️ Supir: <strong className="text-amber-900 font-semibold">Belum ditugaskan oleh Admin</strong>
                  </span>
                  <span className="text-[10px] text-amber-600 font-mono font-medium">
                    Menunggu Konfirmasi
                  </span>
                </div>
              )}

              {/* Live Driver Tracking CTA Button */}
              <button
                onClick={() => setShowLiveDriverTracker(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4 animate-spin" /> 🚌 Lacak Posisi Driver Real-Time
              </button>

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
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
              <Ticket className="w-7 h-7 text-primary-500" />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Belum ada booking aktif
            </p>
            <p className="text-xs text-slate-600 mt-1 mb-4">
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
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Rute Terdaftar Anda
            </h2>
            <button
              onClick={() => navigate('/profile')}
              className="text-xs text-primary-600 font-medium flex items-center gap-0.5 cursor-pointer"
            >
              Ubah di Profil <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {routes.map((route, i) => {
              const isAssigned = employee?.assigned_route_id
                ? employee.assigned_route_id === route.id
                : route.route_name.toLowerCase().includes('karawang barat'); // Default route

              return (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <Card
                    hoverable={isAssigned}
                    className={cn(
                      'transition-all',
                      isAssigned
                        ? 'cursor-pointer border-l-4 border-l-primary-600 bg-primary-50'
                        : 'opacity-60 bg-slate-100 cursor-not-allowed'
                    )}
                    onClick={() => {
                      if (isAssigned) {
                        navigate(`/booking?route=${route.id}`);
                      } else {
                        toast.error(
                          `Anda terdaftar untuk rute ${
                            employee?.assigned_route_name || 'Karawang Barat'
                          }. Silakan ubah rute di Profil jika ingin pindah.`,
                          { duration: 4000 }
                        );
                      }
                    }}
                    animate={false}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          isAssigned
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-slate-200 text-slate-400'
                        )}
                      >
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm">
                            {route.route_name}
                          </p>
                          {isAssigned ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
                              ✓ Terdaftar
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-mono">
                              🔒 Terkunci
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          Berangkat 05:30 WIB
                        </p>
                      </div>
                      {isAssigned ? (
                        <ChevronRight className="w-5 h-5 text-primary-600" />
                      ) : (
                        <span className="text-[10px] text-surface-400 underline">Ubah</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
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

      {/* Live Driver Tracker Dialog */}
      {activeBooking && (
        <PassengerLiveTrackerModal
          isOpen={showLiveDriverTracker}
          onClose={() => setShowLiveDriverTracker(false)}
          routeName={(activeBooking as any).route?.route_name || 'Karawang Barat'}
          routeId={activeBooking.route_id}
          assignedDriverName={routeDriver?.name}
          assignedDriverPhone={routeDriver?.phone || undefined}
        />
      )}
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
