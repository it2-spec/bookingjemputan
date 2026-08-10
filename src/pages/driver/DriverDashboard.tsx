import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LiveMap, type MarkerLocation } from '../../components/maps/LiveMap';
import { supabase } from '../../lib/supabase';
import type { Route, BookingWithDetails } from '../../lib/types';
import { Navigation, MapPin, Radio, CheckCircle, Users, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// Coordinates for standard shuttle stops in Karawang area
const STATIONS: Record<string, [number, number]> = {
  'Karawang Barat 1': [-6.276592879810661, 107.27324066001847],
  'Karawang Barat 2': [-6.276592879810661, 107.27324066001847],
  'Karawang Barat': [-6.276592879810661, 107.27324066001847],
  'Karawang Timur': [-6.2830973278683935, 107.45715106568662],
  'Cikampek': [-6.370380867733877, 107.37704813870378],
};

export function DriverDashboard() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [isTracking, setIsTracking] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([-6.3039, 107.3009]);
  const [driverStatus, setDriverStatus] = useState<'active' | 'heading_to_pickup' | 'in_transit' | 'completed' | 'offline'>('active');
  const [todaysBookings, setTodaysBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Fetch available routes and today's passengers
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: routeData } = await supabase.from('routes').select('*');
      if (routeData) {
        setRoutes(routeData as Route[]);
        if (routeData.length > 0 && !selectedRouteId) {
          setSelectedRouteId(routeData[0].id);
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, employee:employees(*), route:routes(*)')
        .eq('departure_date', todayStr)
        .eq('status', 'confirmed');

      if (bookingData) {
        setTodaysBookings(bookingData as BookingWithDetails[]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data driver');
    } finally {
      setLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update location in Supabase table (or localStorage fallback if offline DB)
  const syncLocationToDb = useCallback(
    async (lat: number, lng: number, statusVal = driverStatus) => {
      if (!employee) return;
      try {
        await supabase.from('driver_locations').upsert(
          {
            driver_id: employee.id,
            route_id: selectedRouteId || null,
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
    [employee, selectedRouteId, driverStatus]
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

  const handleManualLocationUpdate = (lat: number, lng: number) => {
    setCurrentCoords([lat, lng]);
    syncLocationToDb(lat, lng);
    toast.success('Lokasi penjemputan driver diperbarui!');
  };

  const handleSelectPresetStation = (stationName: string) => {
    const coords = STATIONS[stationName];
    if (coords) {
      setCurrentCoords(coords);
      syncLocationToDb(coords[0], coords[1]);
      toast.success(`Lokasi diset ke Poin ${stationName}`);
    }
  };

  const selectedRouteObj = routes.find((r) => r.id === selectedRouteId);
  const filteredBookings = todaysBookings.filter(
    (b) => !selectedRouteId || b.route_id === selectedRouteId
  );

  const mapMarkers: MarkerLocation[] = [
    {
      id: 'driver-live',
      title: `Driver ${employee?.name || 'Gojek Driver'}`,
      subtitle: `Status: ${driverStatus.replace(/_/g, ' ')}`,
      lat: currentCoords[0],
      lng: currentCoords[1],
      type: 'driver',
      status: 'Live Realtime',
    },
    ...Object.entries(STATIONS).map(([name, coords]) => ({
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
      {/* Header */}
      <header className="bg-emerald-700 text-white px-4 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center border border-emerald-500 shadow-inner">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold flex items-center gap-2">
                Driver Console <span className="bg-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase"></span>
              </h1>
              <p className="text-xs text-emerald-100">{employee?.name} ({employee?.nik})</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-emerald-800 hover:bg-emerald-900 px-3 py-1.5 rounded-lg border border-emerald-600 font-medium transition-colors cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status Control Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" /> Live Status & Broadcast Lokasi
              </h2>
              <p className="text-xs text-slate-600">Tentukan lokasi penjemputan real-time untuk penumpang</p>
            </div>
            <button
              onClick={() => {
                const next = !isTracking;
                setIsTracking(next);
                if (!next) syncLocationToDb(currentCoords[0], currentCoords[1], 'offline');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${isTracking
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Radio className={`w-4 h-4 ${isTracking ? 'animate-spin' : ''}`} />
              {isTracking ? 'GPS Tracking Aktif' : 'Aktifkan GPS Live'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Rute Operasional Hari Ini
              </label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.route_name} ({r.departure_time})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Status Penjemputan Driver
              </label>
              <select
                value={driverStatus}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setDriverStatus(val);
                  syncLocationToDb(currentCoords[0], currentCoords[1], val);
                  toast.success('Status updated');
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
              >
                <option value="active">🟢 Standby / Siap Penjemputan</option>
                <option value="heading_to_pickup">🚗 Menuju Titik Penjemputan</option>
                <option value="in_transit">🚌 Membawa Penumpang (In Transit)</option>
                <option value="completed">✅ Selesai Penjemputan</option>
                <option value="offline">⚪ Offline</option>
              </select>
            </div>
          </div>

          {/* Quick preset locations */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-600 block mb-1 font-medium">Pilih Poin Lokasi Cepat:</span>
            <div className="flex flex-wrap gap-2">
              {Object.keys(STATIONS).map((stName) => (
                <button
                  key={stName}
                  onClick={() => handleSelectPresetStation(stName)}
                  className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
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
              <MapPin className="w-4 h-4 text-emerald-600" /> Live Map Real-Time Driver
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Lat: {currentCoords[0].toFixed(4)}, Lng: {currentCoords[1].toFixed(4)}
            </span>
          </div>

          <LiveMap
            center={currentCoords}
            zoom={13}
            markers={mapMarkers}
            onLocationSelect={handleManualLocationUpdate}
            className="h-80 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner"
          />
          <p className="text-[11px] text-slate-500 text-center">
            💡 <em>Klik pada area peta untuk menggeser posisi pin driver secara manual jika GPS HP tidak presisi.</em>
          </p>
        </div>

        {/* Passengers List Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" /> Daftar Penumpang Jemputan ({selectedRouteObj?.route_name || 'Semua Rute'})
              </h3>
              <p className="text-xs text-slate-500">Total {filteredBookings.length} penumpang terdaftar hari ini</p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada penumpang terdaftar untuk rute ini hari ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBookings.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200">
                      #{b.seat_number}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {b.employee?.name || 'Penumpang'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>NIK: {b.employee?.nik}</span>
                        <span>•</span>
                        <span>{b.employee?.department}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Confirmed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
