// ============================================================
// Booking Page
// ============================================================

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lock, MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { RouteCard } from '../components/shared/RouteCard';
import { SeatMap } from '../components/booking/SeatMap';
import { BookingInfoCard } from '../components/booking/BookingInfoCard';
import { BookingConfirmDialog } from '../components/booking/BookingConfirmDialog';
import { RouteCardSkeleton, SeatMapSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useRoutes } from '../hooks/useRoutes';
import {
  useRouteBookings,
  useCreateBooking,
  useActiveBooking,
} from '../hooks/useBooking';
import { useVehicleType } from '../hooks/useVehicleType';
import { useRealtimeBookings } from '../hooks/useRealtimeBookings';
import { supabase } from '../lib/supabase';
import { getScheduleByRouteName } from '../lib/routeSchedules';
import {
  getTomorrowDate,
  isBookingOpen,
  getVehicleType,
} from '../lib/vehicleLogic';
import { DEPARTURE_TIME } from '../lib/constants';
import toast from 'react-hot-toast';

export default function BookingPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRoute = searchParams.get('route');

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    preselectedRoute
  );
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);

  const tomorrowDate = getTomorrowDate();
  const bookingOpen = isBookingOpen();

  const { data: routes, isLoading: routesLoading } = useRoutes();
  const selectedRoute = routes?.find((r) => r.id === selectedRouteId);
  const routeSchedule = selectedRoute ? getScheduleByRouteName(selectedRoute.route_name) : undefined;

  // Auto lock to assigned route if passenger has one & set default pickup point
  useEffect(() => {
    if (routes && routes.length > 0) {
      const assignedId = employee?.assigned_route_id;
      if (assignedId) {
        if (selectedRouteId !== assignedId) {
          setSelectedRouteId(assignedId);
          if (preselectedRoute && preselectedRoute !== assignedId) {
            toast.error('Rute disesuaikan dengan rute terdaftar di profil Anda.', { duration: 4000 });
          }
        }
      } else if (!selectedRouteId) {
        // Default to Karawang Barat
        const kb = routes.find((r) => r.route_name.toLowerCase().includes('karawang barat'));
        if (kb) setSelectedRouteId(kb.id);
      }
    }
  }, [routes, employee?.assigned_route_id, selectedRouteId, preselectedRoute]);

  // Set default pickup point when routeSchedule changes
  useEffect(() => {
    if (routeSchedule && routeSchedule.stops.length > 0 && !selectedPickupPoint) {
      const empDefault = employee?.default_pickup_point || (employee?.id ? localStorage.getItem(`shuttle_default_pickup_${employee.id}`) : null);
      const cachedLast = localStorage.getItem('shuttle_last_pickup_point');

      const matchesEmpDefault = empDefault && routeSchedule.stops.some((s) => s.name === empDefault);
      const matchesCached = cachedLast && routeSchedule.stops.some((s) => s.name === cachedLast);

      if (matchesEmpDefault) {
        setSelectedPickupPoint(empDefault!);
      } else if (matchesCached) {
        setSelectedPickupPoint(cachedLast!);
      } else {
        setSelectedPickupPoint(routeSchedule.stops[0].name);
      }
    }
  }, [routeSchedule, selectedPickupPoint, employee?.default_pickup_point, employee?.id]);

  const { data: bookings = [], isLoading: bookingsLoading } = useRouteBookings(
    selectedRouteId,
    tomorrowDate
  );
  const { data: activeBooking } = useActiveBooking(
    employee?.id || null,
    tomorrowDate
  );
  const createBooking = useCreateBooking();

  // Real-time updates for selected route
  useRealtimeBookings(selectedRouteId, tomorrowDate);

  const vehicleInfo = useVehicleType(bookings);

  // Reset seat when route changes
  useEffect(() => {
    setSelectedSeat(null);
  }, [selectedRouteId]);

  const handleSeatSelect = (seatNumber: number) => {
    setSelectedSeat((prev) => (prev === seatNumber ? null : seatNumber));
  };

  const handleConfirmBooking = async () => {
    if (!employee || !selectedRouteId || !selectedSeat) return;

    if (!selectedPickupPoint) {
      toast.error('Silakan pilih titik penjemputan spesifik Anda');
      return;
    }

    try {
      const confirmedCount = bookings.filter(b => b.status === 'confirmed').length + 1;
      const vehicleType = getVehicleType(confirmedCount);

      await supabase.from('bookings').insert({
        employee_id: employee.id,
        route_id: selectedRouteId,
        departure_date: tomorrowDate,
        seat_number: selectedSeat,
        vehicle_type: vehicleType,
        pickup_point: selectedPickupPoint,
        status: 'confirmed',
      });

      localStorage.setItem('shuttle_last_pickup_point', selectedPickupPoint);

      toast.success('Booking berhasil! 🎉', {
        duration: 3000,
        icon: '✅',
      });
      setShowConfirm(false);
      setSelectedSeat(null);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat booking';
      if (msg.includes('idx_one_booking_per_day')) {
        toast.error('Anda sudah memiliki booking untuk hari ini.');
      } else if (msg.includes('idx_unique_seat_per_route_day')) {
        toast.error('Kursi sudah dipesan oleh penumpang lain.');
      } else {
        toast.error(msg);
      }
    }
  };

  // If booking is closed or user already has active booking
  const hasActiveBooking = !!activeBooking;

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() =>
            selectedRouteId ? setSelectedRouteId(null) : navigate(-1)
          }
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors touch-target cursor-pointer"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 font-[family-name:var(--font-display)]">
            {selectedRouteId ? 'Pilih Kursi' : 'Pilih Rute'}
          </h1>
          <p className="text-xs text-slate-600">
            Shuttle untuk besok • {DEPARTURE_TIME} WIB
          </p>
        </div>
      </motion.div>

      {/* Booking closed message */}
      {!bookingOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 rounded-2xl p-5 border border-amber-200 text-center"
        >
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-bold text-amber-800 mb-1">
            Booking Ditutup
          </h3>
          <p className="text-sm text-amber-700">
            Booking telah ditutup. Silakan hubungi Admin apabila terdapat
            kebutuhan khusus.
          </p>
        </motion.div>
      )}

      {/* Already has active booking */}
      {bookingOpen && hasActiveBooking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary-50 rounded-2xl p-5 border border-primary-200 text-center"
        >
          <h3 className="font-bold text-primary-800 mb-1">
            Anda Sudah Memiliki Booking
          </h3>
          <p className="text-sm text-primary-700 mb-3">
            Setiap karyawan hanya dapat memiliki satu booking aktif per hari.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
          >
            Lihat Booking Saya
          </Button>
        </motion.div>
      )}

      {/* Route Selection */}
      {bookingOpen && !hasActiveBooking && !selectedRouteId && (
        <AnimatePresence>
          <div className="space-y-3">
            {routesLoading
              ? [...Array(3)].map((_, i) => <RouteCardSkeleton key={i} />)
              : routes?.map((route, index) => (
                  <RouteCard
                    key={route.id}
                    routeName={route.route_name}
                    departureTime={DEPARTURE_TIME}
                    onClick={() => setSelectedRouteId(route.id)}
                    delay={index * 0.1}
                  />
                ))}
          </div>
        </AnimatePresence>
      )}

      {/* Seat Selection */}
      {bookingOpen && !hasActiveBooking && selectedRouteId && (
        <AnimatePresence>
          <motion.div
            key="seat-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Route Restriction Banner */}
            <div className="bg-primary-50 p-3 rounded-xl border border-primary-200 flex items-center justify-between text-xs text-primary-800">
              <div>
                <span className="font-bold">📍 Rute Terdaftar Anda:</span> {selectedRoute?.route_name || 'Karawang Barat'}
              </div>
              <button
                onClick={() => navigate('/profile')}
                className="text-[11px] underline font-semibold text-primary-700 hover:text-primary-900 cursor-pointer"
              >
                Ubah di Profil
              </button>
            </div>

            {/* Pickup Point Selector Card */}
            {routeSchedule && routeSchedule.stops.length > 0 && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary-600" /> Pilih Titik Penjemputan Spesifik (Halte) <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-slate-600">
                  Tentukan lokasi pemberhentian driver tempat Anda menunggu jemputan pada rute {selectedRoute?.route_name}.
                </p>
                <select
                  value={selectedPickupPoint}
                  onChange={(e) => setSelectedPickupPoint(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 font-semibold text-slate-900 cursor-pointer"
                >
                  {routeSchedule.stops.map((stop) => (
                    <option key={stop.name} value={stop.name}>
                      📍 {stop.name} (Jam Est. {stop.time} WIB)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Booking info */}
            {selectedRoute && (
              <BookingInfoCard
                routeName={selectedRoute.route_name}
                departureDate={tomorrowDate}
                vehicleType={vehicleInfo.vehicleType}
                confirmedCount={vehicleInfo.confirmedCount}
                maxSeats={vehicleInfo.maxSeats}
                remainingSeats={vehicleInfo.remainingSeats}
                isClosed={!bookingOpen}
              />
            )}

            {/* Seat map */}
            {bookingsLoading ? (
              <SeatMapSkeleton />
            ) : vehicleInfo.isFull ? (
              <div className="text-center py-8">
                <p className="text-slate-600 font-medium">
                  Semua kursi sudah terisi penuh.
                </p>
              </div>
            ) : (
              <SeatMap
                vehicleType={vehicleInfo.vehicleType}
                bookings={bookings}
                selectedSeat={selectedSeat}
                onSeatSelect={handleSeatSelect}
                currentEmployeeId={employee?.id}
              />
            )}

            {/* Book button */}
            {selectedSeat && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky bottom-24 z-30"
              >
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => setShowConfirm(true)}
                  className="shadow-float"
                >
                  Pesan Sekarang — Kursi {selectedSeat}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Confirmation dialog */}
      {selectedRoute && selectedSeat && (
        <BookingConfirmDialog
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirmBooking}
          isLoading={createBooking.isPending}
          routeName={selectedRoute.route_name}
          departureDate={tomorrowDate}
          seatNumber={selectedSeat}
          vehicleType={vehicleInfo.vehicleType}
          pickupPoint={selectedPickupPoint}
        />
      )}
    </div>
  );
}
