// ============================================================
// Booking Confirmation Dialog
// ============================================================

import { motion } from 'motion/react';
import { MapPin, Calendar, Clock, Armchair, Bus, CheckCircle2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import type { VehicleType } from '../../lib/types';
import { formatDateIndonesian } from '../../lib/vehicleLogic';
import { VEHICLE_LABELS } from '../../lib/constants';

interface BookingConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  routeName: string;
  departureDate: string;
  seatNumber: number;
  vehicleType: VehicleType;
}

export function BookingConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  routeName,
  departureDate,
  seatNumber,
  vehicleType,
}: BookingConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Konfirmasi Booking">
      <div className="space-y-4">
        {/* Confirmation icon */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center"
          >
            <CheckCircle2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </motion.div>
        </div>

        <p className="text-center text-sm text-surface-600 dark:text-surface-400">
          Apakah Anda yakin ingin memesan shuttle berikut?
        </p>

        {/* Booking details */}
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4 space-y-3">
          <DetailRow
            icon={<MapPin className="w-4 h-4" />}
            label="Rute"
            value={routeName}
          />
          <DetailRow
            icon={<Calendar className="w-4 h-4" />}
            label="Tanggal"
            value={formatDateIndonesian(departureDate)}
          />
          <DetailRow
            icon={<Clock className="w-4 h-4" />}
            label="Keberangkatan"
            value="07:30 WIB"
          />
          <DetailRow
            icon={<Armchair className="w-4 h-4" />}
            label="Kursi"
            value={`No. ${seatNumber}`}
          />
          <DetailRow
            icon={<Bus className="w-4 h-4" />}
            label="Kendaraan"
            value={VEHICLE_LABELS[vehicleType]}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onConfirm}
            isLoading={isLoading}
          >
            Konfirmasi
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary-500 dark:text-primary-400 shrink-0">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
          {value}
        </p>
      </div>
    </div>
  );
}
