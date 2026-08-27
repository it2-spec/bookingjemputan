// ============================================================
// Push Notification Devices Management Page
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import {
  Smartphone,
  Search,
  Trash2,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PushDevice {
  id: string;
  employee_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  employee?: {
    nik: string;
    name: string;
    department: string;
    role: string;
  } | null;
}

export default function AdminPushDevicesPage() {
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingDevice, setDeletingDevice] = useState<PushDevice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testingDevice, setTestingDevice] = useState<PushDevice | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select(`
          id,
          employee_id,
          endpoint,
          p256dh,
          auth,
          created_at,
          employee:employees(nik, name, department, role)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching push subscriptions:', error);
        toast.error('Gagal memuat daftar perangkat');
      } else {
        setDevices((data as any) || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', deletingDevice.id);

      if (error) {
        toast.error('Gagal menghapus perangkat');
      } else {
        toast.success('Perangkat berhasil dihapus');
        setDevices((prev) => prev.filter((d) => d.id !== deletingDevice.id));
        setDeletingDevice(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

      if (error) {
        toast.error('Gagal mengosongkan daftar perangkat');
      } else {
        toast.success('Semua token perangkat lama berhasil dibersihkan');
        setDevices([]);
        setShowClearAllDialog(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan');
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleSendTestPush = async (device: PushDevice) => {
    setTestingDevice(device);
    setIsTesting(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: '🔔 Test Notifikasi TRACER',
          message: `Halo ${device.employee?.name || 'User'}, ini notifikasi uji coba ke perangkat Anda!`,
          targetEndpoint: device.endpoint,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.sent > 0) {
          toast.success(`Push berhasil terkirim ke perangkat ${device.employee?.name || ''}!`);
        } else {
          const detail = result.errors?.[0] ? ` (${result.errors[0]})` : '';
          toast.error(`Push gagal terkirim: Token expired atau browser menolak${detail}`);
          fetchDevices();
        }
      } else {
        const errText = await res.text();
        console.warn(errText);
        toast.error('Gagal memanggil Supabase Edge Function');
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan saat kirim test push');
    } finally {
      setIsTesting(false);
      setTestingDevice(null);
    }
  };

  const getBrowserInfo = (endpoint: string) => {
    if (endpoint.startsWith('native:') || endpoint.includes('native-android')) {
      return { name: '📱 Android Native (APK)', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
    }
    if (endpoint.includes('fcm.googleapis.com') || endpoint.includes('google.com')) {
      return { name: '🌐 Chrome / Android PWA', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
    }
    if (endpoint.includes('mozilla.com')) {
      return { name: '🦊 Mozilla Firefox', color: 'text-orange-700 bg-orange-50 border border-orange-200' };
    }
    if (endpoint.includes('apple.com')) {
      return { name: '🍎 Apple Safari / iOS APNs', color: 'text-blue-700 bg-blue-50 border border-blue-200' };
    }
    if (endpoint.includes('microsoft.com') || endpoint.includes('windows.com')) {
      return { name: '💻 Microsoft Edge / Windows', color: 'text-cyan-700 bg-cyan-50 border border-cyan-200' };
    }
    return { name: 'Web Push Gateway', color: 'text-slate-700 bg-slate-50 border border-slate-200' };
  };

  const filteredDevices = devices.filter((d) => {
    const term = searchTerm.toLowerCase();
    const name = d.employee?.name?.toLowerCase() || '';
    const nik = d.employee?.nik?.toLowerCase() || '';
    const dept = d.employee?.department?.toLowerCase() || '';
    const endpoint = d.endpoint.toLowerCase();
    return name.includes(term) || nik.includes(term) || dept.includes(term) || endpoint.includes(term);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)] flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-primary-600" />
            <span>Perangkat Terdaftar (Push Notification)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Daftar browser & HP karyawan yang berlangganan Web Push Notifikasi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {devices.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearAllDialog(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Bersihkan Semua</span>
            </Button>
          )}
        </div>
      </div>

      {/* Info Card: Why 0 sent / 33 failed occurs */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Informasi Status Pengiriman Push Notification</span>
        </div>
        <p className="text-amber-800/90 leading-relaxed">
          Jika status broadcast menampilkan <strong>"0 terkirim, X gagal"</strong>, hal ini biasanya dikarenakan:
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-800/80 pl-1">
          <li>Pengguna telah logout, menghapus cache/data browser, atau mencabut izin notifikasi di pengaturan HP/browser.</li>
          <li>Token langganan lama sudah <em>Expired / Expired by Push Service (FCM/Apple)</em>.</li>
          <li>Edge Function <code>send-push</code> otomatis menghapus token yang ditolak (HTTP 410 Gone) saat broadcast dijalankan.</li>
        </ul>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan NIK, nama karyawan, atau departemen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Total: <strong className="text-slate-900">{devices.length}</strong> Perangkat</span>
          {searchTerm && (
            <span className="text-slate-400">({filteredDevices.length} ditemukan)</span>
          )}
        </div>
      </div>

      {/* Devices List Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-3" />
          <p className="text-sm font-medium">Memuat data perangkat terdaftar...</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <Card className="py-12 text-center text-slate-400">
          <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Tidak ada perangkat yang ditemukan</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'Coba ubah kata kunci pencarian' : 'Belum ada pengguna yang mendaftarkan izin push notifikasi'}
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Karyawan</th>
                  <th className="px-4 py-3.5">Browser / Gateway</th>
                  <th className="px-4 py-3.5">Waktu Terdaftar</th>
                  <th className="px-4 py-3.5">Token Endpoint</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDevices.map((device) => {
                  const browser = getBrowserInfo(device.endpoint);
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        {device.employee ? (
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{device.employee.name}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                {device.employee.nik}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span>{device.employee.department}</span>
                              <span>•</span>
                              <span className="capitalize">{device.employee.role}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">User Guest / Anonim</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${browser.color}`}>
                          <Globe className="w-3 h-3" />
                          {browser.name}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(device.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-[200px]">
                        <p className="font-mono text-[10px] text-slate-500 truncate" title={device.endpoint}>
                          {device.endpoint}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSendTestPush(device)}
                            disabled={isTesting && testingDevice?.id === device.id}
                            title="Kirim Test Notifikasi"
                            className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingDevice(device)}
                            title="Hapus Perangkat"
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Device Delete Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deletingDevice)}
        onClose={() => setDeletingDevice(null)}
        title="Hapus Perangkat Terdaftar"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus token langganan perangkat untuk{' '}
            <strong>{deletingDevice?.employee?.name || 'perangkat ini'}</strong>?
          </p>
          <p className="text-xs text-slate-400 bg-slate-50 p-2 rounded-lg break-all font-mono">
            {deletingDevice?.endpoint}
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingDevice(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteDevice}
              disabled={isDeleting}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Perangkat'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Clear All Dialog */}
      <Dialog
        isOpen={showClearAllDialog}
        onClose={() => setShowClearAllDialog(false)}
        title="Bersihkan Semua Token Perangkat"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Tindakan ini akan menghapus <strong>semua ({devices.length})</strong> data token langganan push notification yang tersimpan di database.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            Karyawan akan diminta mendaftarkan kembali izin notifikasinya saat membuka aplikasi berikutnya.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearAllDialog(false)}
              disabled={isClearingAll}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearAll}
              disabled={isClearingAll}
            >
              {isClearingAll ? 'Membersihkan...' : 'Ya, Bersihkan Semua'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
