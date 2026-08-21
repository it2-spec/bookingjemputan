// ============================================================
// Admin Dashboard Page
// ============================================================

import { useState, useEffect } from 'react';
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
  const [routeOverrides, setRouteOverrides] = useState<Record<string, boolean>>({}); // route_id -> is_billable
  const [routeInvoiceVehicles, setRouteInvoiceVehicles] = useState<Record<string, string>>({}); // route_id -> override_vehicle_type
  const [routeDrivers, setRouteDrivers] = useState<Record<string, string>>({}); // route_id -> driver_employee_id
  const [availableDrivers, setAvailableDrivers] = useState<{ id: string; name: string; phone: string | null; department?: string; driver_type?: 'internal' | 'vendor' | null }[]>([]);
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
    const baseSeats = getMaxSeats(vehicleType);
    const unitCount = route.unit_count || 1;
    const maxSeats = baseSeats * unitCount;

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

  // Fetch overrides and drivers for selected date
  const fetchDateOverridesAndDrivers = async () => {
    // 1. Fetch available drivers
    const { data: dList } = await supabase
      .from('employees')
      .select('id, name, phone, department, driver_type')
      .eq('role', 'driver')
      .order('name', { ascending: true });

    if (dList) setAvailableDrivers(dList as any[]);

    // 2. Fetch overrides & assigned drivers & override vehicle types
    const { data } = await supabase
      .from('invoice_daily_overrides')
      .select('route_id, is_billable, assigned_driver_id, override_vehicle_type, assigned_driver_id_unit2, assigned_driver_id_unit3, driver_assignments, is_billable_unit2, is_billable_unit3, unit_sources')
      .eq('departure_date', selectedDate);

    const billableMap: Record<string, boolean> = {};
    const driverMap: Record<string, string> = {};
    const invoiceVehicleMap: Record<string, string> = {};
    if (data) {
      data.forEach((item: any) => {
        billableMap[item.route_id] = item.is_billable;
        billableMap[`${item.route_id}_1`] = item.is_billable;
        if (item.is_billable_unit2 !== undefined && item.is_billable_unit2 !== null) {
          billableMap[`${item.route_id}_2`] = item.is_billable_unit2;
        }
        if (item.is_billable_unit3 !== undefined && item.is_billable_unit3 !== null) {
          billableMap[`${item.route_id}_3`] = item.is_billable_unit3;
        }
        if (item.unit_sources && typeof item.unit_sources === 'object') {
          Object.entries(item.unit_sources).forEach(([uKey, isBill]) => {
            billableMap[`${item.route_id}_${uKey}`] = Boolean(isBill);
          });
        }

        if (item.assigned_driver_id) {
          driverMap[`${item.route_id}_1`] = item.assigned_driver_id;
          driverMap[item.route_id] = item.assigned_driver_id; // fallback
        }
        if (item.assigned_driver_id_unit2) {
          driverMap[`${item.route_id}_2`] = item.assigned_driver_id_unit2;
        }
        if (item.assigned_driver_id_unit3) {
          driverMap[`${item.route_id}_3`] = item.assigned_driver_id_unit3;
        }
        if (item.driver_assignments && typeof item.driver_assignments === 'object') {
          Object.entries(item.driver_assignments).forEach(([uKey, dId]) => {
            driverMap[`${item.route_id}_${uKey}`] = dId as string;
          });
        }
        if (item.override_vehicle_type) {
          invoiceVehicleMap[item.route_id] = item.override_vehicle_type;
        }
      });
    }
    setRouteOverrides(billableMap);
    setRouteDrivers(driverMap);
    setRouteInvoiceVehicles(invoiceVehicleMap);
  };

  useEffect(() => {
    fetchDateOverridesAndDrivers();
  }, [selectedDate]);

  const handleAssignDriverToRoute = async (routeId: string, driverId: string, unitNumber: number = 1) => {
    try {
      const currentUnit1 = unitNumber === 1 ? (driverId || null) : (routeDrivers[`${routeId}_1`] || routeDrivers[routeId] || null);
      const currentUnit2 = unitNumber === 2 ? (driverId || null) : (routeDrivers[`${routeId}_2`] || null);
      const currentUnit3 = unitNumber === 3 ? (driverId || null) : (routeDrivers[`${routeId}_3`] || null);

      const driverAssignments = {
        '1': currentUnit1,
        '2': currentUnit2,
        '3': currentUnit3,
      };

      // Auto-detect driver source type from driver attribute in database:
      // driver_type === 'internal' -> is_billable = false (Internal PT / Rp 0)
      // driver_type === 'vendor' -> is_billable = true (Sewa Vendor / Masuk Invoice)
      let autoIsBillable = routeOverrides[`${routeId}_${unitNumber}`];
      if (driverId) {
        const selDriver = availableDrivers.find((d) => d.id === driverId);
        if (selDriver) {
          if (selDriver.driver_type === 'internal') {
            autoIsBillable = false;
          } else if (selDriver.driver_type === 'vendor') {
            autoIsBillable = true;
          } else {
            // Fallback checking if driver_type is not yet filled
            const dName = selDriver.name.toLowerCase();
            const dDept = (selDriver.department || '').toLowerCase();
            if (dName.includes('internal') || dDept.includes('internal')) {
              autoIsBillable = false;
            } else {
              autoIsBillable = true;
            }
          }
        }
      }

      const isBill1 = unitNumber === 1 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_1`] ?? routeOverrides[routeId] ?? true);
      const isBill2 = unitNumber === 2 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_2`] ?? true);
      const isBill3 = unitNumber === 3 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_3`] ?? true);

      const payload: any = {
        departure_date: selectedDate,
        route_id: routeId,
        assigned_driver_id: currentUnit1,
        assigned_driver_id_unit2: currentUnit2,
        assigned_driver_id_unit3: currentUnit3,
        driver_assignments: driverAssignments,
        is_billable: isBill1,
        is_billable_unit2: isBill2,
        is_billable_unit3: isBill3,
        unit_sources: {
          '1': isBill1,
          '2': isBill2,
          '3': isBill3,
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('invoice_daily_overrides')
          .upsert({
            departure_date: selectedDate,
            route_id: routeId,
            assigned_driver_id: currentUnit1,
            is_billable: isBill1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'departure_date,route_id' });
        if (fallbackErr) throw fallbackErr;
      }

      toast.success(`Supir Unit ${unitNumber} berhasil ditugaskan! ${autoIsBillable === false ? '(🏢 Otomatis: Driver Internal Rp 0)' : autoIsBillable === true ? '(💳 Otomatis: Sewa Vendor Invoice)' : ''}`);
      fetchDateOverridesAndDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menugaskan supir');
    }
  };

  const handleSetRouteInvoiceVehicle = async (routeId: string, vehicleType: string) => {
    try {
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: selectedDate,
          route_id: routeId,
          override_vehicle_type: vehicleType || null,
          is_billable: routeOverrides[routeId] ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;
      toast.success('Tipe armada tagihan invoice berhasil diperbarui! 📄');
      fetchDateOverridesAndDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah armada tagihan invoice');
    }
  };

  const handleToggleUnitBillable = async (routeId: string, unitNumber: number = 1, currentIsBillable: boolean) => {
    const newStatus = !currentIsBillable;
    const unitKey = `${routeId}_${unitNumber}`;
    const newBillableMap = { ...routeOverrides, [unitKey]: newStatus };
    if (unitNumber === 1) newBillableMap[routeId] = newStatus;

    // 1. Optimistic UI update
    setRouteOverrides(newBillableMap);

    try {
      const isBill1 = newBillableMap[`${routeId}_1`] ?? newBillableMap[routeId] ?? true;
      const isBill2 = newBillableMap[`${routeId}_2`] ?? true;
      const isBill3 = newBillableMap[`${routeId}_3`] ?? true;

      const payload: any = {
        departure_date: selectedDate,
        route_id: routeId,
        is_billable: isBill1,
        is_billable_unit2: isBill2,
        is_billable_unit3: isBill3,
        unit_sources: {
          '1': isBill1,
          '2': isBill2,
          '3': isBill3,
        },
        assigned_driver_id: routeDrivers[`${routeId}_1`] || routeDrivers[routeId] || null,
        assigned_driver_id_unit2: routeDrivers[`${routeId}_2`] || null,
        assigned_driver_id_unit3: routeDrivers[`${routeId}_3`] || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('invoice_daily_overrides')
          .upsert({
            departure_date: selectedDate,
            route_id: routeId,
            is_billable: isBill1,
            note: isBill1 ? null : 'Driver / Mobil Sendiri',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'departure_date,route_id' });
        if (fallbackErr) throw fallbackErr;
      }

      toast.success(newStatus ? `Unit ${unitNumber}: Sewa Vendor (Invoice)` : `Unit ${unitNumber}: Driver Sendiri (Rp 0)`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status sumber armada');
      fetchDateOverridesAndDrivers(); // Revert on failure
    }
  };

  const handleToggleRouteBillable = async (routeId: string, currentIsBillable: boolean) => {
    await handleToggleUnitBillable(routeId, 1, currentIsBillable);
  };

  const [isSplitting, setIsSplitting] = useState(false);

  const handleSplitKarawangBaratNow = async (routeId: string) => {
    setIsSplitting(true);
    try {
      const kbBookings = bookings.filter(
        (b) => b.route_id === routeId && b.status === 'confirmed'
      );

      if (kbBookings.length === 0) {
        toast.error('Tidak ada booking aktif di rute Karawang Barat untuk tanggal ini.');
        return;
      }

      const unit1Keywords = ['tanjung pura', 'gempol'];
      let updatedCount = 0;

      for (const booking of kbBookings) {
        const pickup = (booking.pickup_point || '').toLowerCase();
        const targetUnit = unit1Keywords.some((k) => pickup.includes(k)) ? 1 : 2;

        const { error: updErr } = await supabase
          .from('bookings')
          .update({ unit_number: targetUnit })
          .eq('id', booking.id);
        if (!updErr) updatedCount++;
      }

      toast.success(
        `Berhasil split & susun ulang kursi ${updatedCount} penumpang Karawang Barat ke Unit 1 & Unit 2! 🚗✨`
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membagi penumpang');
    } finally {
      setIsSplitting(false);
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

                      {/* Source Vendor vs Internal Driver Selector */}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {/* If Multi-Unit Enabled (e.g. 2x Avanza / 3x Avanza), show a driver selector per unit */}
                        {(stat.route.unit_count || 1) > 1 ? (
                          <div className="flex flex-wrap items-center gap-2 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl my-1">
                            <span className="text-xs text-slate-700 font-bold w-full">👨‍✈️ Penugasan Supir per Unit Mobil:</span>
                            {[...Array(stat.route.unit_count || 1)].map((_, uIdx) => {
                              const uNum = uIdx + 1;
                              const isKB = stat.route.route_name.toLowerCase().includes('karawang barat');
                              const unitLabel = isKB
                                ? uNum === 1
                                  ? 'Unit 1 (Tanjung Pura)'
                                  : uNum === 2
                                    ? 'Unit 2 (Galuh Mas)'
                                    : `Unit ${uNum}`
                                : `Unit ${uNum}`;

                              const currentVal = routeDrivers[`${stat.route.id}_${uNum}`] || (uNum === 1 ? routeDrivers[stat.route.id] : '') || '';

                              return (
                                <div key={uNum} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  <span className="text-[11px] text-slate-600 font-bold whitespace-nowrap">{unitLabel}:</span>
                                  <select
                                    value={currentVal}
                                    onChange={(e) => handleAssignDriverToRoute(stat.route.id, e.target.value, uNum)}
                                    className="px-2 py-0.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 font-semibold focus:ring-2 focus:ring-primary-500 cursor-pointer"
                                  >
                                    <option value="">-- Pilih Supir --</option>
                                    {availableDrivers.map((d) => {
                                      // Check if this driver is assigned to another unit or route on selectedDate
                                      const isAssignedElsewhere = Object.entries(routeDrivers).some(
                                        ([key, drvId]) => drvId === d.id && key !== `${stat.route.id}_${uNum}` && !(uNum === 1 && key === stat.route.id)
                                      );
                                      const isInternal = d.driver_type === 'internal' || (!d.driver_type && (d.name.toLowerCase().includes('internal') || (d.department || '').toLowerCase().includes('internal')));
                                      const typeTag = isInternal ? '🏢 [Internal PT]' : '💳 [Vendor]';

                                      return (
                                        <option key={d.id} value={d.id} disabled={isAssignedElsewhere}>
                                          👨‍✈️ {d.name} {typeTag} {d.phone ? `(${d.phone})` : ''} {isAssignedElsewhere ? '🚫 [Sudah Bertugas]' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-600 font-medium">Supir / Driver:</span>
                            <select
                              value={routeDrivers[`${stat.route.id}_1`] || routeDrivers[stat.route.id] || ''}
                              onChange={(e) => handleAssignDriverToRoute(stat.route.id, e.target.value, 1)}
                              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-xs"
                            >
                              <option value="">-- Pilih Supir Rute --</option>
                              {availableDrivers.map((d) => {
                                const isAssignedElsewhere = Object.entries(routeDrivers).some(
                                  ([key, drvId]) => drvId === d.id && key !== `${stat.route.id}_1` && key !== stat.route.id
                                );
                                const isInternal = d.driver_type === 'internal' || (!d.driver_type && (d.name.toLowerCase().includes('internal') || (d.department || '').toLowerCase().includes('internal')));
                                const typeTag = isInternal ? '🏢 [Internal PT]' : '💳 [Vendor]';

                                return (
                                  <option key={d.id} value={d.id} disabled={isAssignedElsewhere}>
                                    👨‍✈️ {d.name} {typeTag} {d.phone ? `(${d.phone})` : ''} {isAssignedElsewhere ? '🚫 [Sudah Bertugas]' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        {/* Source Vendor vs Internal Driver Selector */}
                        {(stat.route.unit_count || 1) > 1 ? (
                          <div className="flex flex-wrap items-center gap-2 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl my-1">
                            <span className="text-xs text-slate-700 font-bold w-full">🏢 Sumber Armada per Unit Mobil:</span>
                            {[...Array(stat.route.unit_count || 1)].map((_, uIdx) => {
                              const uNum = uIdx + 1;
                              const isKB = stat.route.route_name.toLowerCase().includes('karawang barat');
                              const unitLabel = isKB
                                ? uNum === 1
                                  ? 'Unit 1 (Tanjung Pura)'
                                  : uNum === 2
                                    ? 'Unit 2 (Galuh Mas)'
                                    : `Unit ${uNum}`
                                : `Unit ${uNum}`;

                              const isBillable = routeOverrides[`${stat.route.id}_${uNum}`] ?? (uNum === 1 ? routeOverrides[stat.route.id] : true) ?? true;

                              return (
                                <div key={uNum} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  <span className="text-[11px] text-slate-600 font-bold whitespace-nowrap">{unitLabel}:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUnitBillable(stat.route.id, uNum, isBillable)}
                                    className={`px-2.5 py-0.5 text-xs rounded-md font-bold transition-all border cursor-pointer flex items-center gap-1 ${isBillable
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                      }`}
                                  >
                                    {isBillable ? '💳 Sewa Vendor (Invoice)' : '🏢 Driver Sendiri (Rp 0)'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-600 font-medium">Sumber Armada:</span>
                            {(() => {
                              const isBillable = routeOverrides[`${stat.route.id}_1`] ?? routeOverrides[stat.route.id] ?? true;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRouteBillable(stat.route.id, isBillable)}
                                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all border cursor-pointer flex items-center gap-1 ${isBillable
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                    }`}
                                >
                                  {isBillable ? '💳 Sewa Vendor (Masuk Invoice)' : '🏢 Driver Sendiri / PT (Rp 0)'}
                                </button>
                              );
                            })()}
                          </div>
                        )}

                        {/* Invoice Billed Vehicle Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600 font-medium">Armada Invoice Vendor:</span>
                          <select
                            value={routeInvoiceVehicles[stat.route.id] || ''}
                            onChange={(e) => handleSetRouteInvoiceVehicle(stat.route.id, e.target.value)}
                            className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-xs"
                          >
                            <option value="">⚡ Otomatis ({stat.vehicleType})</option>
                            <option value="Avanza">🚗 Avanza (Tagihan Avanza)</option>
                            <option value="Elf Short">🚌 Elf Short (Tagihan Elf Short)</option>
                            <option value="Elf Long">🚐 Elf Long (Tagihan Elf Long)</option>
                          </select>
                        </div>

                        {/* Special Split Zonasi Button for Karawang Barat when 2 Avanza or > 6 passengers */}
                        {stat.route.route_name.toLowerCase().includes('karawang barat') && (
                          <div className="w-full pt-1 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSplitKarawangBaratNow(stat.route.id)}
                              disabled={isSplitting}
                              icon={<RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSplitting ? 'animate-spin' : ''}`} />}
                              className="text-xs py-1 px-2.5 bg-blue-50/70 hover:bg-blue-100/70 border-blue-200 text-blue-800 font-bold"
                              title="Otomatis bagi penumpang yang sudah booking ke Unit 1 (Tanjung Pura) & Unit 2 (Galuh Mas) sesuai halte"
                            >
                              {isSplitting ? 'Memproses...' : '⚡ Split Zonasi Penumpang (2 Avanza)'}
                            </Button>
                            <span className="text-[11px] text-slate-500">
                              (Pisahkan {stat.confirmedCount} penumpang yang sudah pesan ke Unit 1 & Unit 2)
                            </span>
                          </div>
                        )}
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

                      const getUnitLabel = (u: number) => {
                        const isKB = selectedRouteForMap?.route.route_name.toLowerCase().includes('karawang barat');
                        if (isKB) {
                          return u === 1 ? 'Tanjung Pura' : u === 2 ? 'Galuh Mas' : `Mobil Unit ${u}`;
                        }
                        return `Mobil Unit ${u}`;
                      };

                      return (
                        <button
                          key={uNum}
                          type="button"
                          onClick={() => setAdminSelectedUnit(uNum)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${isSel
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          {getUnitLabel(uNum)} ({unitBookingsCount} Penumpang)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const unitBookings = bookings.filter(
                  (b) => b.route_id === selectedRouteForMap.route.id &&
                    (b.unit_number || 1) === adminSelectedUnit &&
                    b.status === 'confirmed'
                );
                // Re-index seat numbers for display (1,2,3...) to handle bookings
                // that were made when route was Elf Short (seat numbers > 6)
                const remappedBookings = unitBookings.map((b, idx) => ({
                  ...b,
                  seat_number: idx + 1,
                }));
                const displayVehicle = (selectedRouteForMap.route.unit_count || 1) > 1
                  ? ((selectedRouteForMap.route.manual_vehicle_type as VehicleType) || 'Avanza')
                  : selectedRouteForMap.vehicleType;
                return (
                  <SeatMap
                    vehicleType={displayVehicle}
                    bookings={remappedBookings}
                    selectedSeat={null}
                    onSeatSelect={() => { }}
                  />
                );
              })()}
              {/* Quick Passenger Reassign List in Modal for Multi-Unit */}
              {(selectedRouteForMap.route.unit_count || 1) > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>👥 Pindahkan Penumpang antar Unit (Jika Over-capacity):</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Unit 1: {bookings.filter(b => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === 1 && b.status === 'confirmed').length} org • 
                      Unit 2: {bookings.filter(b => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === 2 && b.status === 'confirmed').length} org
                    </span>
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {bookings
                      .filter((b) => b.route_id === selectedRouteForMap.route.id && b.status === 'confirmed')
                      .map((b) => {
                        const empName = (b as any).employee?.name || 'Penumpang';
                        const pickup = b.pickup_point || '-';
                        const currentUnit = b.unit_number || 1;

                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <div className="truncate mr-2">
                              <span className="font-bold text-slate-900">{empName}</span>
                              <span className="text-[11px] text-slate-500 ml-1.5 truncate">
                                (📍 {pickup})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] text-slate-500 font-medium">Unit:</span>
                              <select
                                value={currentUnit}
                                onChange={async (e) => {
                                  const targetUnit = parseInt(e.target.value, 10);
                                  try {
                                    const { error } = await supabase
                                      .from('bookings')
                                      .update({ unit_number: targetUnit })
                                      .eq('id', b.id);
                                    if (error) throw error;
                                    toast.success(`${empName} dipindahkan ke Unit ${targetUnit}! 🚗`);
                                    refetch();
                                  } catch (err: any) {
                                    toast.error(err.message || 'Gagal memindahkan unit');
                                  }
                                }}
                                className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded-md text-blue-700 cursor-pointer shadow-2xs"
                              >
                                {[...Array(selectedRouteForMap.route.unit_count || 1)].map((_, idx) => {
                                  const u = idx + 1;
                                  const isKB = selectedRouteForMap.route.route_name.toLowerCase().includes('karawang barat');
                                  const label = isKB
                                    ? u === 1 ? 'Unit 1 (Tanjung Pura)' : u === 2 ? 'Unit 2 (Galuh Mas)' : `Unit ${u}`
                                    : `Unit ${u}`;
                                  return (
                                    <option key={u} value={u}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="text-center text-xs text-slate-500 mt-2">
            Hover / Tap pada nomor kursi merah untuk melihat nama penumpang.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
