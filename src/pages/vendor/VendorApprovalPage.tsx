// ============================================================
// Vendor Approval Page
// Vendor menyetujui/menolak order armada, menentukan driver,
// dan melihat visual denah kursi penumpang
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bus,
  Users,
  CalendarDays,
  AlertCircle,
  Check,
  Ban,
  MessageSquare,
  X,
  UserCheck,
  Edit3,
} from 'lucide-react';
import type { Booking, VehicleType } from '../../lib/types';
import { getVehicleType, normalizeUnitBookings } from '../../lib/vehicleLogic';

import { getVehicleIcon } from '../../lib/utils';
import { Dialog } from '../../components/ui/Dialog';

import { SeatMap } from '../../components/booking/SeatMap';
import { TomSelect, type TomSelectOption } from '../../components/ui/TomSelect';

// ---- Types ----

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface DriverOption {
  id: string;
  name: string;
  phone: string | null;
  department?: string;
  driver_type?: 'internal' | 'vendor' | null;
}

interface DailyRouteOrder {
  departure_date: string;
  route_id: string;
  route_name: string;
  route_obj?: any;
  passenger_count: number;
  vehicle_type: VehicleType | string;
  unit_count: number;
  is_billable: boolean;
  vendor_approval_status: ApprovalStatus;
  vendor_approved_at?: string | null;
  vendor_approval_note?: string | null;
  assigned_driver_id?: string | null;
  assigned_driver_id_unit2?: string | null;
  assigned_driver_id_unit3?: string | null;
  driver_assignments?: Record<string, string> | null;
  override_id?: string | null;
}

interface GroupedByDate {
  date: string;
  orders: DailyRouteOrder[];
  allApproved: boolean;
  hasPending: boolean;
}

// ---- Helpers ----

