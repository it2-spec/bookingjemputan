import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LiveMap, type MarkerLocation } from '../../components/maps/LiveMap';
import type { DriverLocation } from '../../lib/types';
import {
  Users,
  Bus,
  CheckCircle2,
  Clock,
  Navigation,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DEFAULT_STATIONS: Record<string, [number, number]> = {
  'Karawang Barat': [-6.3039, 107.3009],
  'Karawang Timur': [-6.3262, 107.3375],
  'Cikampek': [-6.4085, 107.4589],
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [todayBookingCount, setTodayBookingCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadSuperAdminData = async () => {
    setLoading(true);
    try {
      // 1. Driver locations
      const { data: dData } = await supabase
        .from('driver_locations')
        .select('*, driver:employees(name, nik)');
      if (dData) setDrivers(dData as any[]);

      // 3. Pending approvals
      let { data: appData, error: appErr } = await supabase
        .from('route_change_requests')
        .select(`
          *,
          employee:employees(name, nik, department),
          requested_route:routes!requested_route_id(route_name)
        `)
        .eq('status', 'pending');

      if (appErr) {
        const { data: rawReqs } = await supabase
          .from('route_change_requests')
          .select('*')
          .eq('status', 'pending');
        const { data: emps } = await supabase.from('employees').select('*');
        const { data: rts } = await supabase.from('routes').select('*');

        if (rawReqs) {
          appData = rawReqs.map((r: any) => ({
            ...r,
            employee: emps?.find((e) => e.id === r.employee_id),
            requested_route: rts?.find((rt) => rt.id === r.requested_route_id),
          }));
        }
      }

      setPendingApprovals(appData || []);

      // 4. Today booking count
      const todayStr = new Date().toISOString().split('T')[0];
      const { count: bCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('departure_date', todayStr)
        .eq('status', 'confirmed');
      setTodayBookingCount(bCount || 0);

      // 5. Total employee count
      const { count: eCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true });
      setEmployeeCount(eCount || 0);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat dashboard superadmin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuperAdminData();
  }, []);

  const handleInlineApprove = async (req: any) => {
    try {
      await supabase
        .from('route_change_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', req.id);

      await supabase
        .from('employees')
        .update({ assigned_route_id: req.requested_route_id })
        .eq('id', req.employee_id);

      toast.success('Pengajuan disetujui');
      loadSuperAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal approval');
    }
  };

  // Build markers for live map
  const mapMarkers: MarkerLocation[] = [
    ...drivers.map((d) => ({
      id: d.id,
      title: `Driver ${(d as any).driver?.name || 'Armada'}`,
      subtitle: `Status: ${d.status}`,
      lat: d.latitude,
      lng: d.longitude,
      type: 'driver' as const,
      status: 'Live',
    })),
    ...Object.entries(DEFAULT_STATIONS).map(([name, coords]) => ({
      id: `station-${name}`,
      title: `Poin Jemputan ${name}`,
      subtitle: 'Halte Shuttle',
      lat: coords[0],
      lng: coords[1],
      type: 'station' as const,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3 font-[family-name:var(--font-display)]">
            Superadmin Control Tower <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full font-mono font-semibold">Live Monitoring</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sistem terpusat pemantauan driver real-time, approval rute, & armada jemputan
          </p>
        </div>

        <button
          onClick={loadSuperAdminData}
          className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </button>
      </div>

      {/* Top Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Pemesanan Hari Ini</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{todayBookingCount} <span className="text-xs text-slate-500 font-normal">tiket</span></div>
          <div className="mt-2 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Terkonfirmasi sistem
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Total Karyawan</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{employeeCount} <span className="text-xs text-slate-500 font-normal">user</span></div>
          <div className="mt-2 text-[11px] text-slate-500">
            Termasuk driver & admin
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Driver Active GPS</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{drivers.length} <span className="text-xs text-slate-500 font-normal">driver</span></div>
          <div className="mt-2 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" /> Live Broadcast Active
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Pending Approvals</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{pendingApprovals.length} <span className="text-xs text-slate-500 font-normal">pengajuan</span></div>
          <div className="mt-2 text-[11px] text-amber-600 font-medium">
            Perlu tindak lanjut admin
          </div>
        </div>
      </div>

      {/* Main Grid: Live Map & Pending Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map Panel (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" /> Live Tracking Armada Shuttle (Leaflet / OpenStreetMap)
              </h3>
              <p className="text-xs text-slate-500">Monitoring lokasi real-time driver & titik penjemputan Karawang</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Stream
            </span>
          </div>

          <LiveMap
            center={[-6.3039, 107.3009]}
            zoom={12}
            markers={mapMarkers}
            className="h-96 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner"
          />

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Legenda: 🚌 Driver Live | 📍 Halte Jemputan</span>
            <button
              onClick={() => navigate('/superadmin/drivers')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Lihat Detail Driver Console &rarr;
            </button>
          </div>
        </div>

        {/* Pending Approvals Widget (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-500" /> Pengajuan Rute
              </h3>
              <button
                onClick={() => navigate('/superadmin/approvals')}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Lihat Semua
              </button>
            </div>

            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                  Tidak ada pengajuan rute pending.
                </div>
              ) : (
                pendingApprovals.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{req.employee?.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">NIK {req.employee?.nik}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Request rute: <strong className="text-blue-600">{req.requested_route?.route_name}</strong>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleInlineApprove(req)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Setujui
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 mt-4">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-[11px] text-slate-600">
              Superadmin memiliki wewenang penuh untuk mengubah status user, rute, dan menyetujui pemindahan lokasi jemputan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
