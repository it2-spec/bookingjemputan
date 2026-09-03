// ============================================================
// Employee Onboarding & Mandatory Setup Modal
// Memastikan karyawan mengisi Izin Notifikasi, No. WhatsApp,
// Rute Utama, dan Titik Penjemputan Wajib (Tanpa Default Otomatis)
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellRing,
  Phone,
  MapPin,
  Bus,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  requestNotificationPermission,
  subscribeToPush,
} from '../../lib/notificationService';

import { ROUTE_SCHEDULES } from '../../lib/routeSchedules';
import type { Route } from '../../lib/types';
import toast from 'react-hot-toast';

export function EmployeeOnboardingModal() {
  const { employee, updateEmployeeState } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Form states
  const [phone, setPhone] = useState('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string>('');
  
  // Notification state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user is employee and needs onboarding
  useEffect(() => {
    if (!employee || employee.role !== 'employee') {
      setIsOpen(false);
      return;
    }

    const needsPhone = !employee.phone || employee.phone.trim().length < 8;
    const needsRoute = !employee.assigned_route_id;
    const needsPickup = !employee.default_pickup_point;

    // Also check current browser notification permission
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }

    if (needsPhone || needsRoute || needsPickup) {
      setPhone(employee.phone || '');
      setSelectedRouteId(employee.assigned_route_id || '');
      setSelectedPickupPoint(employee.default_pickup_point || '');
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [employee]);

  // Fetch routes from Supabase
  useEffect(() => {
    if (!isOpen) return;
    const fetchRoutes = async () => {
      try {
        const { data, error } = await supabase
          .from('routes')
          .select('*')
          .order('route_name', { ascending: true });
        if (!error && data) {
          setRoutes(data as Route[]);
          // If employee had an assigned route, keep it
          if (employee?.assigned_route_id && data.some(r => r.id === employee.assigned_route_id)) {
            setSelectedRouteId(employee.assigned_route_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch routes:', err);
      }
    };
    fetchRoutes();
  }, [isOpen, employee?.assigned_route_id]);

  // Selected route object
  const currentSelectedRoute = routes.find((r) => r.id === selectedRouteId);

  // Available stops for the chosen route
  const availableStops = (() => {
    if (!currentSelectedRoute) return [];
    const schedule = ROUTE_SCHEDULES.find(
      (s) => s.routeName.toLowerCase() === currentSelectedRoute.route_name.toLowerCase()
    );
    return schedule?.stops || [];
  })();

  // When route changes, reset selected pickup point unless already matching
  const handleRouteChange = (newRouteId: string) => {
    setSelectedRouteId(newRouteId);
    setSelectedPickupPoint(''); // Must be explicitly selected by employee
  };

  // Request Notification Permission
  const handleEnableNotification = async () => {
    setIsRequestingNotif(true);
    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        toast.success('Izin notifikasi diaktifkan! 🔔');
        if (employee?.id) {
          await subscribeToPush(employee.id);
        }
      } else if (perm === 'denied') {
        toast.error('Notifikasi ditolak. Anda dapat mengaktifkannya di pengaturan browser.');
      }
    } catch (err: any) {
      console.error('Failed to request notification permission:', err);
    } finally {
      setIsRequestingNotif(false);
    }
  };

  // Submit profile setup
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Phone validation
    const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      toast.error('Harap masukkan nomor WhatsApp/HP yang valid (min. 9 digit)!', { icon: '⚠️' });
      return;
    }

    // 2. Route validation
    if (!selectedRouteId || !currentSelectedRoute) {
      toast.error('Harap pilih rute jemputan utama Anda!', { icon: '⚠️' });
      return;
    }

    // 3. Pickup Point validation (Strictly mandatory)
    if (!selectedPickupPoint) {
      toast.error('Harap pilih titik penjemputan spesifik (Halte)!', { icon: '⚠️' });
      return;
    }

    setIsSubmitting(true);
    try {
      const dbUpdates = {
        phone: cleanPhone,
        assigned_route_id: currentSelectedRoute.id,
        default_pickup_point: selectedPickupPoint,
      };

      // 1. Update in Supabase (only valid DB columns)
      const { error } = await supabase
        .from('employees')
        .update(dbUpdates)
        .eq('id', employee!.id);

      if (error) throw error;

      // 2. Update local state in context
      updateEmployeeState({
        phone: cleanPhone,
        assigned_route_id: currentSelectedRoute.id,
        assigned_route_name: currentSelectedRoute.route_name,
        default_pickup_point: selectedPickupPoint,
      });
      localStorage.setItem(`shuttle_default_pickup_${employee!.id}`, selectedPickupPoint);
      localStorage.setItem('shuttle_last_pickup_point', selectedPickupPoint);

      toast.success('Profil & Titik Jemput berhasil disimpan! 🎉', { duration: 4000 });
      setIsOpen(false);
    } catch (err: any) {

      toast.error(err.message || 'Gagal menyimpan profil');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden my-6"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Selamat Datang di TRACER!</h2>
            <p className="text-xs text-blue-100 mt-1 max-w-sm mx-auto">
              Lengkapi informasi penjemputan Anda untuk memastikan penjemputan shuttle berjalan lancar setiap hari.
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 1. NOTIFICATION PERMISSION CARD */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                notifPermission === 'granted'
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {notifPermission === 'granted' ? (
                    <BellRing className="w-5 h-5" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      1. Izin Notifikasi Shuttle
                    </span>
                    {notifPermission === 'granted' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Dapatkan pengingat booking dan pantau lokasi supir secara real-time.
                  </p>

                  {notifPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleEnableNotification}
                      disabled={isRequestingNotif}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {isRequestingNotif ? 'Meminta Izin...' : 'Aktifkan Notifikasi'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. PHONE NUMBER INPUT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                2. Nomor WhatsApp / No. HP Aktif <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Supir akan menghubungi nomor ini jika ada kendala atau konfirmasi penjemputan.
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-semibold shadow-2xs"
                required
              />
            </div>

            {/* 3. ROUTE SELECTION */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-blue-600" />
                3. Rute Jemputan Utama <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Pilih rute shuttle yang biasa Anda gunakan setiap hari.
              </p>
              <select
                value={selectedRouteId}
                onChange={(e) => handleRouteChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-semibold shadow-2xs cursor-pointer"
                required
              >
                <option value="">-- Pilih Rute Jemputan --</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    🚌 {r.route_name} ({r.departure_time || '05:30'} WIB)
                  </option>
                ))}
              </select>
            </div>

            {/* 4. PICKUP POINT (HALTE) SELECTION */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                4. Titik Penjemputan Spesifik (Halte) <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Tentukan halte lokasi Anda menunggu armada. <span className="text-amber-700 font-semibold">Wajib dipilih sendiri.</span>
              </p>

              {!selectedRouteId ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 italic text-center">
                  Pilih rute jemputan terlebih dahulu untuk melihat daftar titik halte
                </div>
              ) : (
                <select
                  value={selectedPickupPoint}
                  onChange={(e) => setSelectedPickupPoint(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-semibold shadow-2xs cursor-pointer"
                  required
                >
                  <option value="">-- Pilih Titik Jemput --</option>
                  {availableStops.map((stop) => (
                    <option key={stop.name} value={stop.name}>
                      📍 {stop.name} (Estimasi jam: {stop.time} WIB)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedRouteId || !selectedPickupPoint || !phone.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Mulai Gunakan Shuttle'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
