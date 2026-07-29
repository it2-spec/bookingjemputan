// ============================================================
// Status Badge Component
// ============================================================

import { Badge } from '../ui/Badge';
import type { BookingStatus } from '../../lib/types';
import { STATUS_LABELS } from '../../lib/constants';

interface StatusBadgeProps {
  status: BookingStatus;
}

const statusVariantMap: Record<BookingStatus, 'success' | 'danger' | 'default'> = {
  confirmed: 'success',
  cancelled: 'danger',
  closed: 'default',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} dot size="sm">
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
