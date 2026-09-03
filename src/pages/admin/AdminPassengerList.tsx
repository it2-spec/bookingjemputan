// ============================================================
// Admin Passenger List Page
// ============================================================

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Download,
  Search,
  XCircle,
  Bus,
  MapPin,
  UserPlus,
  ShieldCheck,
  Moon,
  CheckCircle,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useAdminBookings, useCancelBooking } from '../../hooks/useBooking';
import { DRIVER_VEHICLE_MODELS } from '../../components/driver/DriverProfileModal';
import { LicensePlateInput } from '../../components/ui/LicensePlateInput';
import { useRoutes } from '../../hooks/useRoutes';
import { supabase } from '../../lib/supabase';
import {
  getTomorrowDate,
  formatDateIndonesian,
  formatTimeWIB,
} from '../../lib/vehicleLogic';
import type { Booking, UserRole } from '../../lib/types';
import toast from 'react-hot-toast';

export default function AdminPassengerList() {
  const [searchParams] = useSearchParams();
  const routeParam = searchParams.get('route');
  const dateParam = searchParams.get('date');

  const [selectedDate, setSelectedDate] = useState(dateParam || getTomorrowDate());
  const [selectedRoute, setSelectedRoute] = useState(routeParam || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

  // New User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newNik, setNewNik] = useState('');
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Executive');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('superadmin');
  const [newDriverType, setNewDriverType] = useState<'internal' | 'vendor'>('vendor');
  const [newDriverPlate, setNewDriverPlate] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState<string>(DRIVER_VEHICLE_MODELS[0]);
  const [savingUser, setSavingUser] = useState(false);

  const { data: routes } = useRoutes();
  const { data: bookings = [], isLoading, refetch } = useAdminBookings(selectedDate);
  const cancelBookingMutation = useCancelBooking();

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesRoute = selectedRoute === 'all' || b.route_id === selectedRoute;
    const emp = (b as any).employee;
    const matchesSearch =
      !searchTerm ||
      emp?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp?.nik?.includes(searchTerm) ||
      emp?.department?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRoute && matchesSearch;
  });

  const handleExportExcel = () => {
    if (filteredBookings.length === 0) {
      toast.error('Tidak ada data untuk diexport.');
      return;
    }

    const dataToExport = filteredBookings.map((b, idx) => ({
      No: idx + 1,
      NIK: (b as any).employee?.nik || '-',
      Nama: (b as any).employee?.name || '-',
      Departemen: (b as any).employee?.department || '-',
      No_HP: (b as any).employee?.phone || '-',
      Rute: (b as any).route?.route_name || '-',
      Titik_Jemput: b.pickup_point || '-',
      No_Kursi: b.seat_number,
      Kendaraan: b.vehicle_type,
      Tanggal: b.departure_date,
      Status: b.status,
      Status_Kepulangan: (b as any).is_overtime_no_return
        ? 'Lembur (Tidak Pulang Reguler 16:30)'
        : 'Ikut Pulang Reguler (16:30)',
      Waktu_Pesan: formatTimeWIB(b.created_at),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Penumpang');

    XLSX.writeFile(
      workbook,
      `Daftar_Penumpang_Shuttle_${selectedDate}.xlsx`
    );
    toast.success('File Excel berhasil di-download! 📊');
  };

  const handleToggleOvertime = async (booking: Booking) => {
    const newStatus = !(booking as any).is_overtime_no_return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ is_overtime_no_return: newStatus })
        .eq('id', booking.id);
      if (error) throw error;
      toast.success(
        newStatus
          ? `${(booking as any).employee?.name || 'Penumpang'} ditandai LEMBUR (Tidak Ikut Pulang 16:30) 🌙`
          : `${(booking as any).employee?.name || 'Penumpang'} diset IKUT PULANG PP 🚗`
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status kepulangan');
    }
  };


  const handleAdminCancel = async () => {
    if (!cancellingBooking) return;
    try {
      await cancelBookingMutation.mutateAsync(cancellingBooking.id);
      toast.success('Booking penumpang telah dibatalkan (Admin)');
      setCancellingBooking(null);
      refetch();
    } catch {
      toast.error('Gagal membatalkan booking penumpang');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNik.trim() || !newName.trim()) {
      toast.error('NIK dan Nama wajib diisi');
      return;
    }
    setSavingUser(true);
    try {
      const payload: any = {
        nik: newNik.trim(),
        name: newName.trim(),
        department: newDepartment.trim(),
        phone: newPhone.trim() || null,
        role: newRole,
      };
      if (newRole === 'driver') {
        payload.driver_type = newDriverType;
        payload.license_plate = newDriverPlate.trim() || null;
        payload.vehicle_model = newDriverVehicle || null;
      }

      const { error } = await supabase.from('employees').insert(payload);

      if (error) throw error;

      toast.success(`User ${newName} dengan role ${newRole} berhasil dibuat!`);
      setShowAddUserModal(false);
      setNewNik('');
      setNewName('');
      setNewPhone('');
      setNewDriverPlate('');
      setNewDriverVehicle(DRIVER_VEHICLE_MODELS[0]);
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat user baru');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
            Daftar Penumpang Jemputan
          </h1>
          <p className="text-sm text-slate-600">
            {formatDateIndonesian(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAddUserModal(true)}
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
          >
            + Tambah User Baru
          </Button>
          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4 text-emerald-600" />}
          >
            Export Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1">
              Tanggal Keberangkatan
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
            />
          </div>

          {/* Route Selector */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1">
              Filter Rute
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
            >
              <option value="all">Semua Rute</option>
              {routes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.route_name}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1">
              Cari Karyawan / NIK
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Nama, NIK, Dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Passenger Table / Card List */}
      {isLoading ? (
        <p className="text-center py-8 text-sm text-surface-500">Memuat penumpang...</p>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <p className="text-sm font-semibold text-slate-600">
            Tidak ada penumpang ditemukan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking, idx) => {
            const emp = (booking as any).employee;
            const rte = (booking as any).route;
            const isConfirmed = booking.status === 'confirmed';

            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Employee Info */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm shrink-0">
                        {booking.seat_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">
                            {emp?.name || 'Nama Karyawan'}
                          </h4>
                          <Badge variant={isConfirmed ? 'success' : 'danger'}>
                            {booking.status}
                          </Badge>
                          {(booking as any).is_overtime_no_return && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-300 flex items-center gap-1 shadow-2xs">
                              <Moon className="w-3 h-3 text-purple-600" /> Lembur (Off Pulang)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          NIK: <span className="font-mono text-slate-700">{emp?.nik}</span> • {emp?.department}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-primary-500" />
                            {rte?.route_name}
                          </span>
                          {booking.pickup_point && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-1">
                              📍 Halte: {booking.pickup_point}
                            </span>
                          )}
                          {/* Unit Selector / Badge */}
                          {rte?.unit_count && rte.unit_count > 1 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-500 font-medium">Pindah Unit:</span>
                              <select
                                value={booking.unit_number || 1}
                                onChange={async (e) => {
                                  const newUnit = parseInt(e.target.value, 10);
                                  try {
                                    const { error } = await supabase
                                      .from('bookings')
                                      .update({ unit_number: newUnit })
                                      .eq('id', booking.id);
                                    if (error) throw error;
                                    toast.success(`${emp?.name || 'Penumpang'} dipindahkan ke Unit ${newUnit}! 🚗`);
                                    refetch();
                                  } catch (err: any) {
                                    toast.error(err.message || 'Gagal memindahkan unit penumpang');
                                  }
                                }}
                                className="px-2 py-0.5 text-xs font-bold bg-blue-50 border border-blue-300 text-blue-800 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                              >
                                {[...Array(rte.unit_count || 1)].map((_, uIdx) => {
                                  const uNum = uIdx + 1;
                                  const isKB = rte.route_name.toLowerCase().includes('karawang barat');
                                  const label = isKB
                                    ? uNum === 1
                                      ? '🚗 Unit 1 (Tanjung Pura)'
                                      : uNum === 2
                                        ? '🚗 Unit 2 (Galuh Mas)'
                                        : `🚗 Unit ${uNum}`
                                    : `🚗 Unit ${uNum}`;
                                  return (
                                    <option key={uNum} value={uNum}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          ) : (
                            (rte?.unit_count || 1) > 1 && booking.unit_number && booking.unit_number > 1 ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                                🚗 Unit {booking.unit_number} {rte?.route_name.toLowerCase().includes('karawang barat') ? (booking.unit_number === 2 ? '(Galuh Mas)' : '(Tanjung Pura)') : ''}
                              </span>
                            ) : null
                          )}
                          <span className="flex items-center gap-1">
                            <Bus className="w-3 h-3 text-sky-500" />
                            {booking.vehicle_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isConfirmed && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleToggleOvertime(booking)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                            (booking as any).is_overtime_no_return
                              ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700'
                              : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                          title={(booking as any).is_overtime_no_return ? 'Klik untuk kembalikan ke Ikut Pulang Reguler' : 'Tandai Karyawan Lembur (Tidak Ikut Pulang Sore 16:30)'}
                        >
                          {(booking as any).is_overtime_no_return ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Lembur (Off Pulang)</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-3.5 h-3.5 text-purple-500" />
                              <span>Tandai Lembur</span>
                            </>
                          )}
                        </button>

                        <Button
                          variant="danger"
                          size="sm"
                          icon={<XCircle className="w-4 h-4" />}
                          onClick={() => setCancellingBooking(booking)}
                        >
                          Batalkan
                        </Button>
                      </div>
                    )}

                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Admin Cancel Dialog */}
      <Dialog
        isOpen={!!cancellingBooking}
        onClose={() => setCancellingBooking(null)}
        title="Pembatalan Oleh Admin"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin membatalkan pesanan untuk penumpang{' '}
            <strong className="text-slate-900">
              {(cancellingBooking as any)?.employee?.name}
            </strong>
            ? Tindakan ini diperlukan untuk kebutuhan operasional.
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setCancellingBooking(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleAdminCancel}
              isLoading={cancelBookingMutation.isPending}
            >
              Ya, Batalkan
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add User Modal */}
      <Dialog
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="Tambah Pengguna / Superadmin Baru"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              NIK (Nomor Induk Karyawan) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: 9999 / 8888"
              value={newNik}
              onChange={(e) => setNewNik(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Superadmin Utama"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Departemen
            </label>
            <input
              type="text"
              placeholder="Contoh: Executive / IT / Operations"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              placeholder="Contoh: 081234567890"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              Hak Akses / Role User <span className="text-red-500">*</span>
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded-xl focus:ring-2 focus:ring-primary-500 font-semibold"
            >
              <option value="superadmin">👑 Superadmin (Desktop Webview & Full Control)</option>
              <option value="admin">🛡️ Admin (Dashboard Operasional)</option>
              <option value="driver">🚌 Driver (Console Live Map GPS)</option>
              <option value="employee">👤 Karyawan / Penumpang</option>
            </select>
          </div>

          {newRole === 'driver' && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-blue-900 block">
                  🏢 Kategori / Tipe Driver <span className="text-red-500">*</span>
                </label>
                <select
                  value={newDriverType}
                  onChange={(e) => setNewDriverType(e.target.value as 'internal' | 'vendor')}
                  className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-bold text-blue-950"
                >
                  <option value="vendor">💳 Driver Sewa Vendor (Masuk Tagihan Invoice)</option>
                  <option value="internal">🏢 Driver Internal PT (Armada / Supir Sendiri - Rp 0)</option>
                </select>
                <p className="text-[11px] text-blue-700">
                  Otomatis menentukan status tagihan invoice saat ditugaskan ke rute.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-blue-950 block mb-1">
                    Nomor Polisi (Plat Mobil)
                  </label>
                  <LicensePlateInput
                    value={newDriverPlate}
                    onChange={setNewDriverPlate}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-blue-950 block mb-1">
                    Jenis Kendaraan
                  </label>
                  <select
                    value={newDriverVehicle}
                    onChange={(e) => setNewDriverVehicle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-blue-200 rounded-lg font-semibold text-slate-900 cursor-pointer"
                  >
                    {DRIVER_VEHICLE_MODELS.map((model) => (
                      <option key={model} value={model}>
                        🚗 {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setShowAddUserModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={savingUser}
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              Simpan User
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
