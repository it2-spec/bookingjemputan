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
import type { Route, RouteChangeRequest } from '../lib/types';
import { APP_NAME, APP_VERSION } from '../lib/constants';
import { getInitials } from '../lib/utils';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { employee, logout } = useAuth();
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

  // Route change request state
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [pendingRequest, setPendingRequest] = useState<RouteChangeRequest | null>(null);
  const [showRouteChangeDialog, setShowRouteChangeDialog] = useState(false);
  const [selectedNewRouteId, setSelectedNewRouteId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchRouteInfo = async () => {
    if (!employee) return;
    try {
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
    await subscribeToPush(employee.id);
    await refreshPushStatus();
    setPushLoading(false);
  };

  const handleUnsubscribe = async () => {
    if (!employee) return;
    setPushLoading(true);
    await unsubscribeFromPush(employee.id);
    await refreshPushStatus();
    setPushLoading(false);
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
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
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
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
          {employee.name}
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">
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
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<CreditCard className="w-4 h-4" />}
              label="NIK"
              value={employee.nik}
              locked
            />
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<Building2 className="w-4 h-4" />}
              label="Departemen"
              value={employee.department}
              locked
            />
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<Phone className="w-4 h-4" />}
              label="No. Telepon"
              value={employee.phone || '-'}
            />
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
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
          Rute Jemputan Terdaftar
        </h3>
        <Card className="space-y-4 border-l-4 border-l-primary-600">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span className="text-base font-bold text-surface-900 dark:text-surface-100">
                  {currentRoute?.route_name || 'Karawang Barat'}
                </span>
              </div>
              <p className="text-xs text-surface-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Jam Keberangkatan: {currentRoute?.departure_time || '05:30:00'} WIB
              </p>
            </div>

            <button
              onClick={() => setShowRouteChangeDialog(true)}
              className="px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-semibold hover:bg-primary-100 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Ubah Rute
            </button>
          </div>

          {pendingRequest ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" /> Pengajuan Perubahan Rute Menunggu Approval Admin
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Meminta pindah rute ke <strong>{(pendingRequest as any)?.requested_route?.route_name || 'Rute Baru'}</strong>. Silakan hubungi admin untuk mempercepat proses persetujuan.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-surface-500">
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
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
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
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      Panel Admin
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">
                      Buka Dashboard Operasional
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-surface-400" />
              </button>
              <div className="border-b border-surface-100 dark:border-surface-800" />
            </>
          )}
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-between w-full cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                {isDark ? (
                  <Moon className="w-4 h-4 text-primary-500" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                  Mode Gelap
                </p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
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
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
          Notifikasi
        </h3>

        <Card animate={false}>
          <div className="space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                pushStatus === 'subscribed'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : pushStatus === 'denied'
                  ? 'bg-red-100 dark:bg-red-900/40'
                  : 'bg-amber-100 dark:bg-amber-900/40'
              }`}>
                {pushStatus === 'subscribed' ? (
                  <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : pushStatus === 'denied' ? (
                  <BellOff className="w-4 h-4 text-red-500" />
                ) : (
                  <BellRing className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                  Push Notifikasi
                </p>
                <p className={`text-xs ${
                  pushStatus === 'subscribed'
                    ? 'text-emerald-600 dark:text-emerald-400'
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
                <div className="border-b border-surface-100 dark:border-surface-800" />
                {/* Test button */}
                <button
                  onClick={handleTestNotification}
                  className="flex items-center justify-between w-full cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-900 transition-colors">
                      <BellRing className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        Kirim Notifikasi Test
                      </p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">
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
                        <ChevronRight className="w-5 h-5 text-surface-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <div className="border-b border-surface-100 dark:border-surface-800" />
                {/* Unsubscribe */}
                <button
                  onClick={handleUnsubscribe}
                  disabled={pushLoading}
                  className="flex items-center gap-3 w-full cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <BellOff className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-500">
                      {pushLoading ? 'Memproses...' : 'Batalkan Notifikasi'}
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">
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
            <Info className="w-4 h-4 text-surface-400" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
              {APP_NAME}
            </p>
          </div>
          <p className="text-xs text-surface-400 dark:text-surface-500">
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
          <p className="text-sm text-surface-600 dark:text-surface-400">
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
          <p className="text-xs text-surface-600 dark:text-surface-400">
            Pilih rute jemputan baru yang Anda inginkan. Pengajuan ini membutuhkan verifikasi dan approval dari Admin sebelum berlaku.
          </p>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Rute Saat Ini
            </label>
            <input
              type="text"
              disabled
              value={currentRoute?.route_name || 'Karawang Barat'}
              className="w-full px-3 py-2 text-sm bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Pilih Rute Baru Target <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedNewRouteId}
              onChange={(e) => setSelectedNewRouteId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
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
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Alasan Perubahan Rute (Opsional)
            </label>
            <textarea
              rows={2}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Contoh: Pindah domisili tempat tinggal..."
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
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
      <div className="text-primary-500 dark:text-primary-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
          {value}
        </p>
      </div>
      {locked && (
        <span className="text-[9px] text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
          🔒
        </span>
      )}
    </div>
  );
}
