import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LiveMap, type MarkerLocation } from '../../components/maps/LiveMap';
import { supabase } from '../../lib/supabase';
import type { Route, BookingWithDetails } from '../../lib/types';
import { normalizeUnitBookings } from '../../lib/vehicleLogic';
import {
  Navigation,
  MapPin,
  Radio,
  CheckCircle,
  Users,
  RefreshCw,
  AlertCircle,
  Lock,
  Building2,
  CreditCard,
  Moon,
  Clock,
  Car,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DriverProfileModal } from '../../components/driver/DriverProfileModal';

// Coordinates for standard shuttle stops in Karawang area
const DEFAULT_STATIONS: Record<string, [number, number]> = {
  'Karawang Barat': [-6.276592879810661, 107.27324066001847],
  'Karawang Timur': [-6.2830973278683935, 107.45715106568662],
  'Cikampek': [-6.370380867733877, 107.37704813870378],
};

export function DriverDashboard() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();

  const isVendorDriver = employee?.driver_type === 'vendor';

  // Driver profile & vehicle completion check
  const isProfileIncomplete = !employee?.license_plate || !employee?.vehicle_model || !employee?.phone;
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (employee && isProfileIncomplete) {
      setShowProfileModal(true);
    }
  }, [employee, isProfileIncomplete]);

  const [assignedRoute, setAssignedRoute] = useState<Route | null>(null);
  const [assignedUnit, setAssignedUnit] = useState<number | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<'both' | 'departure' | 'return'>('both');
  const [isAssignedToday, setIsAssignedToday] = useState(false);

  const [isTracking, setIsTracking] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([-6.3039, 107.3009]);
  const [driverStatus, setDriverStatus] = useState<'active' | 'heading_to_pickup' | 'in_transit' | 'completed' | 'offline'>('active');
  const [todaysBookings, setTodaysBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Fetch routes, exact assignment from Admin/Vendor, and today's passengers
  const fetchData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch all routes master
      const { data: routeData } = await supabase.from('routes').select('*');
      const allRoutes = (routeData || []) as Route[];

      // 2. Query today's overrides to check exact assignment from Admin & Vendor
      const { data: overrides } = await supabase
        .from('invoice_daily_overrides')
        .select('*')
        .eq('departure_date', todayStr);

      let foundRoute: Route | null = null;
      let foundUnit: number | null = null;
      let foundVehicle: string | null = null;
      let foundType: 'both' | 'departure' | 'return' = 'both';

      if (overrides && overrides.length > 0) {
        for (const ov of overrides) {
          const rObj = allRoutes.find((r) => r.id === ov.route_id) || null;
          const driverMap = (ov.driver_assignments || {}) as Record<string, string | null>;
          const returnDriverMap = (ov.return_driver_assignments || {}) as Record<string, string | null>;

          // Check departure driver assignments per unit
          for (const [uNum, dId] of Object.entries(driverMap)) {
            if (dId === employee.id) {
              foundRoute = rObj;
              foundUnit = parseInt(uNum, 10) || 1;
              foundVehicle = ov.daily_vehicle_type || ov.override_vehicle_type || rObj?.manual_vehicle_type || 'Avanza';
              foundType = ov.has_different_return_driver && returnDriverMap[uNum] !== employee.id ? 'departure' : 'both';
              break;
            }
          }

          // Check return driver assignments per unit
          if (!foundRoute && ov.has_different_return_driver) {
            for (const [uNum, dId] of Object.entries(returnDriverMap)) {
              if (dId === employee.id) {
                foundRoute = rObj;
                foundUnit = parseInt(uNum, 10) || 1;
                foundVehicle = ov.daily_vehicle_type || ov.override_vehicle_type || rObj?.manual_vehicle_type || 'Avanza';
                foundType = 'return';
                break;
              }
            }
          }

          // Check legacy single-unit fields
          if (!foundRoute) {
            if (ov.assigned_driver_id === employee.id) {
              foundRoute = rObj;
              foundUnit = 1;
              foundVehicle = ov.override_vehicle_type || rObj?.manual_vehicle_type || 'Avanza';
              break;
            } else if (ov.assigned_driver_id_unit2 === employee.id) {
              foundRoute = rObj;
              foundUnit = 2;
              foundVehicle = ov.override_vehicle_type || rObj?.manual_vehicle_type || 'Avanza';
              break;
            } else if (ov.assigned_driver_id_unit3 === employee.id) {
              foundRoute = rObj;
              foundUnit = 3;
              foundVehicle = ov.override_vehicle_type || rObj?.manual_vehicle_type || 'Avanza';
              break;
            }
          }

          if (foundRoute) break;
        }
      }

      // Fallback: master route driver_id or employee assigned_route_id
      if (!foundRoute) {
        const masterAssigned = allRoutes.find((r) => (r as any).driver_id === employee.id);
        if (masterAssigned) {
          foundRoute = masterAssigned;
          foundUnit = 1;
          foundVehicle = masterAssigned.manual_vehicle_type || 'Avanza';
        } else if (employee.assigned_route_id) {
          const empRoute = allRoutes.find((r) => r.id === employee.assigned_route_id);
          if (empRoute) {
            foundRoute = empRoute;
            foundUnit = 1;
            foundVehicle = empRoute.manual_vehicle_type || 'Avanza';
          }
        }
      }

      if (foundRoute) {
        setAssignedRoute(foundRoute);
        setAssignedUnit(foundUnit || 1);
        setAssignedVehicle(foundVehicle || foundRoute.manual_vehicle_type || 'Avanza');
        setAssignmentType(foundType);
        setIsAssignedToday(true);
      } else {
        setAssignedRoute(null);
        setAssignedUnit(null);
        setAssignedVehicle(null);
        setIsAssignedToday(false);
      }

      // 3. Fetch today's confirmed bookings
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, employee:employees(*), route:routes(*)')
        .eq('departure_date', todayStr)
        .eq('status', 'confirmed')
        .order('seat_number', { ascending: true });

      if (bookingData) {
        setTodaysBookings(bookingData as BookingWithDetails[]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data penugasan driver');
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update location in Supabase driver_locations table
  const syncLocationToDb = useCallback(
    async (lat: number, lng: number, statusVal = driverStatus) => {
      if (!employee) return;
      try {
        await supabase.from('driver_locations').upsert(
          {
            driver_id: employee.id,
            route_id: assignedRoute?.id || null,
            latitude: lat,
            longitude: lng,
            status: statusVal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id' }
        );
      } catch (err) {
        console.log('Sync driver location info:', err);
      }
    },
    [employee, assignedRoute, driverStatus]
  );

  // GPS Geolocation Watcher
  useEffect(() => {
    let watchId: number | null = null;

    if (isTracking && navigator.geolocation) {
      toast.success('Live Tracking GPS Aktif');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentCoords([lat, lng]);
          syncLocationToDb(lat, lng);
        },
        (err) => {
          toast.error('Gagal mengakses GPS device: ' + err.message);
          setIsTracking(false);
        },
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, syncLocationToDb]);

  const handleSelectPresetStation = (stationName: string) => {
    const coords = DEFAULT_STATIONS[stationName];
    if (coords) {
      setCurrentCoords(coords);
      syncLocationToDb(coords[0], coords[1]);
      toast.success(`Lokasi diset ke Poin ${stationName}`);
    }
  };

  const getUnitBadgeLabel = (route: Route | null, unit: number | null): string => {
    if (!unit) return 'Unit 1';
    const isKB = route?.route_name?.toLowerCase().includes('karawang barat');
    if (isKB) {
      return unit === 1 ? 'Unit 1 (T. Pura)' : unit === 2 ? 'Unit 2 (Galuh Mas)' : `Unit ${unit}`;
    }
    return `Unit ${unit}`;
  };

  // Filter passengers specifically for this driver's assigned route & unit
  // Example: Firman assigned to Karawang Barat Unit 1 (T. Pura) only sees passengers in that car
  const filteredBookings = useMemo(() => {
    if (!assignedRoute) return [];

    // 1. Filter bookings by assigned route
    let routeBookings = todaysBookings.filter((b) => b.route_id === assignedRoute.id);

    // 2. Filter strictly by unit if assignedUnit is set
    if (assignedUnit) {
      routeBookings = routeBookings.filter((b) => (b.unit_number || 1) === assignedUnit);
    }

    // 3. Normalize seat numbers if Avanza so driver sees actual car seats 1..6
    const vehicle = assignedVehicle || assignedRoute.manual_vehicle_type || 'Avanza';
    if (vehicle === 'Avanza') {
      const { normalizedBookings } = normalizeUnitBookings(routeBookings, 6);
      return normalizedBookings.sort((a, b) => a.seat_number - b.seat_number);
    }

    return routeBookings.sort((a, b) => a.seat_number - b.seat_number);
  }, [todaysBookings, assignedRoute, assignedUnit, assignedVehicle]);

  const mapMarkers: MarkerLocation[] = [
    {
      id: 'driver-live',
      title: `Driver ${employee?.name || 'Driver'}`,
      subtitle: `Status: ${driverStatus.replace(/_/g, ' ')}`,
      lat: currentCoords[0],
      lng: currentCoords[1],
      type: 'driver',
      status: 'Live Realtime',
    },
    ...Object.entries(DEFAULT_STATIONS).map(([name, coords]: [string, [number, number]]) => ({
      id: `station-${name}`,
      title: `Poin ${name}`,
      subtitle: 'Halte Jemputan',
      lat: coords[0],
      lng: coords[1],
      type: 'station' as const,
    })),
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Dynamic Header based on Driver Type */}
      <header
        className={`text-white px-4 py-4 shadow-md sticky top-0 z-30 transition-colors ${
          isVendorDriver ? 'bg-blue-800 border-b border-blue-900' : 'bg-emerald-800 border-b border-emerald-900'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner shrink-0 ${
                isVendorDriver ? 'bg-blue-700 border-blue-600' : 'bg-emerald-700 border-emerald-600'
              }`}
            >
              {isVendorDriver ? (
                <CreditCard className="w-5 h-5 text-white" />
              ) : (
                <Building2 className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-wide">Driver Console</h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isVendorDriver
                      ? 'bg-blue-900/80 text-blue-200 border-blue-400'
                      : 'bg-emerald-900/80 text-emerald-200 border-emerald-400'
                  }`}
                >
                  {isVendorDriver ? '💳 Driver Vendor Rekanan' : '🏢 Driver Internal PT'}
                </span>
              </div>
              <p className="text-xs opacity-90 flex flex-wrap items-center gap-x-2">
                <span>{employee?.name} (NIK: {employee?.nik})</span>
                {employee?.vehicle_model && (
                  <span>• 🚗 {employee.vehicle_model}</span>
                )}
                {employee?.license_plate && (
                  <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wider">
                    {employee.license_plate}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isVendorDriver
                  ? 'bg-blue-700/80 hover:bg-blue-600 border-blue-500 text-white'
                  : 'bg-emerald-700/80 hover:bg-emerald-600 border-emerald-500 text-white'
              }`}
              title="Pengaturan Data Kendaraan & Profil Driver"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Data Kendaraan</span>
            </button>
            <button
              onClick={handleLogout}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                isVendorDriver
                  ? 'bg-blue-900 hover:bg-blue-950 border-blue-700 text-blue-100'
                  : 'bg-emerald-900 hover:bg-emerald-950 border-emerald-700 text-emerald-100'
              }`}
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Official Assigned Route Banner (STRICTLY READ-ONLY) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Lock
                className={`w-4 h-4 ${isVendorDriver ? 'text-blue-600' : 'text-emerald-600'}`}
              />
              <h2 className="text-sm font-bold text-slate-900">
                Tugas Rute Operasional Hari Ini
              </h2>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full border border-slate-300 flex items-center gap-1">
              🔒 Terhubung Otomatis: Admin &rarr; Vendor &rarr; Driver &rarr; Karyawan
            </span>
          </div>

          {isAssignedToday && assignedRoute ? (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                isVendorDriver
                  ? 'bg-blue-50/70 border-blue-200'
                  : 'bg-emerald-50/70 border-emerald-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Rute Ditugaskan
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    🚌 {assignedRoute.route_name}
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                        isVendorDriver ? 'bg-blue-600' : 'bg-emerald-600'
                      }`}
                    >
                      {getUnitBadgeLabel(assignedRoute, assignedUnit)}
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-medium block">Jenis Armada</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-slate-600" />
                      {assignedVehicle || assignedRoute.manual_vehicle_type || 'Avanza'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Jadwal Berangkat</span>
                    <span className="font-bold text-slate-800">{assignedRoute.departure_time} WIB</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Jadwal Pulang</span>
                  <span className="font-bold text-slate-800">{(assignedRoute as any).return_time || '16:00'} WIB</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block">Sesi Tugas</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {assignmentType === 'departure'
                      ? 'Hanya Berangkat'
                      : assignmentType === 'return'
                      ? 'Hanya Pulang'
                      : 'Pulang & Pergi'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Belum Ada Penugasan Rute Hari Ini</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Anda saat ini berstatus <strong>Standby</strong>. Penugasan rute ditentukan langsung oleh Koordinator Admin & Vendor secara terpusat.
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 italic">
            * Driver tidak dapat mengubah rute operasional sendiri karena data penugasan telah terikat dengan sistem konfirmasi armada Admin & Vendor serta jadwal tiket karyawan.
          </p>
        </div>

        {/* Live Status & Broadcast Control Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio
                  className={`w-4 h-4 animate-pulse ${
                    isVendorDriver ? 'text-blue-600' : 'text-emerald-600'
                  }`}
                />{' '}
                Live Status & Broadcast Lokasi
              </h2>
              <p className="text-xs text-slate-600">
                Bagikan lokasi penjemputan real-time Anda kepada penumpang jemputan
              </p>
            </div>
            <button
              onClick={() => {
                const next = !isTracking;
                setIsTracking(next);
                if (!next) syncLocationToDb(currentCoords[0], currentCoords[1], 'offline');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isTracking
                  ? isVendorDriver
                    ? 'bg-blue-600 text-white shadow-blue-500/20 shadow-lg'
                    : 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Radio className={`w-4 h-4 ${isTracking ? 'animate-spin' : ''}`} />
              {isTracking ? 'GPS Tracking Aktif' : 'Aktifkan GPS Live'}
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Status Perjalanan Driver
            </label>
            <select
              value={driverStatus}
              onChange={(e) => {
                const val = e.target.value as any;
                setDriverStatus(val);
                syncLocationToDb(currentCoords[0], currentCoords[1], val);
                toast.success('Status perjalanan driver diperbarui');
              }}
              className={`w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 font-bold text-slate-900 ${
                isVendorDriver ? 'focus:ring-blue-500' : 'focus:ring-emerald-500'
              }`}
            >
              <option value="active">🟢 Standby / Siap Penjemputan</option>
              <option value="heading_to_pickup">🚗 Menuju Titik Penjemputan (OTW)</option>
              <option value="in_transit">🚌 Membawa Penumpang (In Transit)</option>
              <option value="completed">✅ Selesai Penjemputan</option>
              <option value="offline">⚪ Offline / Istirahat</option>
            </select>
          </div>

          {/* Quick preset locations */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-600 block mb-1.5 font-medium">
              Pilih Poin Lokasi Cepat (Jika GPS Tidak Presisi):
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.keys(DEFAULT_STATIONS).map((stName) => (
                <button
                  key={stName}
                  onClick={() => handleSelectPresetStation(stName)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                    isVendorDriver
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <MapPin className="w-3 h-3" /> Poin {stName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Map Display */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Navigation
                className={`w-4 h-4 ${isVendorDriver ? 'text-blue-600' : 'text-emerald-600'}`}
              />{' '}
              Live Map Posisi Driver
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Lat: {currentCoords[0].toFixed(4)}, Lng: {currentCoords[1].toFixed(4)}
            </span>
          </div>

          <LiveMap
            markers={mapMarkers}
            center={currentCoords}
            zoom={13}
            onLocationSelect={(lat: number, lng: number) => {
              setCurrentCoords([lat, lng]);
              syncLocationToDb(lat, lng);
              toast.success('Lokasi disesuaikan manual pada peta');
            }}
            className="h-80 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner"
          />
          <p className="text-[11px] text-slate-500 text-center">
            💡 <em>Klik pada area peta untuk menggeser posisi pin driver secara manual.</em>
          </p>
        </div>

        {/* Passengers List Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users
                  className={`w-4 h-4 ${isVendorDriver ? 'text-blue-600' : 'text-emerald-600'}`}
                />{' '}
                Daftar Penumpang Jemputan ({assignedRoute ? `${assignedRoute.route_name} • ${getUnitBadgeLabel(assignedRoute, assignedUnit)}` : 'Tidak Ada Rute'})
              </h3>
              <p className="text-xs text-slate-500">
                {assignedRoute
                  ? `Total ${filteredBookings.length} penumpang di mobil Anda (${getUnitBadgeLabel(assignedRoute, assignedUnit)})`
                  : 'Belum ada rute aktif'}
              </p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!assignedRoute ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tidak ada daftar penumpang karena Anda belum ditugaskan pada rute hari ini.</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada penumpang terdaftar untuk unit/rute ini hari ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBookings.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center border shrink-0 ${
                        isVendorDriver
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      #{b.seat_number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {b.employee?.name || 'Penumpang'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>NIK: {b.employee?.nik}</span>
                        <span>•</span>
                        <span>{b.employee?.department}</span>
                      </div>
                      {b.pickup_point && (
                        <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                          <span className="truncate">Jemput di: {b.pickup_point}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Confirmed
                    </span>
                    {(b as any).is_overtime_no_return && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200 flex items-center gap-1">
                        <Moon className="w-2.5 h-2.5" /> Lembur (Off Pulang)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Driver Profile & Vehicle Setup Modal */}
      <DriverProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        isMandatory={isProfileIncomplete}
      />
    </div>
  );
}
