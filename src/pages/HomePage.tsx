// ============================================================
// Home Page (Employee & Passenger Portal)
// Displays active shuttle tickets for Hari H (Today) & Besok (Tomorrow)
// with assigned drivers, vehicle type, seat number, and live tracking
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
  CheckCircle2,
  Moon,
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
  getTodayDate,
  getTomorrowDate,
  getNowWIB,
  formatDateIndonesian,
  getTimeUntilDeadline,
  isBookingOpen,
  getVehicleType,
  normalizeUnitBookings,
} from '../lib/vehicleLogic';


import { getGreeting, padZero, cn } from '../lib/utils';

import { supabase } from '../lib/supabase';
import type { Booking, VehicleType } from '../lib/types';
import tracerLogo from '../assets/tracer.png';
import toast from 'react-hot-toast';

interface DriverInfo {
  name: string;
  phone: string;
  nik: string;
}

export default function HomePage() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  const todayDate = getTodayDate();
  const tomorrowDate = getTomorrowDate();

  // 1. Fetch Today's Booking (Hari H)
  const { data: todayBooking, isLoading: todayBookingLoading } = useActiveBooking(
    employee?.id || null,
    todayDate
  );

  // 2. Fetch Tomorrow's Booking (H-1)
  const { data: tomorrowBooking, isLoading: tomorrowBookingLoading } = useActiveBooking(
    employee?.id || null,
    tomorrowDate
  );

  // Route bookings count for vehicle calculation
  const { data: todayRouteBookings = [] } = useRouteBookings(
    todayBooking?.route_id || null,
    todayDate
  );
  const { data: tomorrowRouteBookings = [] } = useRouteBookings(
    tomorrowBooking?.route_id || null,
    tomorrowDate
  );

  const { data: routes } = useRoutes();
  useRealtimeBookings();

  // Countdown timer
  const [countdown, setCountdown] = useState(getTimeUntilDeadline());

  // Drivers and vehicle override states
  const [todayDriver, setTodayDriver] = useState<DriverInfo | null>(null);
  const [todayVehicle, setTodayVehicle] = useState<string | null>(null);
  const [tomorrowDriver, setTomorrowDriver] = useState<DriverInfo | null>(null);
  const [tomorrowVehicle, setTomorrowVehicle] = useState<string | null>(null);

  // Modal dialog states
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [selectedBookingForMap, setSelectedBookingForMap] = useState<{
    booking: Booking;
    date: string;
    routeId: string;
    routeName: string;
    unitNumber: number;
    unitCount: number;
    dailyVehicle?: string | null;
  } | null>(null);
  const [mapSelectedUnit, setMapSelectedUnit] = useState<number>(1);

  const [liveTrackerBooking, setLiveTrackerBooking] = useState<{
    routeId: string;
    routeName: string;
    driverName?: string;
    driverPhone?: string;
  } | null>(null);

  // Query bookings dynamically for whichever booking is being viewed on the seat map
  const { data: mapRouteBookings = [] } = useRouteBookings(
    selectedBookingForMap?.routeId || null,
    selectedBookingForMap?.date || ''
  );

  const cancelBooking = useCancelBooking();

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilDeadline());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Driver and Vehicle details for a given booking (supports distinct return driver if assigned)
  const fetchBookingDriverAndVehicle = async (
    booking: Booking | null | undefined,
    setDriver: (d: DriverInfo | null) => void,
    setVehicle: (v: string | null) => void,
    isReturn: boolean = false
  ) => {
    if (!booking?.route_id || !booking?.departure_date) {
      setDriver(null);
      setVehicle(null);
      return;
    }

    try {
      const { data: overrideData } = await supabase
        .from('invoice_daily_overrides')
        .select('assigned_driver_id, assigned_driver_id_unit2, assigned_driver_id_unit3, driver_assignments, return_driver_assignments, has_different_return_driver, override_vehicle_type')
        .eq('departure_date', booking.departure_date)
        .eq('route_id', booking.route_id)
        .maybeSingle();

      const unitNum = booking.unit_number || 1;
      let driverId: string | null = null;

      if (overrideData) {
        if (overrideData.override_vehicle_type) {
          setVehicle(overrideData.override_vehicle_type);
        } else {
          setVehicle((booking as any).route?.manual_vehicle_type || null);
        }

        // 1. If it's return trip (after 07:30 WIB) and a distinct return driver is assigned:
        if (isReturn && overrideData.has_different_return_driver && overrideData.return_driver_assignments && typeof overrideData.return_driver_assignments === 'object') {
          driverId = (overrideData.return_driver_assignments as any)[String(unitNum)] || (overrideData.return_driver_assignments as any)['1'] || null;
        }

        // 2. Default: use departure driver
        if (!driverId) {
          if (overrideData.driver_assignments && typeof overrideData.driver_assignments === 'object') {
            driverId = overrideData.driver_assignments[String(unitNum)] || overrideData.driver_assignments['1'];
          }
          if (!driverId) {
            if (unitNum === 2 && overrideData.assigned_driver_id_unit2) {
              driverId = overrideData.assigned_driver_id_unit2;
            } else if (unitNum === 3 && overrideData.assigned_driver_id_unit3) {
              driverId = overrideData.assigned_driver_id_unit3;
            } else {
              driverId = overrideData.assigned_driver_id;
            }
          }
        }
      } else {
        setVehicle((booking as any).route?.manual_vehicle_type || null);
      }

      if (driverId) {
        const { data: driverEmp } = await supabase
          .from('employees')
          .select('name, phone, nik')
          .eq('id', driverId)
          .maybeSingle();

        if (driverEmp) {
          setDriver(driverEmp);
          return;
        }
      }

      setDriver(null);
    } catch (e) {
      console.error('Error fetching driver & vehicle:', e);
    }
  };

  // Sync today's booking driver & vehicle (aware of morning vs return afternoon phase)
  useEffect(() => {
    const now = getNowWIB();
    const isReturn = now.getHours() > 7 || (now.getHours() === 7 && now.getMinutes() >= 30);
    fetchBookingDriverAndVehicle(todayBooking, setTodayDriver, setTodayVehicle, isReturn);

    const channel = supabase
      .channel('today-driver-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_daily_overrides' },
        () => {
          fetchBookingDriverAndVehicle(todayBooking, setTodayDriver, setTodayVehicle, isReturn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todayBooking?.route_id, todayBooking?.departure_date, todayBooking?.unit_number]);

  // Sync tomorrow's booking driver & vehicle
  useEffect(() => {
    fetchBookingDriverAndVehicle(tomorrowBooking, setTomorrowDriver, setTomorrowVehicle, false);

    const channel = supabase
      .channel('tomorrow-driver-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_daily_overrides' },
        () => {
          fetchBookingDriverAndVehicle(tomorrowBooking, setTomorrowDriver, setTomorrowVehicle, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tomorrowBooking?.route_id, tomorrowBooking?.departure_date, tomorrowBooking?.unit_number]);


  const bookingOpen = isBookingOpen();

  const handleCancelBooking = async () => {
    if (!cancellingBooking) return;
    try {
      await cancelBooking.mutateAsync(cancellingBooking.id);
      toast.success('Booking berhasil dibatalkan');
      setCancellingBooking(null);
    } catch {
      toast.error('Gagal membatalkan booking');
    }
  };

  const handleOpenSeatMap = async (booking: Booking) => {
    const routeObj = (booking as any).route;
    const myUnit = booking.unit_number || 1;

    let effectiveUnitCount = routeObj?.unit_count || 1;
    let dailyVehicle: string | null = null;

    try {
      const { data: ov } = await supabase
        .from('invoice_daily_overrides')
        .select('daily_unit_count, daily_vehicle_type, override_vehicle_type')
        .eq('departure_date', booking.departure_date)
        .eq('route_id', booking.route_id)
        .maybeSingle();

      if (ov?.daily_unit_count && ov.daily_unit_count > 1) {
        effectiveUnitCount = ov.daily_unit_count;
      }
      dailyVehicle = ov?.daily_vehicle_type || null;
    } catch (err) {
      console.error('Error fetching override for seat map:', err);
    }

    if (myUnit > effectiveUnitCount) {
      effectiveUnitCount = myUnit;
    }

    setMapSelectedUnit(myUnit);
    setSelectedBookingForMap({
      booking,
      date: booking.departure_date,
      routeId: booking.route_id,
      routeName: routeObj?.route_name || 'Rute Jemputan',
      unitNumber: myUnit,
      unitCount: effectiveUnitCount,
      dailyVehicle,
    });
  };


  // Current WIB time logic for Hari H trip phase (Berangkat Pagi 05:30 vs Pulang Sore 16:30)
  const nowWIB = getNowWIB();
  const currentHour = nowWIB.getHours();
  const currentMinute = nowWIB.getMinutes();
  const isReturnTrip = currentHour > 7 || (currentHour === 7 && currentMinute >= 30);

  const resolveEffectiveVehicle = (
    rawVehicle: string | null | undefined,
    passengerCount: number,
    isMultiUnit: boolean = false
  ): VehicleType => {
    if (isMultiUnit) return 'Avanza';
    if (rawVehicle && rawVehicle !== 'Auto' && rawVehicle !== '') {
      if (rawVehicle.includes('Avanza')) return 'Avanza';
      if (rawVehicle.includes('Short')) return 'Elf Short';
      if (rawVehicle.includes('Long')) return 'Elf Long';
    }
    return getVehicleType(passengerCount);
  };

  const isLoadingBookings = todayBookingLoading || tomorrowBookingLoading;
  const hasAnyBooking = Boolean(todayBooking || tomorrowBooking);

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm p-1 flex items-center justify-center shrink-0">
            <img src={tracerLogo} alt="TRACER Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
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

      {/* Countdown / Deadline for Tomorrow's Booking */}
      {bookingOpen && countdown && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-primary-600 to-primary-700 border-none text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-200 font-medium">
                  Batas Booking Hari Ini
                </p>
                <p className="text-sm text-primary-100 mt-0.5 font-bold">
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
          <Card className="bg-amber-50 border-amber-200 shadow-2xs">
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

      {/* ============================================================ */}
      {/* TIKET HARI INI (HARI H) & TIKET BESOK (H-1)                   */}
      {/* ============================================================= */}
      <div className="space-y-4">
        {isLoadingBookings ? (
          <BookingCardSkeleton />
        ) : hasAnyBooking ? (
          <>
            {/* 1. TIKET HARI INI (HARI H) */}
            {todayBooking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isReturnTrip ? 'Tiket Pulang Sore (Hari H)' : 'Tiket Berangkat Pagi (Hari H)'}
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isReturnTrip
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {isReturnTrip ? '🌆 Pulang Sore' : '🌅 Berangkat Pagi'}
                  </span>
                </div>

                <Card className="relative overflow-hidden border-2 border-emerald-500/40 shadow-sm bg-gradient-to-b from-emerald-50/20 to-white">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-slate-900 text-base font-[family-name:var(--font-display)]">
                          {(todayBooking as any).route?.route_name || 'Rute'}
                        </span>
                      </div>
                      <Badge variant="success" dot>
                        {isReturnTrip ? 'Jemputan Pulang' : 'Siap Berangkat'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-medium">{formatDateIndonesian(todayBooking.departure_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-emerald-800">
                          {isReturnTrip ? '16:30 WIB (Pulang)' : '05:30 WIB (Berangkat)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Armchair className="w-3.5 h-3.5 text-emerald-600" />
                        {(() => {
                          const isMulti = ((todayBooking as any).route?.unit_count || 1) > 1;
                          return (
                            <span className="font-bold text-emerald-900">
                              Kursi {todayBooking.seat_number}
                              {isMulti && todayBooking.unit_number && todayBooking.unit_number > 1 ? ` (Unit ${todayBooking.unit_number})` : ''}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                        <Bus className="w-3.5 h-3.5 text-emerald-600" />
                        {(() => {
                          const isMulti = ((todayBooking as any).route?.unit_count || 1) > 1;
                          const effectiveVehicle = resolveEffectiveVehicle(
                            todayVehicle,
                            todayRouteBookings.filter((b) => b.status === 'confirmed').length,
                            isMulti
                          );
                          return <span>{effectiveVehicle}</span>;
                        })()}
                      </div>

                    </div>

                    {todayBooking.pickup_point && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          <strong>{isReturnTrip ? 'Titik Pengantaran:' : 'Halte Jemput:'}</strong> {todayBooking.pickup_point}
                        </span>
                      </div>
                    )}

                    {/* Overtime Notice if marked overtime for return trip */}
                    {isReturnTrip && (todayBooking as any).is_overtime_no_return ? (
                      <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Moon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-purple-950">
                              Status Sore: Terdata Lembur (Off Pulang)
                            </h4>
                            <p className="text-[11px] text-purple-700">
                              Anda tidak dijadwalkan di jemputan pulang reguler 16:30 WIB.
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-purple-600 bg-white/80 p-2 rounded-lg border border-purple-100 leading-normal">
                          💡 Apabila terdapat pembatalan/perubahan lembur, hubungi Admin Operasional agar kursi kepulangan dapat diaktifkan kembali.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Driver Information Card Hari H */}
                        {todayDriver ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                                👨‍✈️
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Supir {isReturnTrip ? 'Pulang Sore' : 'Berangkat Pagi'}
                                </p>
                                <p className="text-xs font-bold text-slate-900">{todayDriver.name}</p>
                              </div>
                            </div>
                            {todayDriver.phone && (
                              <a
                                href={`https://wa.me/${todayDriver.phone.replace(/[^0-9]/g, '')}`}
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
                              👨‍✈️ Supir {isReturnTrip ? 'Pulang' : 'Berangkat'}: <strong className="text-amber-900 font-semibold">Sedang Ditugaskan</strong>
                            </span>
                            <span className="text-[10px] text-amber-600 font-mono font-medium">
                              Hari H
                            </span>
                          </div>
                        )}

                        {/* Live Driver Tracking CTA Button Hari H */}
                        <button
                          onClick={() =>
                            setLiveTrackerBooking({
                              routeId: todayBooking.route_id,
                              routeName: (todayBooking as any).route?.route_name || 'Rute Jemputan',
                              driverName: todayDriver?.name,
                              driverPhone: todayDriver?.phone,
                            })
                          }
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        >
                          <Navigation className="w-4 h-4" /> 🚌 Lacak Posisi Driver Real-Time ({isReturnTrip ? 'Pulang' : 'Pagi'})
                        </button>
                      </>
                    )}


                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        onClick={() => handleOpenSeatMap(todayBooking)}
                      >
                        Lihat Denah Kursi Hari Ini 💺
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* 2. TIKET BESOK (H-1) */}
            {tomorrowBooking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Tiket Jemputan Besok (H-1)
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                    📅 Besok
                  </span>
                </div>

                <Card className="relative overflow-hidden border border-blue-200 shadow-sm">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <span className="font-bold text-slate-900 font-[family-name:var(--font-display)]">
                          {(tomorrowBooking as any).route?.route_name || 'Rute'}
                        </span>
                      </div>
                      <Badge variant="success" dot>
                        Dikonfirmasi
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDateIndonesian(tomorrowBooking.departure_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>05:30 & 16:30 WIB</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Armchair className="w-3.5 h-3.5" />
                        {(() => {
                          const isMulti = ((tomorrowBooking as any).route?.unit_count || 1) > 1;
                          return (
                            <span className="font-bold text-slate-900">
                              Kursi {tomorrowBooking.seat_number}
                              {isMulti && tomorrowBooking.unit_number && tomorrowBooking.unit_number > 1 ? ` (Unit ${tomorrowBooking.unit_number})` : ''}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Bus className="w-3.5 h-3.5" />
                        {(() => {
                          const isMulti = ((tomorrowBooking as any).route?.unit_count || 1) > 1;
                          const effectiveVehicle = resolveEffectiveVehicle(
                            tomorrowVehicle,
                            tomorrowRouteBookings.filter((b) => b.status === 'confirmed').length,
                            isMulti
                          );
                          return <span>{effectiveVehicle}</span>;
                        })()}
                      </div>

                    </div>

                    {tomorrowBooking.pickup_point && (
                      <div className="p-2 bg-slate-100 rounded-lg text-xs flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                        <span><strong>Halte Jemput:</strong> {tomorrowBooking.pickup_point}</span>
                      </div>
                    )}

                    {/* Driver Information Card Besok */}
                    {tomorrowDriver ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                            👨‍✈️
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Supir Jemputan Besok
                            </p>
                            <p className="text-xs font-bold text-slate-900">{tomorrowDriver.name}</p>
                          </div>
                        </div>
                        {tomorrowDriver.phone && (
                          <a
                            href={`https://wa.me/${tomorrowDriver.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            title="Hubungi Supir via WhatsApp"
                          >
                            <Phone className="w-3 h-3" /> Hubungi
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium">
                          👨‍✈️ Supir: <strong className="text-amber-900 font-semibold">Menunggu Penetapan Driver</strong>
                        </span>
                        <span className="text-[10px] text-amber-600 font-mono font-medium">
                          H-1
                        </span>
                      </div>
                    )}


                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        onClick={() => handleOpenSeatMap(tomorrowBooking)}
                      >
                        Lihat Denah Kursi 💺
                      </Button>

                      {bookingOpen && (
                        <Button
                          variant="danger"
                          size="sm"
                          fullWidth
                          icon={<XCircle className="w-4 h-4" />}
                          onClick={() => setCancellingBooking(tomorrowBooking)}
                        >
                          Batalkan
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        ) : (
          /* Empty State: Belum ada booking aktif sama sekali */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="text-center py-6 shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
                <Ticket className="w-7 h-7 text-primary-500" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Belum ada tiket jemputan aktif
              </p>
              <p className="text-xs text-slate-600 mt-1 mb-4">
                Pesan shuttle jemputan untuk besok sekarang
              </p>
              {bookingOpen && (
                <Button
                  onClick={() => navigate('/booking')}
                  size="md"
                  icon={<Ticket className="w-4 h-4" />}
                >
                  Pesan Shuttle Besok
                </Button>
              )}
            </Card>
          </motion.div>
        )}
      </div>

      {/* Quick actions - Route availability (Pesan Shuttle jika belum ada booking besok) */}
      {bookingOpen && !tomorrowBooking && routes && routes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Rute Terdaftar Anda (Pesan Besok)
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
                            (employee as any)?.assigned_route_name || 'Karawang Barat'
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Terdaftar
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
        isOpen={!!cancellingBooking}
        onClose={() => setCancellingBooking(null)}
        title="Batalkan Booking"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Apakah Anda yakin ingin membatalkan booking jemputan untuk{' '}
            <strong>{cancellingBooking ? formatDateIndonesian(cancellingBooking.departure_date) : ''}</strong>? Tindakan ini tidak dapat
            dibatalkan.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setCancellingBooking(null)}
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

      {/* Visual Seat Map Dialog */}
      <Dialog
        isOpen={!!selectedBookingForMap}
        onClose={() => setSelectedBookingForMap(null)}
        title={`Denah Kursi - ${selectedBookingForMap?.routeName || ''}`}
      >
        <div className="space-y-4 py-2">
          {selectedBookingForMap && (() => {
            const maxUnitFromBookings = mapRouteBookings.reduce(
              (max, b) => Math.max(max, b.unit_number || 1),
              1
            );
            const effectiveUnitCount = Math.max(
              selectedBookingForMap.unitCount || 1,
              maxUnitFromBookings,
              selectedBookingForMap.booking.unit_number || 1
            );
            const isMulti = effectiveUnitCount > 1;

            const rawUnitBookings = isMulti
              ? mapRouteBookings.filter(
                  (b) => (b.unit_number || 1) === mapSelectedUnit && b.status === 'confirmed'
                )
              : mapRouteBookings.filter((b) => b.status === 'confirmed');

            const { normalizedBookings, targetSeat } = isMulti
              ? normalizeUnitBookings(rawUnitBookings, 6, employee?.id)
              : { normalizedBookings: rawUnitBookings, targetSeat: selectedBookingForMap.booking.seat_number };

            // Determine effective vehicle type: multi-unit is ALWAYS Avanza (6 seats)
            const vehicleType: VehicleType = isMulti
              ? (selectedBookingForMap.dailyVehicle === 'Avanza' || !selectedBookingForMap.dailyVehicle ? 'Avanza' : (selectedBookingForMap.dailyVehicle as VehicleType))
              : getVehicleType(rawUnitBookings.length, (selectedBookingForMap.booking as any).route?.manual_vehicle_type);

            // Highlight user's seat only if viewing their assigned unit
            const isViewingMyUnit = !isMulti || (selectedBookingForMap.booking.unit_number || 1) === mapSelectedUnit;
            const activeSeat = isViewingMyUnit ? targetSeat : null;

            return (
              <>
                {/* Unit Tabs if Multi-Unit (e.g. 2 Avanza) */}
                {isMulti && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      🚗 Pilih Unit Mobil untuk Dilihat:
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {[...Array(effectiveUnitCount)].map((_, idx) => {
                        const uNum = idx + 1;
                        const isSel = mapSelectedUnit === uNum;
                        const isMyUnit = (selectedBookingForMap.booking.unit_number || 1) === uNum;
                        const unitCount = mapRouteBookings.filter(
                          (b) => (b.unit_number || 1) === uNum && b.status === 'confirmed'
                        ).length;

                        const isKB = selectedBookingForMap.routeName.toLowerCase().includes('karawang barat');
                        const label = isKB
                          ? uNum === 1
                            ? 'Unit 1 (Tj. Pura)'
                            : uNum === 2
                            ? 'Unit 2 (Galuh Mas)'
                            : `Unit ${uNum}`
                          : `Unit ${uNum}`;

                        return (
                          <button
                            key={uNum}
                            type="button"
                            onClick={() => setMapSelectedUnit(uNum)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>{label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSel ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {unitCount} org
                            </span>
                            {isMyUnit && (
                              <span className="text-[9px] bg-amber-400 text-slate-900 px-1 rounded font-extrabold">
                                Anda
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Render SeatMap */}
                <SeatMap
                  vehicleType={vehicleType}
                  bookings={normalizedBookings}
                  selectedSeat={activeSeat}
                  onSeatSelect={() => {}}
                />
                <p className="text-center text-xs text-slate-500 mt-2">
                  {isMulti && (selectedBookingForMap.booking.unit_number || 1) !== mapSelectedUnit
                    ? 'Anda sedang melihat unit lain.'
                    : `Kursi berwarna kuning (No. ${activeSeat || selectedBookingForMap.booking.seat_number}) adalah kursi Anda.`}
                </p>
              </>
            );
          })()}
        </div>
      </Dialog>

      {/* Live Driver Tracker Dialog */}
      {liveTrackerBooking && (
        <PassengerLiveTrackerModal
          isOpen={!!liveTrackerBooking}
          onClose={() => setLiveTrackerBooking(null)}
          routeName={liveTrackerBooking.routeName}
          routeId={liveTrackerBooking.routeId}
          assignedDriverName={liveTrackerBooking.driverName}
          assignedDriverPhone={liveTrackerBooking.driverPhone}
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