function formatDateLocal(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Menunggu Persetujuan',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Disetujui',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Ditolak',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

// ---- Component ----

export default function VendorApprovalPage() {
  const { employee } = useAuth();
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [orders, setOrders] = useState<DailyRouteOrder[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Seat map modal
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<DailyRouteOrder | null>(null);
  const [vendorSelectedUnit, setVendorSelectedUnit] = useState<number>(1);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ date: string; routeId: string; routeName: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Modal State for Registering New Driver directly from TomSelect
  const [newDriverModal, setNewDriverModal] = useState<{
    isOpen: boolean;
    initialName: string;
    routeId?: string;
    unitNumber?: number;
    isBulk?: boolean;
  } | null>(null);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [isSavingNewDriver, setIsSavingNewDriver] = useState(false);

  const handleOpenAddDriver = (
    typedName: string,
    routeId?: string,
    unitNumber: number = 1,
    isBulk: boolean = false
  ) => {
    setNewDriverName(typedName);
    setNewDriverPhone('');
    setNewDriverModal({
      isOpen: true,
      initialName: typedName,
      routeId,
      unitNumber,
      isBulk,
    });
  };

  const handleSaveNewDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) {
      toast.error('Nama supir wajib diisi');
      return;
    }
    if (!newDriverPhone.trim()) {
      toast.error('Nomor WhatsApp / HP wajib diisi');
      return;
    }

    setIsSavingNewDriver(true);
    try {
      const generatedNik = `VDRV-${Date.now().toString().slice(-6)}`;
      const { data: newDriver, error } = await supabase
        .from('employees')
        .insert({
          nik: generatedNik,
          name: newDriverName.trim(),
          phone: newDriverPhone.trim(),
          department: 'Vendor Driver',
          role: 'driver',
          driver_type: 'vendor',
        })
        .select('id, name, phone, department, driver_type')
        .single();

      if (error) throw error;

      toast.success(`Supir ${newDriverName.trim()} berhasil didaftarkan! 🎉`);

      // Refresh driver list
      await fetchDrivers();

      // Automatically assign new driver to the active context
      if (newDriverModal) {
        const { routeId, unitNumber = 1, isBulk } = newDriverModal;
        if (isBulk && routeId) {
          setBulkApproveModal((prev) => {
            if (!prev) return null;
            const next = { ...prev.routeDrivers };
            next[routeId] = {
              ...(next[routeId] || {}),
              [unitNumber]: newDriver.id,
            };
            return { ...prev, routeDrivers: next };
          });
        } else {
          setSingleApproveModal((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              unitDrivers: {
                ...prev.unitDrivers,
                [unitNumber]: newDriver.id,
              },
            };
          });
        }
      }

      setNewDriverModal(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendaftarkan supir baru');
    } finally {
      setIsSavingNewDriver(false);
    }
  };

  // Single Approve Modal (Tentukan Supir per Rute)
  const [singleApproveModal, setSingleApproveModal] = useState<{
    order: DailyRouteOrder;
    unitDrivers: Record<number, string>;
    isEditingDriverOnly?: boolean;
  } | null>(null);

  // Bulk Approve Modal (Tentukan Supir Semua Rute di Tanggal tersebut)
  const [bulkApproveModal, setBulkApproveModal] = useState<{
    date: string;
    orders: DailyRouteOrder[];
    routeDrivers: Record<string, Record<number, string>>;
  } | null>(null);

  // Fetch Drivers
  const fetchDrivers = async () => {
    const { data: dList } = await supabase
      .from('employees')
      .select('id, name, phone, department, driver_type')
      .eq('role', 'driver')
      .order('name', { ascending: true });

    if (dList) setAvailableDrivers(dList as DriverOption[]);
  };

  const fetchOrders = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      // 1. Fetch bookings
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          employee_id,
          route_id,
          departure_date,
          seat_number,
          unit_number,
          vehicle_type,
          pickup_point,
          status,
          vehicle_lock,
          created_at,
          cancelled_at,
          employee:employees(id, name, department, phone),
          route:routes(id, route_name, departure_time, manual_vehicle_type, unit_count)
        `)
        .gte('departure_date', dateFrom)
        .lte('departure_date', dateTo)
        .eq('status', 'confirmed')
        .order('departure_date', { ascending: false });

      if (error) throw error;
      setAllBookings((bookings as any[]) || []);

      // 1b. Fetch all active routes directly to ensure fresh unit_count & manual_vehicle_type
      const { data: routesList } = await supabase
        .from('routes')
        .select('id, route_name, departure_time, manual_vehicle_type, unit_count');
      const routesMap = new Map<string, any>();
      (routesList || []).forEach((r) => routesMap.set(r.id, r));

      // 2. Fetch overrides (status approval, assigned drivers, etc.)
      const { data: overrides } = await supabase
        .from('invoice_daily_overrides')
        .select(`
          departure_date,
          route_id,
          is_billable,
          vendor_approval_status,
          vendor_approved_at,
          vendor_approval_note,
          assigned_driver_id,
          assigned_driver_id_unit2,
          assigned_driver_id_unit3,
          driver_assignments,
          override_vehicle_type,
          id
        `)
        .gte('departure_date', dateFrom)
        .lte('departure_date', dateTo);

      const overrideMap = new Map<string, any>();
      (overrides || []).forEach((o) => {
        overrideMap.set(`${o.departure_date}_${o.route_id}`, o);
      });

      // 3. Group bookings by date + route
      const byDateRoute = new Map<string, { routeName: string; routeObj: any; count: number; vehicleTypes: string[] }>();
      (bookings as any[] || []).forEach((b) => {
        const key = `${b.departure_date}_${b.route_id}`;
        if (!byDateRoute.has(key)) {
          const freshRoute = routesMap.get(b.route_id) || b.route;
          byDateRoute.set(key, {
            routeName: freshRoute?.route_name ?? b.route?.route_name ?? 'Unknown',
            routeObj: freshRoute,
            count: 0,
            vehicleTypes: [],
          });
        }
        const entry = byDateRoute.get(key)!;
        entry.count++;
        entry.vehicleTypes.push(b.vehicle_type);
      });

      // 4. Build DailyRouteOrder[]
      const result: DailyRouteOrder[] = [];
      byDateRoute.forEach((info, key) => {
        const dateMatch = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
        if (!dateMatch) return;
        const date = dateMatch[1];
        const routeId = dateMatch[2];

        const override = overrideMap.get(`${date}_${routeId}`);
        const freshRoute = routesMap.get(routeId) || info.routeObj;
        const isKB = info.routeName.toLowerCase().includes('karawang barat');
        const hasUnit2Bookings = (bookings as any[] || []).some(
          (b) => b.departure_date === date && b.route_id === routeId && (b.unit_number || 1) === 2
        );
        const unitCount = freshRoute?.unit_count || (isKB && hasUnit2Bookings ? 2 : 1);
        const vehicleType = getVehicleType(info.count, freshRoute?.manual_vehicle_type);

        result.push({
          departure_date: date,
          route_id: routeId,
          route_name: info.routeName,
          route_obj: freshRoute,
          passenger_count: info.count,
          vehicle_type: override?.override_vehicle_type || vehicleType,
          unit_count: unitCount,
          is_billable: override?.is_billable ?? true,
          vendor_approval_status: override?.vendor_approval_status ?? 'pending',
          vendor_approved_at: override?.vendor_approved_at ?? null,
          vendor_approval_note: override?.vendor_approval_note ?? null,
          assigned_driver_id: override?.assigned_driver_id || null,
          assigned_driver_id_unit2: override?.assigned_driver_id_unit2 || null,
          assigned_driver_id_unit3: override?.assigned_driver_id_unit3 || null,
          driver_assignments: override?.driver_assignments || null,
          override_id: override?.id ?? null,
        });
      });


      // Sort: pending first, then by date desc
      result.sort((a, b) => {
        if (a.vendor_approval_status === 'pending' && b.vendor_approval_status !== 'pending') return -1;
        if (b.vendor_approval_status === 'pending' && a.vendor_approval_status !== 'pending') return 1;
        return b.departure_date.localeCompare(a.departure_date);
      });

      setOrders(result);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data order');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Group by date
  const grouped: GroupedByDate[] = (() => {
    const map = new Map<string, DailyRouteOrder[]>();
    orders.forEach((o) => {
      if (!map.has(o.departure_date)) map.set(o.departure_date, []);
      map.get(o.departure_date)!.push(o);
    });
    return Array.from(map.entries()).map(([date, dayOrders]) => ({
      date,
      orders: dayOrders,
      allApproved: dayOrders.every((o) => o.vendor_approval_status === 'approved'),
      hasPending: dayOrders.some((o) => o.vendor_approval_status === 'pending'),
    }));
  })();

  // Helper: Get driver options with assigned/busy status for a given date, route, and unit
  const getDriverOptionsForUnit = useCallback(
    (
      date: string,
      currentRouteId: string,
      currentUnitNum: number,
      activeModalAssignments?: Record<string, Record<number, string>>
    ): TomSelectOption[] => {
      const busyDriverMap = new Map<string, string>(); // driverId -> reason/route

      // 1. Check existing APPROVED orders on that date
      orders
        .filter((o) => o.departure_date === date && o.vendor_approval_status === 'approved')
        .forEach((o) => {
          const uCount = o.unit_count || 1;
          for (let u = 1; u <= uCount; u++) {
            // Skip the exact slot currently being edited
            if (o.route_id === currentRouteId && u === currentUnitNum) continue;

            const modalVal = activeModalAssignments?.[o.route_id]?.[u];
            const drvId =
              modalVal !== undefined
                ? modalVal
                : u === 1
                  ? o.assigned_driver_id
                  : u === 2
                    ? o.assigned_driver_id_unit2
                    : o.assigned_driver_id_unit3;

            if (drvId) {
              const isKB = o.route_name.toLowerCase().includes('karawang barat');
              const unitTag = uCount > 1 ? ` (${isKB ? (u === 1 ? 'Tanjung Pura' : 'Galuh Mas') : `Unit ${u}`})` : '';
              busyDriverMap.set(drvId, `${o.route_name}${unitTag}`);
            }
          }
        });

      // 2. Check active modal selections (e.g. while selecting in bulk modal or multi-unit modal)
      if (activeModalAssignments) {
        Object.entries(activeModalAssignments).forEach(([rId, uMap]) => {
          Object.entries(uMap).forEach(([uStr, drvId]) => {
            const u = parseInt(uStr, 10);
            if (rId === currentRouteId && u === currentUnitNum) return;
            if (drvId && !busyDriverMap.has(drvId)) {
              const matchedOrder = orders.find((o) => o.route_id === rId && o.departure_date === date);
              const rName = matchedOrder?.route_name || 'Rute Lain';
              const isKB = rName.toLowerCase().includes('karawang barat');
              const unitTag = (matchedOrder?.unit_count || 1) > 1 ? ` (${isKB ? (u === 1 ? 'Tanjung Pura' : 'Galuh Mas') : `Unit ${u}`})` : '';
              busyDriverMap.set(drvId, `${rName}${unitTag}`);
            }
          });
        });
      }

      return availableDrivers.map((d) => {
        const isBusy = busyDriverMap.has(d.id);
        const busyLocation = busyDriverMap.get(d.id);
        const isInternal = d.driver_type === 'internal' || (!d.driver_type && (d.name.toLowerCase().includes('internal') || (d.department || '').toLowerCase().includes('internal')));
        const typeTag = isInternal ? '🏢 [Internal PT]' : '💳 [Vendor]';

        if (isBusy) {
          return {
            value: d.id,
            label: `👨‍✈️ ${d.name} ${typeTag} 🚫 (Sudah di ${busyLocation})`,
            sublabel: `🚫 Sudah bertugas di: ${busyLocation}`,
            disabled: true,
          };
        }

        return {
          value: d.id,
          label: `👨‍✈️ ${d.name} ${typeTag}`,
          sublabel: d.phone ? `No. Telp / WA: ${d.phone}` : undefined,
          disabled: false,
        };
      });
    },
    [orders, availableDrivers]
  );

  // Open Single Approve Modal
  const handleOpenSingleApproveModal = (order: DailyRouteOrder, isEditingDriverOnly: boolean = false) => {
    setSingleApproveModal({
      order,
      unitDrivers: {
        1: order.assigned_driver_id || '',
        2: order.assigned_driver_id_unit2 || '',
        3: order.assigned_driver_id_unit3 || '',
      },
      isEditingDriverOnly,
    });
  };

  // Submit Single Approve Modal
  const handleConfirmSingleApprove = async () => {
    if (!singleApproveModal) return;
    const { order, unitDrivers, isEditingDriverOnly } = singleApproveModal;

    // 1. Validasi: Wajib pilih supir untuk semua unit
    const uCount = order.unit_count || 1;
    for (let u = 1; u <= uCount; u++) {
      if (!unitDrivers[u]) {
        toast.error(`Harap pilih supir untuk Unit ${u} terlebih dahulu!`, { icon: '⚠️' });
        return;
      }
    }

    // 2. Validasi: Supir tidak boleh sama antar unit dalam rute ini
    const selectedDrvIds = Object.values(unitDrivers).filter(Boolean);
    if (new Set(selectedDrvIds).size !== selectedDrvIds.length) {
      toast.error('Supir tidak boleh sama untuk unit mobil yang berbeda!', { icon: '⚠️' });
      return;
    }

    // 3. Validasi: Supir tidak boleh sudah bertugas di rute lain yang SUDAH DISETUJUI pada tanggal yang sama
    const conflictOrders = orders.filter(
      (o) => o.departure_date === order.departure_date && o.route_id !== order.route_id && o.vendor_approval_status === 'approved'
    );

    for (const drvId of selectedDrvIds) {
      for (const co of conflictOrders) {
        if (
          co.assigned_driver_id === drvId ||
          co.assigned_driver_id_unit2 === drvId ||
          co.assigned_driver_id_unit3 === drvId
        ) {
          const drvObj = availableDrivers.find((d) => d.id === drvId);
          toast.error(
            `Supir "${drvObj?.name || 'Driver'}" sudah bertugas di rute "${co.route_name}" pada tanggal ini!`,
            { icon: '⚠️', duration: 4000 }
          );
          return;
        }
      }
    }

    const currentUnit1 = unitDrivers[1] || null;
    const currentUnit2 = unitDrivers[2] || null;
    const currentUnit3 = unitDrivers[3] || null;

    const driverAssignments = {
      '1': currentUnit1,
      '2': currentUnit2,
      '3': currentUnit3,
    };

    const key = `${order.departure_date}_${order.route_id}`;
    setActionLoading(key);
    try {
      const payload: any = {
        departure_date: order.departure_date,
        route_id: order.route_id,
        is_billable: true,
        vendor_approval_status: 'approved',
        vendor_approved_at: order.vendor_approved_at || new Date().toISOString(),
        vendor_approved_by: employee?.id ?? null,
        vendor_approval_note: null,
        assigned_driver_id: currentUnit1,
        assigned_driver_id_unit2: currentUnit2,
        assigned_driver_id_unit3: currentUnit3,
        driver_assignments: driverAssignments,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) throw error;

      toast.success(
        isEditingDriverOnly
          ? `Supir rute "${order.route_name}" berhasil diperbarui! 👨‍✈️`
          : `Order "${order.route_name}" berhasil disetujui beserta penugasan supir! ✅`
      );
      setSingleApproveModal(null);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan persetujuan');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Bulk Approve Modal
  const handleOpenBulkApproveModal = (date: string, pendingOrders: DailyRouteOrder[]) => {
    const pending = pendingOrders.filter((o) => o.vendor_approval_status === 'pending');
    if (pending.length === 0) return;

    const initialMap: Record<string, Record<number, string>> = {};
    pending.forEach((o) => {
      initialMap[o.route_id] = {
        1: o.assigned_driver_id || '',
        2: o.assigned_driver_id_unit2 || '',
        3: o.assigned_driver_id_unit3 || '',
      };
    });

    setBulkApproveModal({
      date,
      orders: pending,
      routeDrivers: initialMap,
    });
  };

  // Submit Bulk Approve Modal
  const handleConfirmBulkApprove = async () => {
    if (!bulkApproveModal) return;
    const { date, orders: bulkOrders, routeDrivers } = bulkApproveModal;

    // 1. Validasi: Cek apakah semua supir di semua unit rute sudah terisi
    for (const order of bulkOrders) {
      const uCount = order.unit_count || 1;
      for (let u = 1; u <= uCount; u++) {
        if (!routeDrivers[order.route_id]?.[u]) {
          const isKB = order.route_name.toLowerCase().includes('karawang barat');
          const unitName = isKB ? (u === 1 ? 'Unit 1 Tanjung Pura' : 'Unit 2 Galuh Mas') : `Unit ${u}`;
          toast.error(`Harap pilih supir untuk "${order.route_name}" (${unitName})!`, { icon: '⚠️' });
          return;
        }
      }
    }

    // 2. Validasi: Supir hanya boleh 1 kali dipakai dalam tanggal yang sama (tidak boleh ganda)
    const driverUsageMap = new Map<string, string>(); // driverId -> routeName & unit
    for (const order of bulkOrders) {
      const uCount = order.unit_count || 1;
      for (let u = 1; u <= uCount; u++) {
        const drvId = routeDrivers[order.route_id]?.[u];
        if (drvId) {
          const isKB = order.route_name.toLowerCase().includes('karawang barat');
          const unitName = uCount > 1 ? ` (${isKB ? (u === 1 ? 'Unit 1 Tanjung Pura' : 'Unit 2 Galuh Mas') : `Unit ${u}`})` : '';
          const currentLoc = `${order.route_name}${unitName}`;

          if (driverUsageMap.has(drvId)) {
            const prevLoc = driverUsageMap.get(drvId);
            const drvObj = availableDrivers.find((d) => d.id === drvId);
            toast.error(
              `Supir "${drvObj?.name || 'Driver'}" tidak boleh digunakan di lebih dari 1 rute! Sudah dipilih di ${prevLoc} dan ${currentLoc}.`,
              { icon: '⚠️', duration: 5000 }
            );
            return;
          }
          driverUsageMap.set(drvId, currentLoc);
        }
      }
    }

    // 3. Validasi: Cek terhadap rute lain yang sudah disetujui sebelumnya di tanggal yang sama
    const otherOrders = orders.filter(
      (o) => o.departure_date === date && !bulkOrders.some((bo) => bo.route_id === o.route_id)
    );
    for (const drvId of driverUsageMap.keys()) {
      for (const oo of otherOrders) {

        if (
          oo.assigned_driver_id === drvId ||
          oo.assigned_driver_id_unit2 === drvId ||
          oo.assigned_driver_id_unit3 === drvId
        ) {
          const drvObj = availableDrivers.find((d) => d.id === drvId);
          toast.error(
            `Supir "${drvObj?.name || 'Driver'}" sudah bertugas di "${oo.route_name}" pada tanggal ini!`,
            { icon: '⚠️', duration: 5000 }
          );
          return;
        }
      }
    }

    setActionLoading(`all_${date}`);
    try {
      const upserts = bulkOrders.map((o) => {
        const uDrivers = routeDrivers[o.route_id] || {};
        const currentUnit1 = uDrivers[1] || null;
        const currentUnit2 = uDrivers[2] || null;
        const currentUnit3 = uDrivers[3] || null;

        return {
          departure_date: date,
          route_id: o.route_id,
          is_billable: true,
          vendor_approval_status: 'approved',
          vendor_approved_at: new Date().toISOString(),
          vendor_approved_by: employee?.id ?? null,
          vendor_approval_note: null,
          assigned_driver_id: currentUnit1,
          assigned_driver_id_unit2: currentUnit2,
          assigned_driver_id_unit3: currentUnit3,
          driver_assignments: {
            '1': currentUnit1,
            '2': currentUnit2,
            '3': currentUnit3,
          },
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(upserts, { onConflict: 'departure_date,route_id' });

      if (error) throw error;

      toast.success(`Semua order (${bulkOrders.length} rute) ${formatDateLocal(date)} berhasil disetujui! ✅`);
      setBulkApproveModal(null);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyetujui semua order');
    } finally {
      setActionLoading(null);
    }
  };


  const handleOpenRejectModal = (date: string, routeId: string, routeName: string) => {
    setRejectModal({ date, routeId, routeName });
    setRejectNote('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    const { date, routeId } = rejectModal;
    const key = `${date}_${routeId}`;
    setActionLoading(key);
    try {
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: date,
          route_id: routeId,
          is_billable: false,
          vendor_approval_status: 'rejected',
          vendor_approved_at: new Date().toISOString(),
          vendor_approved_by: employee?.id ?? null,
          vendor_approval_note: rejectNote.trim() || 'Ditolak oleh vendor',
          assigned_driver_id: null,
          assigned_driver_id_unit2: null,
          assigned_driver_id_unit3: null,
          driver_assignments: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });


      if (error) throw error;
      toast.success('Order ditolak ❌');
      setRejectModal(null);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak order');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCollapse = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Stats
  const totalPending = orders.filter((o) => o.vendor_approval_status === 'pending').length;
  const totalApproved = orders.filter((o) => o.vendor_approval_status === 'approved').length;
  const totalRejected = orders.filter((o) => o.vendor_approval_status === 'rejected').length;

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-800">Rentang Tanggal</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Memuat...' : 'Muat Data Order'}
        </button>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs font-semibold text-amber-600 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Menunggu
            </p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{totalPending}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <p className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{totalApproved}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
            <p className="text-xs font-semibold text-red-600 flex items-center justify-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Ditolak
            </p>
            <p className="text-2xl font-extrabold text-red-700 mt-1">{totalRejected}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <Bus className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Tidak ada order pada rentang tanggal ini</p>
          <p className="text-xs text-slate-400 mt-1">Coba pilih rentang tanggal yang berbeda</p>
        </div>
      )}

      {/* Grouped Orders */}
      {grouped.map((group) => {
        const isCollapsed = collapsedDates.has(group.date);
        const pendingInGroup = group.orders.filter((o) => o.vendor_approval_status === 'pending');
        const isApprovingAll = actionLoading === `all_${group.date}`;

        return (
          <div
            key={group.date}
            className={`bg-white border rounded-2xl shadow-xs overflow-hidden transition-all ${group.hasPending ? 'border-amber-200' : group.allApproved ? 'border-emerald-200' : 'border-slate-200'
              }`}
          >
            {/* Date Header */}
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer ${group.hasPending ? 'bg-amber-50' : group.allApproved ? 'bg-emerald-50' : 'bg-slate-50'
                }`}
              onClick={() => toggleCollapse(group.date)}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className={`w-4 h-4 ${group.hasPending ? 'text-amber-600' : group.allApproved ? 'text-emerald-600' : 'text-slate-500'}`} />
                <div>
                  <p className="text-sm font-bold text-slate-900">{formatDateLocal(group.date)}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{group.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {group.hasPending && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBulkApproveModal(group.date, group.orders);
                    }}
                    disabled={isApprovingAll}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isApprovingAll ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Setujui Semua ({pendingInGroup.length})
                  </button>
                )}
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Orders in this date */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {group.orders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.vendor_approval_status];
                  const actionKey = `${order.departure_date}_${order.route_id}`;
                  const isActioning = actionLoading === actionKey;

                  // Find assigned driver names
                  const assignedDriver1 = availableDrivers.find((d) => d.id === order.assigned_driver_id);
                  const assignedDriver2 = availableDrivers.find((d) => d.id === order.assigned_driver_id_unit2);
                  const assignedDriver3 = availableDrivers.find((d) => d.id === order.assigned_driver_id_unit3);

                  return (
                    <div
                      key={`${order.departure_date}_${order.route_id}`}
                      className={`p-4 space-y-3 transition-colors ${order.vendor_approval_status === 'pending' ? 'bg-amber-50/40' :
                        order.vendor_approval_status === 'rejected' ? 'bg-red-50/30' : ''
                        }`}
                    >
                      {/* Top Row: Route info & Status badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-xl mt-0.5 shadow-2xs">
                            {getVehicleIcon(order.vehicle_type)}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{order.route_name}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <span className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                <strong>{order.passenger_count}</strong> penumpang
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
                                {order.vehicle_type}
                              </span>
                              {/* Icon Denah Kursi di sebelah tipe armada */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForMap(order);
                                  setVendorSelectedUnit(1);
                                }}
                                title="Lihat Visual Denah Kursi"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                              >
                                <span>💺</span>
                                <span className="text-[10px] font-bold text-amber-700">Kursi</span>
                              </button>
                              {order.unit_count > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                                  {order.unit_count} Unit Mobil
                                </span>
                              )}
                            </div>
                            {order.vendor_approval_note && (
                              <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1 bg-white/70 px-2 py-1 rounded-lg border border-slate-200">
                                <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                                {order.vendor_approval_note}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right Area: Action buttons if pending, Badge & Undo if approved/rejected */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {order.vendor_approval_status === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenSingleApproveModal(order, false)}
                                disabled={isActioning}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs whitespace-nowrap"
                              >
                                {isActioning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}

                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(order.departure_date, order.route_id, order.route_name)}
                                disabled={isActioning}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <Ban className="w-3.5 h-3.5" />

                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${statusCfg.color}`}>
                                {statusCfg.icon}
                                {statusCfg.label}
                              </span>
                              <button
                                onClick={async () => {
                                  setActionLoading(actionKey);
                                  try {
                                    await supabase.from('invoice_daily_overrides').upsert({
                                      departure_date: order.departure_date,
                                      route_id: order.route_id,
                                      vendor_approval_status: 'pending',
                                      vendor_approved_at: null,
                                      vendor_approved_by: null,
                                      vendor_approval_note: null,
                                      assigned_driver_id: null,
                                      assigned_driver_id_unit2: null,
                                      assigned_driver_id_unit3: null,
                                      driver_assignments: null,
                                      updated_at: new Date().toISOString(),
                                    }, { onConflict: 'departure_date,route_id' });
                                    toast('Status dikembalikan ke Menunggu & supir di-reset', { icon: '↩️' });
                                    await fetchOrders();
                                  } catch (err: any) {

                                    toast.error(err.message);
                                  } finally {
                                    setActionLoading(null);
                                  }
                                }}
                                disabled={isActioning}
                                className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 cursor-pointer transition-colors"
                              >
                                Batalkan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* If Approved: Show Assigned Driver Box */}
                      {order.vendor_approval_status === 'approved' && (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Supir yang Ditugaskan:
                            </span>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-800 font-semibold">
                              {order.unit_count > 1 ? (
                                <>
                                  {assignedDriver1 && (
                                    <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                      Unit 1: <strong>{assignedDriver1.name}</strong>
                                    </span>
                                  )}
                                  {assignedDriver2 && (
                                    <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                      Unit 2: <strong>{assignedDriver2.name}</strong>
                                    </span>
                                  )}
                                  {assignedDriver3 && (
                                    <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                      Unit 3: <strong>{assignedDriver3.name}</strong>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                                  👨‍✈️ <strong>{assignedDriver1?.name || 'Belum dipilih'}</strong>
                                  {assignedDriver1?.phone ? ` (${assignedDriver1.phone})` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSingleApproveModal(order, true)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
                          >
                            <Edit3 className="w-3 h-3" />
                            Ganti Supir
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* POPUP 1: Single Route Driver Selection & Approval Modal */}
      {singleApproveModal && (
        <Dialog
          isOpen={!!singleApproveModal}
          onClose={() => setSingleApproveModal(null)}
          title={singleApproveModal.isEditingDriverOnly ? 'Ganti Supir Armada' : 'Persetujuan & Penugasan Supir'}
        >
          <div className="space-y-4 py-2">
            {/* Info Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{singleApproveModal.order.route_name}</span>
                <span className="text-xs font-bold text-blue-700 px-2 py-0.5 bg-blue-100 rounded-full">
                  {singleApproveModal.order.vehicle_type}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                📅 {formatDateLocal(singleApproveModal.order.departure_date)} • 👥 {singleApproveModal.order.passenger_count} Penumpang
              </p>
            </div>

            {/* Driver Inputs */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Pilih Supir untuk Rute Ini (Wajib):
              </label>

              {singleApproveModal.order.unit_count > 1 ? (
                <div className="space-y-2.5">
                  {[...Array(singleApproveModal.order.unit_count)].map((_, uIdx) => {
                    const uNum = uIdx + 1;
                    const isKB = singleApproveModal.order.route_name.toLowerCase().includes('karawang barat');
                    const unitLabel = isKB
                      ? uNum === 1
                        ? 'Unit 1 (Tanjung Pura)'
                        : uNum === 2
                          ? 'Unit 2 (Galuh Mas)'
                          : `Unit ${uNum}`
                      : `Mobil Unit ${uNum}`;

                    return (
                      <div key={uNum} className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-700 font-bold block">{unitLabel}:</span>
                        <TomSelect
                          value={singleApproveModal.unitDrivers[uNum] || ''}
                          onChange={(val) =>
                            setSingleApproveModal((prev) =>
                              prev
                                ? {
                                  ...prev,
                                  unitDrivers: { ...prev.unitDrivers, [uNum]: val },
                                }
                                : null
                            )
                          }
                          options={getDriverOptionsForUnit(
                            singleApproveModal.order.departure_date,
                            singleApproveModal.order.route_id,
                            uNum,
                            { [singleApproveModal.order.route_id]: singleApproveModal.unitDrivers }
                          )}
                          placeholder="-- Pilih Supir Rute Ini --"
                          onCreate={(typed) =>
                            handleOpenAddDriver(typed, singleApproveModal.order.route_id, uNum, false)
                          }
                          createLabel="Daftarkan Supir Baru"
                        />
                      </div>

                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <TomSelect
                    value={singleApproveModal.unitDrivers[1] || ''}
                    onChange={(val) =>
                      setSingleApproveModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            unitDrivers: { ...prev.unitDrivers, [1]: val },
                          }
                          : null
                      )
                    }
                    options={getDriverOptionsForUnit(
                      singleApproveModal.order.departure_date,
                      singleApproveModal.order.route_id,
                      1,
                      { [singleApproveModal.order.route_id]: singleApproveModal.unitDrivers }
                    )}
                    placeholder="-- Pilih Supir Rute Ini --"
                    onCreate={(typed) =>
                      handleOpenAddDriver(typed, singleApproveModal.order.route_id, 1, false)
                    }
                    createLabel="Daftarkan Supir Baru"
                  />
                </div>


              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setSingleApproveModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleApprove}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {actionLoading !== null ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {singleApproveModal.isEditingDriverOnly ? 'Simpan Supir' : 'Konfirmasi & Setujui'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* POPUP 2: Bulk Approve All Routes Modal */}
      {bulkApproveModal && (
        <Dialog
          isOpen={!!bulkApproveModal}
          onClose={() => setBulkApproveModal(null)}
          title={`Setujui Semua Order (${formatDateLocal(bulkApproveModal.date)})`}
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600">
              Silakan tentukan supir untuk masing-masing rute di bawah ini sebelum menyetujui sekaligus:
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {bulkApproveModal.orders.map((order, oIdx) => {
                const uCount = order.unit_count || 1;
                return (
                  <div key={order.route_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {oIdx + 1}. {order.route_name}
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 px-2 py-0.5 bg-blue-100 rounded-full">
                        {order.vehicle_type} • {order.passenger_count} org
                      </span>
                    </div>

                    {uCount > 1 ? (
                      <div className="space-y-2 pt-1">
                        {[...Array(uCount)].map((_, uIdx) => {
                          const uNum = uIdx + 1;
                          const isKB = order.route_name.toLowerCase().includes('karawang barat');
                          const unitLabel = isKB
                            ? uNum === 1
                              ? 'Unit 1 (Tanjung Pura)'
                              : uNum === 2
                                ? 'Unit 2 (Galuh Mas)'
                                : `Unit ${uNum}`
                            : `Mobil Unit ${uNum}`;

                          return (
                            <div key={uNum} className="space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[11px] text-slate-700 font-bold block">{unitLabel}:</span>
                              <TomSelect
                                value={bulkApproveModal.routeDrivers[order.route_id]?.[uNum] || ''}
                                onChange={(val) =>
                                  setBulkApproveModal((prev) => {
                                    if (!prev) return null;
                                    const nextDrivers = { ...prev.routeDrivers };
                                    nextDrivers[order.route_id] = {
                                      ...(nextDrivers[order.route_id] || {}),
                                      [uNum]: val,
                                    };
                                    return { ...prev, routeDrivers: nextDrivers };
                                  })
                                }
                                options={getDriverOptionsForUnit(
                                  bulkApproveModal.date,
                                  order.route_id,
                                  uNum,
                                  bulkApproveModal.routeDrivers
                                )}
                                placeholder="-- Pilih Supir --"
                                onCreate={(typed) =>
                                  handleOpenAddDriver(typed, order.route_id, uNum, true)
                                }
                                createLabel="Daftarkan Supir Baru"
                              />
                            </div>

                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <TomSelect
                          value={bulkApproveModal.routeDrivers[order.route_id]?.[1] || ''}
                          onChange={(val) =>
                            setBulkApproveModal((prev) => {
                              if (!prev) return null;
                              const nextDrivers = { ...prev.routeDrivers };
                              nextDrivers[order.route_id] = {
                                ...(nextDrivers[order.route_id] || {}),
                                1: val,
                              };
                              return { ...prev, routeDrivers: nextDrivers };
                            })
                          }
                          options={getDriverOptionsForUnit(
                            bulkApproveModal.date,
                            order.route_id,
                            1,
                            bulkApproveModal.routeDrivers
                          )}
                          placeholder="-- Pilih Supir --"
                          onCreate={(typed) =>
                            handleOpenAddDriver(typed, order.route_id, 1, true)
                          }
                          createLabel="Daftarkan Supir Baru"
                        />
                      </div>


                    )}
                  </div>
                );
              })}
            </div>


            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setBulkApproveModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkApprove}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {actionLoading !== null ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Konfirmasi & Setujui Semua
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Visual Seat Map Dialog for Vendor */}
      <Dialog
        isOpen={!!selectedOrderForMap}
        onClose={() => setSelectedOrderForMap(null)}
        title={`Visual Denah Kursi - ${selectedOrderForMap?.route_name || ''}`}
      >
        <div className="space-y-4 py-2">
          {selectedOrderForMap && (
            <>
              {(() => {
                const isKB = selectedOrderForMap.route_name.toLowerCase().includes('karawang barat');
                const hasUnit2 = allBookings.some(
                  (b) => b.route_id === selectedOrderForMap.route_id &&
                    b.departure_date === selectedOrderForMap.departure_date &&
                    (b.unit_number || 1) === 2 &&
                    b.status === 'confirmed'
                );
                const isMulti = (selectedOrderForMap.unit_count || 1) > 1 || (isKB && hasUnit2);
                const effectiveUnitCount = isMulti ? Math.max(selectedOrderForMap.unit_count || 1, 2) : 1;

                return (
                  <>
                    {/* Date & vehicle type header */}
                    <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Tanggal Keberangkatan:</p>
                        <p className="text-sm font-bold text-slate-900">{formatDateLocal(selectedOrderForMap.departure_date)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          Tagihan: {selectedOrderForMap.vehicle_type}
                        </span>
                        {isMulti && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            Fisik: 2x Avanza
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unit Selector (If Multi-Unit Enabled) */}
                    {isMulti && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <label className="text-xs font-bold text-slate-900 block">
                          🚗 Pilih Unit Mobil untuk Dilihat:
                        </label>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {[...Array(effectiveUnitCount)].map((_, idx) => {
                            const uNum = idx + 1;
                            const isSel = vendorSelectedUnit === uNum;
                            const unitBookingsCount = allBookings.filter(
                              (b) => b.route_id === selectedOrderForMap.route_id &&
                                b.departure_date === selectedOrderForMap.departure_date &&
                                (b.unit_number || 1) === uNum &&
                                b.status === 'confirmed'
                            ).length;

                            const unitLabel = isKB
                              ? uNum === 1
                                ? 'Unit 1 (Tanjung Pura)'
                                : uNum === 2
                                ? 'Unit 2 (Galuh Mas)'
                                : `Mobil Unit ${uNum}`
                              : `Mobil Unit ${uNum}`;

                            return (
                              <button
                                key={uNum}
                                type="button"
                                onClick={() => setVendorSelectedUnit(uNum)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                                  isSel
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {unitLabel} ({unitBookingsCount} Penumpang)
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SeatMap render */}
                    {(() => {
                      const routeBookings = allBookings.filter(
                        (b) => b.route_id === selectedOrderForMap.route_id &&
                          b.departure_date === selectedOrderForMap.departure_date &&
                          (isMulti ? (b.unit_number || 1) === vendorSelectedUnit : true) &&
                          b.status === 'confirmed'
                      );

                      const { normalizedBookings } = isMulti
                        ? normalizeUnitBookings(routeBookings, 6)
                        : { normalizedBookings: routeBookings };

                      const displayVehicle: VehicleType = isMulti
                        ? 'Avanza'
                        : (selectedOrderForMap.vehicle_type as VehicleType);

                      return (
                        <SeatMap
                          vehicleType={displayVehicle}
                          bookings={normalizedBookings}
                          selectedSeat={null}
                          onSeatSelect={() => {}}
                        />
                      );
                    })()}
                  </>
                );
              })()}


              {/* Passenger List Summary */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>👥 Daftar Penumpang ({selectedOrderForMap.route_name}):</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Total {allBookings.filter(b => b.route_id === selectedOrderForMap.route_id && b.departure_date === selectedOrderForMap.departure_date && b.status === 'confirmed').length} orang
                  </span>
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {allBookings
                    .filter((b) => b.route_id === selectedOrderForMap.route_id && b.departure_date === selectedOrderForMap.departure_date && b.status === 'confirmed')
                    .map((b) => {
                      const empName = (b as any).employee?.name || 'Penumpang';
                      const dept = (b as any).employee?.department || '';
                      const phone = (b as any).employee?.phone || '';
                      const pickup = b.pickup_point || '-';
                      const unit = b.unit_number || 1;

                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <div className="truncate mr-2">
                            <span className="font-bold text-slate-900">{empName}</span>
                            {dept && <span className="text-slate-400 ml-1">({dept})</span>}
                            <p className="text-[11px] text-slate-500 truncate">
                              📍 {pickup} {phone ? `• 📞 ${phone}` : ''}
                            </p>
                          </div>
                          {(selectedOrderForMap.unit_count || 1) > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 whitespace-nowrap">
                              Unit {unit}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
          <p className="text-center text-xs text-slate-500 mt-2">
            Hover / Tap pada nomor kursi merah untuk melihat nama penumpang.
          </p>
        </div>
      </Dialog>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-slate-900">Tolak Order</h3>
              </div>
              <button
                onClick={() => setRejectModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs font-semibold text-red-700">Rute yang ditolak:</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{rejectModal.routeName}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{rejectModal.date}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Alasan penolakan (opsional)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Contoh: Mobil tidak tersedia, driver berhalangan, dll."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading !== null ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                Tolak Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 4: Register New Driver Modal */}
      {newDriverModal && (
        <Dialog
          isOpen={newDriverModal.isOpen}
          onClose={() => setNewDriverModal(null)}
          title="👨‍✈️ Pendaftaran Supir Vendor Baru"
        >
          <form onSubmit={handleSaveNewDriver} className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-800">
                Supir baru akan otomatis tersimpan sebagai <strong>Supir Vendor</strong> dan langsung dipilih untuk rute ini.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nama Lengkap Supir <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                placeholder="Contoh: Pak Budi Santoso"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor WhatsApp / HP <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={newDriverPhone}
                onChange={(e) => setNewDriverPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Nomor HP diperlukan agar penumpang & admin dapat menghubungi supir saat penjemputan.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setNewDriverModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingNewDriver}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {isSavingNewDriver ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Simpan & Pilih Supir</span>
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

