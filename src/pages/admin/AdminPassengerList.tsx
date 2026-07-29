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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useAdminBookings, useCancelBooking } from '../../hooks/useBooking';
import { useRoutes } from '../../hooks/useRoutes';
import {
  getTomorrowDate,
  formatDateIndonesian,
  formatTimeWIB,
} from '../../lib/vehicleLogic';
import type { Booking } from '../../lib/types';
import toast from 'react-hot-toast';

export default function AdminPassengerList() {
  const [searchParams] = useSearchParams();
  const routeParam = searchParams.get('route');
  const dateParam = searchParams.get('date');

  const [selectedDate, setSelectedDate] = useState(dateParam || getTomorrowDate());
  const [selectedRoute, setSelectedRoute] = useState(routeParam || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

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
      No_Kursi: b.seat_number,
      Kendaraan: b.vehicle_type,
      Tanggal: b.departure_date,
      Status: b.status,
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

  return (
    <div className="space-y-5">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
            Daftar Penumpang
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {formatDateIndonesian(selectedDate)}
          </p>
        </div>

        <Button
          onClick={handleExportExcel}
          variant="outline"
          size="sm"
          icon={<Download className="w-4 h-4 text-emerald-600" />}
        >
          Export Excel (.xlsx)
        </Button>
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
              className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-sm"
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
              className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-sm"
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
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Passenger Table / Card List */}
      {isLoading ? (
        <p className="text-center py-8 text-sm text-surface-500">Memuat penumpang...</p>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-surface-900 rounded-2xl border border-surface-100 dark:border-surface-800">
          <p className="text-sm font-semibold text-surface-600 dark:text-surface-400">
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
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-sm shrink-0">
                        {booking.seat_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-surface-900 dark:text-surface-100 text-base">
                            {emp?.name || 'Nama Karyawan'}
                          </h4>
                          <Badge variant={isConfirmed ? 'success' : 'danger'}>
                            {booking.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">
                          NIK: <span className="font-mono text-surface-700 dark:text-surface-300">{emp?.nik}</span> • {emp?.department}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary-500" />
                            {rte?.route_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bus className="w-3 h-3 text-sky-500" />
                            {booking.vehicle_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isConfirmed && (
                      <div className="flex items-center justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-100 dark:border-surface-800">
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<XCircle className="w-4 h-4" />}
                          onClick={() => setCancellingBooking(booking)}
                        >
                          Batalkan (Admin)
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
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Apakah Anda yakin ingin membatalkan pesanan untuk penumpang{' '}
            <strong className="text-surface-900 dark:text-surface-100">
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
    </div>
  );
}
