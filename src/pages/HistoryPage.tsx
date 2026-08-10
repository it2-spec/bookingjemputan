// ============================================================
// History Page
// ============================================================

import { motion } from 'motion/react';
import {
  Clock,
  MapPin,
  Armchair,
  Bus,
  Calendar,
  History,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { BookingCardSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useBookingHistory } from '../hooks/useBooking';
import { formatDateIndonesian, formatTimeWIB } from '../lib/vehicleLogic';
import { getVehicleIcon } from '../lib/utils';
import type { Booking } from '../lib/types';

export default function HistoryPage() {
  const { employee } = useAuth();
  const { data: bookings, isLoading } = useBookingHistory(employee?.id || null);

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
          Riwayat Booking
        </h1>
        <p className="text-sm text-slate-600">
          Daftar booking Anda sebelumnya
        </p>
      </motion.div>

      {/* Bookings list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8" />}
          title="Belum Ada Riwayat"
          description="Booking shuttle Anda akan muncul di sini"
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking, index) => (
            <HistoryCard key={booking.id} booking={booking} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  booking,
  index,
}: {
  booking: Booking;
  index: number;
}) {
  const route = (booking as any).route;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card animate={false}>
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-500" />
              <span className="font-bold text-slate-900 text-sm font-[family-name:var(--font-display)]">
                {route?.route_name || 'Rute'}
              </span>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2">
            <DetailItem
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Tanggal"
              value={formatDateIndonesian(booking.departure_date)}
            />
            <DetailItem
              icon={<Armchair className="w-3.5 h-3.5" />}
              label="Kursi"
              value={`No. ${booking.seat_number}`}
            />
            <DetailItem
              icon={<Bus className="w-3.5 h-3.5" />}
              label="Kendaraan"
              value={`${getVehicleIcon(booking.vehicle_type)} ${booking.vehicle_type}`}
            />
            <DetailItem
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Waktu Booking"
              value={formatTimeWIB(booking.created_at)}
            />
          </div>

          {/* Cancellation info */}
          {booking.status === 'cancelled' && booking.cancelled_at && (
            <p className="text-xs text-red-500 dark:text-red-400">
              Dibatalkan pada {formatTimeWIB(booking.cancelled_at)}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="text-slate-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xs font-semibold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}
