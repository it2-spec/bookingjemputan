// ============================================================
// Admin Dashboard Page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Users,
  Bus,
  Lock,
  Unlock,
  FileSpreadsheet,
  ChevronRight,
  RefreshCw,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
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
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [selectedRouteForMap, setSelectedRouteForMap] = useState<{ route: Route; vehicleType: VehicleType } | null>(null);
  const [adminSelectedUnit, setAdminSelectedUnit] = useState<number>(1);
  const { data: routes, isLoading: routesLoading, refetch: refetchRoutes } = useRoutes();
  const { data: bookings = [], isLoading: bookingsLoading, refetch } = useAdminBookings(selectedDate);

  useRealtimeBookings(null, selectedDate);

  const isClosed = isBookingClosed(selectedDate);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const handleSendBroadcast = async () => {
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      // 1. Call Edge Function for true Web Push (works when app is closed)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: '📢 Notifikasi dari Admin',
          message: 'Pengingat dari Admin: Jangan lupa pesan jemputan untuk besok!',
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setBroadcastResult(result);
        toast.success(`Berhasil dikirim ke ${result.sent} dari ${result.total} perangkat!`);
      } else {
        const errText = await res.text();
        console.warn('Edge Function error:', errText);
        toast.error('Gagal kirim via Web Push. Cek Supabase Edge Function.');
      }

      // 2. Also send Realtime broadcast as fallback (for users with app open)
      const channel = supabase.channel('admin-notifications');
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'admin-broadcast',
        payload: {
          title: '📢 Notifikasi dari Admin',
          message: 'Pengingat dari Admin: Jangan lupa pesan jemputan untuk besok!',
        },
      });
    } catch (err) {
      toast.error('Gagal mengirim broadcast notifikasi');
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };


  // Group bookings by route
  const routeStats = routes?.map((route) => {
    const routeBookings = bookings.filter(
      (b) => b.route_id === route.id && b.status === 'confirmed'
    );
    const confirmedCount = routeBookings.length;
    const vehicleType = getVehicleType(confirmedCount, route.manual_vehicle_type);
    const maxSeats = getMaxSeats(vehicleType);

    return {
      route,
      confirmedCount,
      vehicleType,
      maxSeats,
      remainingSeats: maxSeats - confirmedCount,
    };
  });

  const handleUpdateManualVehicle = async (routeId: string, vehicleSetting: string, unitCount: number = 1) => {
    try {
      const { error } = await supabase
        .from('routes')
        .update({
          manual_vehicle_type: vehicleSetting,
          unit_count: unitCount
        })
        .eq('id', routeId);

      if (error) throw error;
      toast.success('Pengaturan armada rute berhasil diperbarui! 🚌');
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      await refetchRoutes();
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah setting armada.');
    }
  };

  const totalConfirmed = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <div className="space-y-5">
      {/* Header & Date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
            Ringkasan Operasional
          </h1>
          <p className="text-sm text-slate-600">
            {formatDateIndonesian(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
          />
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSendBroadcast()}
            disabled={isBroadcasting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
            title="Kirim Push Notification ke Semua User"
          >
            <Bell className={`w-4 h-4 ${isBroadcasting ? 'animate-pulse' : ''}`} />
            <span>{isBroadcasting ? 'Mengirim...' : 'Broadcast'}</span>
          </button>
        </div>
      </div>

      {/* Broadcast result banner */}
      {broadcastResult && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 border border-primary-200 text-xs">
          <Bell className="w-3.5 h-3.5 text-primary-500 shrink-0" />
          <span className="text-primary-700">
            Push terkirim ke <strong>{broadcastResult.sent}</strong> perangkat
            {broadcastResult.failed > 0 && <>, <span className="text-red-500">{broadcastResult.failed} gagal</span></>}
            {' '}(total terdaftar: {broadcastResult.total})
          </span>
        </div>
      )}

      {/* Lock status banner */}
      <Card className={isClosed ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isClosed ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                {isClosed ? 'Booking Terkunci (Lewat 20:00 WIB)' : 'Booking Masih Terbuka'}
              </span>
              <Badge variant={isClosed ? 'warning' : 'success'}>
                {isClosed ? 'Locked' : 'Open'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
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
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Penumpang</p>
              <p className="text-lg font-bold text-slate-900">{totalConfirmed}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Rute</p>
              <p className="text-lg font-bold text-slate-900">{routes?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500">Daftar Penumpang</p>
              <button
                onClick={() => navigate('/admin/passengers')}
                className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-0.5"
              >
                Lihat Detail <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Routes & Vehicle Status List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Status Armada per Rute
        </h2>

        {routesLoading || bookingsLoading ? (
          <p className="text-sm text-slate-600 py-4">Memuat data...</p>
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
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                      {getVehicleIcon(stat.vehicleType)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base font-[family-name:var(--font-display)]">
                        {stat.route.route_name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-600 font-medium">Konfigurasi Armada:</span>
                        <select
                          value={
                            stat.route.manual_vehicle_type
                              ? `${stat.route.manual_vehicle_type}_${stat.route.unit_count || 1}`
                              : 'Auto_1'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Auto_1') {
                              handleUpdateManualVehicle(stat.route.id, 'Auto', 1);
                            } else {
                              const [vType, uCount] = val.split('_');
                              handleUpdateManualVehicle(stat.route.id, vType, Number(uCount));
                            }
                          }}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-xs"
                        >
                          <option value="Auto_1">⚡ Otomatis (Sistem Rekomendasi: {stat.vehicleType})</option>
                          <option value="Avanza_1">🚗 1x Avanza (Max 6 Kursi)</option>
                          <option value="Avanza_2">🚗🚗 2x Avanza (2 Unit Split - Max 12 Kursi)</option>
                          <option value="Avanza_3">🚗🚗🚗 3x Avanza (3 Unit Split - Max 18 Kursi)</option>
                          <option value="Elf Short_1">🚌 1x Elf Short (Max 14 Kursi)</option>
                          <option value="Elf Short_2">🚌🚌 2x Elf Short (2 Unit Split - Max 28 Kursi)</option>
                          <option value="Elf Long_1">🚐 1x Elf Long (Max 16 Kursi)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">Terisi / Kapasitas</p>
                      <p className="text-sm font-bold text-slate-900">
                        {stat.confirmedCount} / {stat.maxSeats} Kursi
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAdminSelectedUnit(1);
                          setSelectedRouteForMap({ route: stat.route, vehicleType: stat.vehicleType });
                        }}
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
            <>
              {/* Unit Selector (If Multi-Unit Enabled) */}
              {(selectedRouteForMap.route.unit_count || 1) > 1 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-900 block">
                    🚗 Pilih Unit Mobil untuk Dilihat:
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[...Array(selectedRouteForMap.route.unit_count || 1)].map((_, idx) => {
                      const uNum = idx + 1;
                      const isSel = adminSelectedUnit === uNum;
                      const unitBookingsCount = bookings.filter(
                        (b) => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === uNum && b.status === 'confirmed'
                      ).length;

                      return (
                        <button
                          key={uNum}
                          type="button"
                          onClick={() => setAdminSelectedUnit(uNum)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Mobil Unit {uNum} ({unitBookingsCount} Penumpang)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <SeatMap
                vehicleType={selectedRouteForMap.vehicleType}
                bookings={bookings.filter(
                  (b) => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === adminSelectedUnit
                )}
                selectedSeat={null}
                onSeatSelect={() => {}}
              />
            </>
          )}
          <p className="text-center text-xs text-slate-500">
            Hover / Tap pada nomor kursi merah untuk melihat nama penumpang.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
