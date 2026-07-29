// ============================================================
// Booking Info Card
// ============================================================

import { MapPin, Clock, Bus, Users, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import type { VehicleType } from '../../lib/types';
import { formatDateIndonesian } from '../../lib/vehicleLogic';
import { getVehicleIcon } from '../../lib/utils';

interface BookingInfoCardProps {
  routeName: string;
  departureDate: string;
  vehicleType: VehicleType;
  confirmedCount: number;
  maxSeats: number;
  remainingSeats: number;
  isClosed: boolean;
}

export function BookingInfoCard({
  routeName,
  departureDate,
  vehicleType,
  confirmedCount,
  maxSeats,
  remainingSeats,
  isClosed,
}: BookingInfoCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />

      <div className="space-y-3 pt-1">
        {/* Route & Date */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-primary-500" />
            <h3 className="font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
              {routeName}
            </h3>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400 ml-6">
            {formatDateIndonesian(departureDate)}
          </p>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <InfoItem
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Keberangkatan"
            value="07:30 WIB"
          />
          <InfoItem
            icon={<Bus className="w-3.5 h-3.5" />}
            label="Kendaraan"
            value={`${getVehicleIcon(vehicleType)} ${vehicleType}`}
          />
          <InfoItem
            icon={<Users className="w-3.5 h-3.5" />}
            label="Terisi"
            value={`${confirmedCount} / ${maxSeats}`}
          />
          <InfoItem
            icon={<Users className="w-3.5 h-3.5" />}
            label="Sisa Kursi"
            value={String(remainingSeats)}
            highlight={remainingSeats <= 3}
          />
        </div>

        {/* Booking deadline */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {isClosed
              ? 'Booking telah ditutup untuk tanggal ini.'
              : 'Batas booking: 20:00 WIB hari ini'}
          </p>
        </div>
      </div>
    </Card>
  );
}

function InfoItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-surface-400 dark:text-surface-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] text-surface-500 dark:text-surface-400 uppercase tracking-wide">
          {label}
        </p>
        <p
          className={`text-sm font-semibold ${
            highlight
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-surface-800 dark:text-surface-200'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
