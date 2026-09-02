import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  CreditCard,
  Building2,
  Phone,
  LogOut,
  Moon,
  Sun,
  Info,
  Shield,
  ChevronRight,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  MapPin,
  Clock,
  Edit3,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  requestNotificationPermission,
  showLocalNotification,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionStatus,
} from '../lib/notificationService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getScheduleByRouteName } from '../lib/routeSchedules';
import type { Route, RouteChangeRequest } from '../lib/types';
import { APP_NAME, APP_VERSION } from '../lib/constants';
import { getInitials } from '../lib/utils';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { employee, logout, updateEmployeeState } = useAuth();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [notifSupported, setNotifSupported] = useState(false);
  const [testSent, setTestSent] = useState(false);
  // 'subscribed' | 'granted' (perm ok but not subscribed) | 'default' | 'denied'
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'granted' | 'default' | 'denied'>('default');
  const [pushLoading, setPushLoading] = useState(false);

  // Phone edit state
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneInput, setPhoneInput] = useState(employee?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  // Route change request state
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [pendingRequest, setPendingRequest] = useState<RouteChangeRequest | null>(null);
  const [showRouteChangeDialog, setShowRouteChangeDialog] = useState(false);
  const [selectedNewRouteId, setSelectedNewRouteId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [defaultPickupPoint, setDefaultPickupPoint] = useState<string>(() => {
    return (
      employee?.default_pickup_point ||
      (employee?.id ? localStorage.getItem(`shuttle_default_pickup_${employee.id}`) : '') ||
      ''
    );
  });
  const [savingDefaultPickup, setSavingDefaultPickup] = useState(false);


  useEffect(() => {
    const saved =
      employee?.default_pickup_point ||
      (employee?.id ? localStorage.getItem(`shuttle_default_pickup_${employee.id}`) : '');
    if (saved) {
      setDefaultPickupPoint(saved);
    }
  }, [employee?.default_pickup_point, employee?.id]);

  const handleSaveDefaultPickupPoint = async (pointName: string) => {
    if (!employee) return;
    setDefaultPickupPoint(pointName);
    setSavingDefaultPickup(true);

    // 1. Instant local persistence (keyed per user ID)
    localStorage.setItem(`shuttle_default_pickup_${employee.id}`, pointName);
    localStorage.setItem('shuttle_last_pickup_point', pointName);
    employee.default_pickup_point = pointName;
    localStorage.setItem('shuttle_booking_employee', JSON.stringify(employee));

    try {
      // 2. Database persistence
      await supabase
        .from('employees')
        .update({ default_pickup_point: pointName })
        .eq('id', employee.id);

      toast.success(`Titik jemput default tersimpan: "${pointName}"`);
    } catch (err: any) {
      console.log('Database sync note:', err);
      toast.success(`Titik jemput default tersimpan: "${pointName}"`);
    } finally {
      setSavingDefaultPickup(false);
    }
  };

  const handleSavePhone = async () => {
    if (!employee) return;
    const clean = phoneInput.trim().replace(/[^0-9+]/g, '');
    if (!clean || clean.length < 9) {
      toast.error('Nomor WhatsApp tidak valid (min. 9 digit)!');
      return;
    }
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ phone: clean })
        .eq('id', employee.id);
      if (error) throw error;
      updateEmployeeState({ phone: clean });
      toast.success('Nomor telepon berhasil diperbarui! 📱');
      setShowPhoneDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan nomor telepon');
    } finally {
      setSavingPhone(false);
    }
  };

  const fetchRouteInfo = async () => {

    if (!employee) return;
    try {
      // Restore default pickup point from DB or local cache
      const { data: freshEmp } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employee.id)
        .maybeSingle();

      if (freshEmp && (freshEmp as any).default_pickup_point) {
        const p = (freshEmp as any).default_pickup_point;
        setDefaultPickupPoint(p);
        employee.default_pickup_point = p;
        localStorage.setItem(`shuttle_default_pickup_${employee.id}`, p);
        localStorage.setItem('shuttle_booking_employee', JSON.stringify(employee));
      }

      const { data: rData } = await supabase.from('routes').select('*');
      if (rData) {
        setAllRoutes(rData as Route[]);
        if (employee.assigned_route_id) {
          const match = rData.find((r) => r.id === employee.assigned_route_id);
          if (match) setCurrentRoute(match as Route);
        } else {
          // Default default route if none explicitly assigned yet
          const karawangBarat = rData.find((r) => r.route_name.toLowerCase().includes('karawang barat'));
          if (karawangBarat) setCurrentRoute(karawangBarat as Route);
        }
      }

      // Check pending request
      const { data: reqData } = await supabase
        .from('route_change_requests')
        .select('*, requested_route:routes(route_name)')
        .eq('employee_id', employee.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (reqData) {
        setPendingRequest(reqData as any);
      } else {
        setPendingRequest(null);
      }
    } catch (e) {
      console.log('Error fetching route info:', e);
    }
  };

  const handleCreateRouteChangeRequest = async () => {
    if (!employee || !selectedNewRouteId) {
      toast.error('Pilih rute tujuan terlebih dahulu');
      return;
    }
    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('route_change_requests').insert({
        employee_id: employee.id,
        current_route_id: currentRoute?.id || null,
        requested_route_id: selectedNewRouteId,
        reason: changeReason || 'Pengajuan via aplikasi',
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Pengajuan perubahan rute berhasil dikirim! Menunggu approval admin.', {
        duration: 4000,
      });
      setShowRouteChangeDialog(false);
      fetchRouteInfo();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengajukan perubahan rute');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const refreshPushStatus = async () => {
    const supported = await isPushSupported();
    setNotifSupported(supported);
    if (supported) {
      const status = await getPushSubscriptionStatus();
      setPushStatus(status);
    }
  };

  useEffect(() => {
    refreshPushStatus();
    fetchRouteInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted' && employee) {
      setPushLoading(true);
      await subscribeToPush(employee.id);
      setPushLoading(false);
    }
    await refreshPushStatus();
  };

  const handleSubscribe = async () => {
    if (!employee) return;
    setPushLoading(true);
    try {
      await subscribeToPush(employee.id);
      toast.success('Notifikasi berhasil diaktifkan');
    } catch {
      toast.error('Gagal mengaktifkan notifikasi');
    } finally {
      await refreshPushStatus();
      setPushLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!employee) return;
    setPushLoading(true);
    try {
      await unsubscribeFromPush(employee.id);
      toast.success('Langganan notifikasi berhasil dibatalkan');
    } catch {
      toast.error('Gagal membatalkan langganan');
    } finally {
      await refreshPushStatus();
      setPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    await showLocalNotification(
      '🚌 Test Notifikasi Berhasil!',
      `Hei ${employee?.name.split(' ')[0]}, notifikasi pengingat jemputan Anda sudah aktif. Notifikasi akan muncul bahkan saat aplikasi ditutup!`,
    );
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };

  if (!employee) return null;

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
          Profil
        </h1>
      </motion.div>

      {/* Avatar & Name */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center py-4"
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow mb-3">
          <span className="text-2xl font-bold text-white">
            {getInitials(employee.name)}
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 font-[family-name:var(--font-display)]">
          {employee.name}
        </h2>
        <p className="text-sm text-slate-600">
          {employee.department}
        </p>
      </motion.div>

      {/* Profile info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <div className="space-y-4">
            <ProfileField
              icon={<User className="w-4 h-4" />}
              label="Nama Lengkap"
              value={employee.name}
              locked
            />
            <div className="border-b border-slate-100" />
            <ProfileField
              icon={<CreditCard className="w-4 h-4" />}
              label="NIK"
              value={employee.nik}
              locked
            />
            <div className="border-b border-slate-100" />
            <ProfileField
              icon={<Building2 className="w-4 h-4" />}
              label="Departemen"
              value={employee.department}
              locked
            />
            <div className="border-b border-slate-100" />
            <div className="flex items-center justify-between">
              <ProfileField
                icon={<Phone className="w-4 h-4" />}
                label="No. WhatsApp / HP"
                value={employee.phone || 'Belum diisi'}
              />
              <button
                type="button"
                onClick={() => {
                  setPhoneInput(employee.phone || '');
                  setShowPhoneDialog(true);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" /> Ubah
              </button>
            </div>
          </div>
        </Card>
      </motion.div>


      {/* Rute Jemputan Terdaftar Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-3"
      >
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Rute Jemputan Terdaftar
        </h3>
        <Card className="space-y-4 border-l-4 border-l-primary-600">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                <span className="text-base font-bold text-slate-900">
                  {currentRoute?.route_name || 'Karawang Barat'}
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Jam Keberangkatan: {currentRoute?.departure_time || '05:30:00'} WIB
              </p>
            </div>

            <button
              onClick={() => setShowRouteChangeDialog(true)}
              className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-200 text-xs font-semibold hover:bg-primary-100 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Ubah Rute
            </button>
          </div>

          {/* Default Pickup Point Setting */}
          {currentRoute && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Titik Jemput Default Saya (Halte Favorit)
              </label>
              <p className="text-[11px] text-slate-600">
                Pilihan halte ini akan otomatis terpilih secara default saat Anda membuka pemesanan shuttle.
              </p>
              <select
                value={defaultPickupPoint}
                disabled={savingDefaultPickup}
                onChange={(e) => handleSaveDefaultPickupPoint(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 font-semibold text-slate-900 cursor-pointer"
              >
                <option value="">-- Pilih Halte Favorit Default --</option>
                {getScheduleByRouteName(currentRoute.route_name)?.stops.map((stop) => (
                  <option key={stop.name} value={stop.name}>
                    📍 {stop.name} (Jam Est. {stop.time} WIB)
                  </option>
                ))}
              </select>
            </div>
          )}

          {pendingRequest ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                <AlertTriangle className="w-4 h-4" /> Pengajuan Perubahan Rute Menunggu Approval Admin
              </div>
              <p className="text-[11px] text-amber-700">
                Meminta pindah rute ke <strong>{(pendingRequest as any)?.requested_route?.route_name || 'Rute Baru'}</strong>. Silakan hubungi admin untuk mempercepat proses persetujuan.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-600">
              * Sesuai ketentuan, Anda hanya dapat memesan tiket shuttle pada rute yang telah disetujui di profil Anda.
            </p>
          )}
        </Card>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Pengaturan
        </h3>

        <Card animate={false} className="space-y-3">
          {employee.role === 'admin' && (
            <>
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center justify-between w-full cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900">
                      Panel Admin
                    </p>
                    <p className="text-xs text-slate-500">
                      Buka Dashboard Operasional
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
              <div className="border-b border-slate-100" />
            </>
          )}
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-between w-full cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                {isDark ? (
                  <Moon className="w-4 h-4 text-primary-500" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">
                  Mode Gelap
                </p>
                <p className="text-xs text-slate-500">
                  {isDark ? 'Aktif' : 'Nonaktif'}
                </p>
              </div>
            </div>
            <div
              className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                isDark ? 'bg-primary-600' : 'bg-surface-300'
              } relative`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  isDark ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </Card>
      </motion.div>

      {/* Notification Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="space-y-3"
      >
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Notifikasi
        </h3>

        <Card animate={false}>
          <div className="space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                pushStatus === 'subscribed'
                  ? 'bg-emerald-100'
                  : pushStatus === 'denied'
                  ? 'bg-red-100'
                  : 'bg-amber-100'
              }`}>
                {pushStatus === 'subscribed' ? (
                  <Bell className="w-4 h-4 text-emerald-600" />
                ) : pushStatus === 'denied' ? (
                  <BellOff className="w-4 h-4 text-red-500" />
                ) : (
                  <BellRing className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  Push Notifikasi
                </p>
                <p className={`text-xs ${
                  pushStatus === 'subscribed'
                    ? 'text-emerald-600'
                    : pushStatus === 'denied'
                    ? 'text-red-500'
                    : 'text-amber-600'
                }`}>
                  {!notifSupported
                    ? 'Tidak didukung di browser ini'
                    : pushStatus === 'subscribed'
                    ? '✓ Aktif — bekerja bahkan saat app ditutup'
                    : pushStatus === 'denied'
                    ? 'Ditolak — aktifkan di pengaturan browser'
                    : pushStatus === 'granted'
                    ? 'Izin OK, belum terdaftar'
                    : 'Belum diizinkan'}
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            {notifSupported && pushStatus === 'default' && (
              <button
                onClick={handleRequestPermission}
                disabled={pushLoading}
                className="w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60"
              >
                {pushLoading ? 'Memproses...' : 'Izinkan & Daftarkan Notifikasi'}
              </button>
            )}

            {notifSupported && pushStatus === 'granted' && (
              <button
                onClick={handleSubscribe}
                disabled={pushLoading}
                className="w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60"
              >
                {pushLoading ? 'Mendaftar...' : 'Daftarkan Perangkat Ini'}
              </button>
            )}

            {/* Subscribed actions */}
            {pushStatus === 'subscribed' && (
              <>
                <div className="border-b border-slate-100" />
                {/* Test button */}
                <button
                  onClick={handleTestNotification}
                  className="flex items-center justify-between w-full cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                      <BellRing className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">
                        Test Push Notifikasi
                      </p>
                      <p className="text-xs text-slate-500">
                        Cek apakah notifikasi berfungsi
                      </p>
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {testSent ? (
                      <motion.div key="check" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </motion.div>
                    ) : (
                      <motion.div key="chevron" initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <div className="border-b border-slate-100" />
                {/* Unsubscribe */}
                <button
                  onClick={handleUnsubscribe}
                  disabled={pushLoading}
                  className="flex items-center gap-3 w-full cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <BellOff className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-600">
                      {pushLoading ? 'Memproses...' : 'Batalkan Langganan'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Hapus perangkat ini dari daftar penerima
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        </Card>
      </motion.div>

      {/* App info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card animate={false} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Info className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
              {APP_NAME}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Versi {APP_VERSION}
          </p>
        </Card>
      </motion.div>

      {/* Logout button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          variant="danger"
          fullWidth
          size="lg"
          icon={<LogOut className="w-5 h-5" />}
          onClick={() => setShowLogoutDialog(true)}
        >
          Keluar
        </Button>
      </motion.div>

      {/* Logout confirmation */}
      <Dialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        title="Keluar"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Apakah Anda yakin ingin keluar dari aplikasi?
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowLogoutDialog(false)}
            >
              Batal
            </Button>
            <Button variant="danger" fullWidth onClick={handleLogout}>
              Ya, Keluar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Route Change Request Dialog */}
      <Dialog
        isOpen={showRouteChangeDialog}
        onClose={() => setShowRouteChangeDialog(false)}
        title="Ajukan Perubahan Rute Jemputan"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-700">
            Pilih rute jemputan baru yang Anda inginkan. Pengajuan ini membutuhkan verifikasi dan approval dari Admin sebelum berlaku.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Rute Saat Ini
            </label>
            <input
              type="text"
              disabled
              value={currentRoute?.route_name || 'Karawang Barat'}
              className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Pilih Rute Baru Target <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedNewRouteId}
              onChange={(e) => setSelectedNewRouteId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900"
            >
              <option value="">-- Pilih Rute Target --</option>
              {allRoutes
                .filter((r) => r.id !== currentRoute?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.route_name} ({r.departure_time} WIB)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Alasan Perubahan Rute (Opsional)
            </label>
            <textarea
              rows={2}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Contoh: Pindah domisili tempat tinggal..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowRouteChangeDialog(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!selectedNewRouteId || submittingRequest}
              onClick={handleCreateRouteChangeRequest}
              icon={<Send className="w-4 h-4" />}
            >
              {submittingRequest ? 'Mengirim...' : 'Kirim Pengajuan'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Phone Dialog */}

      <Dialog
        isOpen={showPhoneDialog}
        onClose={() => setShowPhoneDialog(false)}
        title="Ubah Nomor WhatsApp / HP"
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-600">
            Pastikan nomor WhatsApp Anda aktif agar supir atau admin dapat menghubungi Anda terkait penjemputan.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Nomor WhatsApp / HP Aktif <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 font-semibold"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowPhoneDialog(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={savingPhone || !phoneInput.trim()}
              onClick={handleSavePhone}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {savingPhone ? 'Menyimpan...' : 'Simpan Nomor'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );

}

function ProfileField({
  icon,
  label,
  value,
  locked = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary-500 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">
          {value}
        </p>
      </div>
      {locked && (
        <span className="text-[9px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          🔒
        </span>
      )}
    </div>
  );
}
