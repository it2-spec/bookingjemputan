// ============================================================
// Admin Dashboard Page
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

import {
  Users,
  Bus,
  Lock,
  Unlock,
  FileSpreadsheet,
  ChevronRight,
  RefreshCw,
  Bell,
  Check,
  Moon,
  CheckCircle,
  UserPlus,
  Trash2,
  Edit,
} from 'lucide-react';


import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { DRIVER_VEHICLE_MODELS } from '../../components/driver/DriverProfileModal';
import { LicensePlateInput } from '../../components/ui/LicensePlateInput';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SeatMap } from '../../components/booking/SeatMap';
import { TomSelect, type TomSelectOption } from '../../components/ui/TomSelect';
import { useAdminBookings } from '../../hooks/useBooking';
import { useRoutes } from '../../hooks/useRoutes';
import { useRealtimeBookings } from '../../hooks/useRealtimeBookings';
import {
  getTomorrowDate,
  formatDateIndonesian,
  getVehicleType,
  getMaxSeats,
  isBookingClosed,
  normalizeUnitBookings,
} from '../../lib/vehicleLogic';
import { ROUTE_SCHEDULES } from '../../lib/routeSchedules';

import { getVehicleIcon } from '../../lib/utils';
import type { Route, VehicleType, Booking } from '../../lib/types';



export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());

  const [selectedRouteForMap, setSelectedRouteForMap] = useState<{ route: Route; vehicleType: VehicleType } | null>(null);
  const [adminSelectedUnit, setAdminSelectedUnit] = useState<number>(1);
  const [routeOverrides, setRouteOverrides] = useState<Record<string, boolean>>({}); // route_id -> is_billable
  const [routeInvoiceVehicles, setRouteInvoiceVehicles] = useState<Record<string, string>>({}); // route_id -> override_vehicle_type
  const [dailyRouteVehicles, setDailyRouteVehicles] = useState<Record<string, { vehicleType: string; unitCount: number }>>({}); // route_id -> { vehicleType, unitCount } for selectedDate
  const [routeDrivers, setRouteDrivers] = useState<Record<string, string>>({}); // route_id -> driver_employee_id

  const [returnRouteDrivers, setReturnRouteDrivers] = useState<Record<string, string>>({}); // route_id_unit -> return_driver_employee_id
  const [showReturnDriverOverride, setShowReturnDriverOverride] = useState<Record<string, boolean>>({}); // route_id -> boolean
  const [routeApprovalStatus, setRouteApprovalStatus] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({}); // route_id -> vendor_approval_status
  const [availableDrivers, setAvailableDrivers] = useState<{ id: string; name: string; phone: string | null; department?: string; driver_type?: 'internal' | 'vendor' | null; license_plate?: string | null; vehicle_model?: string | null }[]>([]);
  const [selectedSeatForAdmin, setSelectedSeatForAdmin] = useState<{ seatNumber: number; booking?: Booking } | null>(null);

  // Manual Passenger Booking State (Visual Denah Kursi)
  const [allEmployees, setAllEmployees] = useState<{
    id: string;
    nik: string;
    name: string;
    department: string;
    role: string;
    assigned_route_id: string | null;
    default_pickup_point: string | null;
  }[]>([]);
  const [manualEmployeeId, setManualEmployeeId] = useState<string>('');
  const [manualPickupPoint, setManualPickupPoint] = useState<string>('');
  const [isSubmittingManualBooking, setIsSubmittingManualBooking] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);


  // Modal State for Registering New Driver directly from TomSelect
  const [newDriverModal, setNewDriverModal] = useState<{
    isOpen: boolean;
    initialName: string;
    routeId?: string;
    unitNumber?: number;
  } | null>(null);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverPlate, setNewDriverPlate] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState<string>(DRIVER_VEHICLE_MODELS[0]);
  const [newDriverType, setNewDriverType] = useState<'internal' | 'vendor'>('vendor');
  const [isSavingNewDriver, setIsSavingNewDriver] = useState(false);

  // Edit Existing Driver Modal State
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverPlate, setEditDriverPlate] = useState('');
  const [editDriverVehicle, setEditDriverVehicle] = useState<string>(DRIVER_VEHICLE_MODELS[0]);
  const [editDriverType, setEditDriverType] = useState<'internal' | 'vendor'>('vendor');
  const [isSavingEditDriver, setIsSavingEditDriver] = useState(false);

  const handleOpenAddDriver = (
    typedName: string,
    routeId?: string,
    unitNumber: number = 1
  ) => {
    setNewDriverName(typedName);
    setNewDriverPhone('');
    setNewDriverPlate('');
    setNewDriverVehicle(DRIVER_VEHICLE_MODELS[0]);
    setNewDriverType('vendor');
    setNewDriverModal({
      isOpen: true,
      initialName: typedName,
      routeId,
      unitNumber,
    });
  };

  const handleOpenEditDriver = (driver: any) => {
    setEditingDriver(driver);
    setEditDriverName(driver.name || '');
    setEditDriverPhone(driver.phone || '');
    setEditDriverPlate(driver.license_plate || '');
    setEditDriverVehicle(driver.vehicle_model || DRIVER_VEHICLE_MODELS[0]);
    setEditDriverType(driver.driver_type === 'internal' ? 'internal' : 'vendor');
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
      const generatedNik = `DRV-${Date.now().toString().slice(-6)}`;
      const { data: newDriver, error } = await supabase
        .from('employees')
        .insert({
          nik: generatedNik,
          name: newDriverName.trim(),
          phone: newDriverPhone.trim(),
          license_plate: newDriverPlate.trim() || null,
          vehicle_model: newDriverVehicle || null,
          department: newDriverType === 'internal' ? 'Driver Internal' : 'Vendor Driver',
          role: 'driver',
          driver_type: newDriverType,
        })
        .select('id, name, phone, department, driver_type, license_plate, vehicle_model')
        .single();

      if (error) throw error;

      toast.success(`Supir ${newDriverName.trim()} berhasil didaftarkan! 🎉`);

      // Refresh driver list
      await fetchDrivers();

      // Automatically assign new driver to the target route/unit
      if (newDriverModal?.routeId) {
        await handleAssignDriverToRoute(
          newDriverModal.routeId,
          newDriver.id,
          newDriverModal.unitNumber || 1
        );
      }

      setNewDriverModal(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendaftarkan supir baru');
    } finally {
      setIsSavingNewDriver(false);
    }
  };

  const handleSaveEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    if (!editDriverName.trim()) {
      toast.error('Nama supir tidak boleh kosong');
      return;
    }

    setIsSavingEditDriver(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          name: editDriverName.trim(),
          phone: editDriverPhone.trim() || null,
          license_plate: editDriverPlate.trim() || null,
          vehicle_model: editDriverVehicle || null,
          driver_type: editDriverType,
          department: editDriverType === 'internal' ? 'Driver Internal' : 'Vendor Driver',
        })
        .eq('id', editingDriver.id);

      if (error) throw error;

      toast.success(`Data supir ${editDriverName.trim()} & kendaraan berhasil diperbarui! 🎉`);
      await fetchDrivers();
      setEditingDriver(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui data supir');
    } finally {
      setIsSavingEditDriver(false);
    }
  };

  const { data: routes, isLoading: routesLoading } = useRoutes();


  const { data: bookings = [], isLoading: bookingsLoading, refetch } = useAdminBookings(selectedDate);

  useRealtimeBookings(null, selectedDate);

  const isClosed = isBookingClosed(selectedDate);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const handleSendBroadcast = async () => {
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      // 1. Call Edge Function for true Web Push (works when app is closed)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: '📢 Notifikasi dari Admin',
          message: 'Pengingat dari Admin: Jangan lupa pesan jemputan untuk besok!',
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setBroadcastResult(result);
        toast.success(`Berhasil dikirim ke ${result.sent} dari ${result.total} perangkat!`);
      } else {
        const errText = await res.text();
        console.warn('Edge Function error:', errText);
        toast.error('Gagal kirim via Web Push. Cek Supabase Edge Function.');
      }

      // 2. Also send Realtime broadcast as fallback (for users with app open)
      const channel = supabase.channel('admin-notifications');
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'admin-broadcast',
        payload: {
          title: '📢 Notifikasi dari Admin',
          message: 'Pengingat dari Admin: Jangan lupa pesan jemputan untuk besok!',
        },
      });
    } catch (err) {
      toast.error('Gagal mengirim broadcast notifikasi');
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };


  // Group bookings by route (Uses daily override for selected date if set, else Auto recommendation)
  const routeStats = routes?.map((route) => {
    const routeBookings = bookings.filter(
      (b) => b.route_id === route.id && b.status === 'confirmed'
    );
    const confirmedCount = routeBookings.length;

    // Daily override for selected date (strictly defaults to 'Auto' & 1 unit for next days/un-overridden dates)
    const dailySetting = dailyRouteVehicles[route.id];
    const manualType = dailySetting ? dailySetting.vehicleType : 'Auto';
    const unitCount = dailySetting ? dailySetting.unitCount : 1;


    const vehicleType = getVehicleType(confirmedCount, manualType);
    const baseSeats = getMaxSeats(vehicleType);
    const maxSeats = baseSeats * unitCount;

    return {
      route: {
        ...route,
        manual_vehicle_type: manualType,
        unit_count: unitCount,
      },
      confirmedCount,
      vehicleType,
      maxSeats,
      remainingSeats: maxSeats - confirmedCount,
    };
  });

  const handleUpdateManualVehicle = async (routeId: string, vehicleSetting: string, unitCount: number = 1) => {
    try {
      const isAuto = !vehicleSetting || vehicleSetting === 'Auto';
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: selectedDate,
          route_id: routeId,
          daily_vehicle_type: isAuto ? 'Auto' : vehicleSetting,
          daily_unit_count: isAuto ? 1 : unitCount,
          override_vehicle_type: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;

      toast.success(
        isAuto
          ? `Armada tanggal ${formatDateIndonesian(selectedDate)} kembali ke ⚡ Otomatis (Rekomendasi Sistem)! 🚌`
          : `Armada tanggal ${formatDateIndonesian(selectedDate)} diatur menjadi ${vehicleSetting} (${unitCount} Unit)! 🚗`
      );
      fetchDateOverridesAndDrivers();
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah setting armada.');
    }
  };



  const fetchDrivers = useCallback(async () => {
    try {
      const { data: dList, error } = await supabase
        .from('employees')
        .select('id, name, phone, department, driver_type')
        .eq('role', 'driver')
        .order('name', { ascending: true });

      if (!error && dList) {
        setAvailableDrivers(dList as any[]);
      }
    } catch (e) {
      console.warn('Failed to fetch drivers:', e);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nik, name, department, role, assigned_route_id, default_pickup_point')
        .neq('role', 'driver')
        .order('name', { ascending: true });

      if (!error && data) {
        setAllEmployees(data as any[]);
      }
    } catch (e) {
      console.warn('Failed to fetch employees:', e);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    fetchEmployees();
  }, [fetchDrivers, fetchEmployees]);

  // Fetch overrides and drivers for selected date
  const fetchDateOverridesAndDrivers = async () => {
    // Refresh available drivers
    fetchDrivers();

    // 2. Fetch overrides & assigned drivers & override vehicle types

    const { data } = await supabase
      .from('invoice_daily_overrides')
      .select('route_id, is_billable, assigned_driver_id, override_vehicle_type, assigned_driver_id_unit2, assigned_driver_id_unit3, driver_assignments, return_driver_assignments, has_different_return_driver, is_billable_unit2, is_billable_unit3, unit_sources, vendor_approval_status, daily_vehicle_type, daily_unit_count')
      .eq('departure_date', selectedDate);

    const billableMap: Record<string, boolean> = {};
    const driverMap: Record<string, string> = {};
    const returnDriverMap: Record<string, string> = {};
    const returnOverrideToggleMap: Record<string, boolean> = {};
    const invoiceVehicleMap: Record<string, string> = {};
    const dailyVehiclesMap: Record<string, { vehicleType: string; unitCount: number }> = {};
    const approvalMap: Record<string, 'pending' | 'approved' | 'rejected'> = {};

    if (data) {
      data.forEach((item: any) => {
        billableMap[item.route_id] = item.is_billable;
        billableMap[`${item.route_id}_1`] = item.is_billable;
        if (item.is_billable_unit2 !== undefined && item.is_billable_unit2 !== null) {
          billableMap[`${item.route_id}_2`] = item.is_billable_unit2;
        }
        if (item.is_billable_unit3 !== undefined && item.is_billable_unit3 !== null) {
          billableMap[`${item.route_id}_3`] = item.is_billable_unit3;
        }
        if (item.unit_sources && typeof item.unit_sources === 'object') {
          Object.entries(item.unit_sources).forEach(([uKey, isBill]) => {
            billableMap[`${item.route_id}_${uKey}`] = Boolean(isBill);
          });
        }

        if (item.assigned_driver_id) {
          driverMap[`${item.route_id}_1`] = item.assigned_driver_id;
          driverMap[item.route_id] = item.assigned_driver_id; // fallback
        }
        if (item.assigned_driver_id_unit2) {
          driverMap[`${item.route_id}_2`] = item.assigned_driver_id_unit2;
        }
        if (item.assigned_driver_id_unit3) {
          driverMap[`${item.route_id}_3`] = item.assigned_driver_id_unit3;
        }
        if (item.driver_assignments && typeof item.driver_assignments === 'object') {
          Object.entries(item.driver_assignments).forEach(([uKey, dId]) => {
            driverMap[`${item.route_id}_${uKey}`] = dId as string;
          });
        }

        if (item.has_different_return_driver) {
          returnOverrideToggleMap[item.route_id] = true;
        }
        if (item.return_driver_assignments && typeof item.return_driver_assignments === 'object') {
          Object.entries(item.return_driver_assignments).forEach(([uKey, dId]) => {
            returnDriverMap[`${item.route_id}_${uKey}`] = dId as string;
          });
        }

        if (item.daily_vehicle_type) {
          dailyVehiclesMap[item.route_id] = {
            vehicleType: item.daily_vehicle_type,
            unitCount: item.daily_unit_count || 1,
          };
        }

        if (item.override_vehicle_type) {
          invoiceVehicleMap[item.route_id] = item.override_vehicle_type;
        }
        if (item.vendor_approval_status) {
          approvalMap[item.route_id] = item.vendor_approval_status;
        }
      });
    }
    setRouteOverrides(billableMap);
    setRouteDrivers(driverMap);
    setReturnRouteDrivers(returnDriverMap);
    setShowReturnDriverOverride(returnOverrideToggleMap);
    setDailyRouteVehicles(dailyVehiclesMap);
    setRouteInvoiceVehicles(invoiceVehicleMap);
    setRouteApprovalStatus(approvalMap);
  };



  const driverOptions: TomSelectOption[] = useMemo(() => {
    return availableDrivers.map((d) => {
      const isInternal = d.driver_type === 'internal' || (!d.driver_type && (d.name.toLowerCase().includes('internal') || (d.department || '').toLowerCase().includes('internal')));
      const typeTag = isInternal ? '🏢 [Internal PT]' : '💳 [Vendor]';
      const plateTag = d.license_plate ? ` • ${d.license_plate}` : '';
      const vehicleTag = d.vehicle_model ? ` (${d.vehicle_model})` : '';
      const sub = [d.phone ? `WA: ${d.phone}` : '', d.license_plate ? `Plat: ${d.license_plate}` : '', d.vehicle_model ? `Mobil: ${d.vehicle_model}` : ''].filter(Boolean).join(' • ');
      return {
        value: d.id,
        label: `👨‍✈️ ${d.name} ${typeTag}${plateTag}${vehicleTag}`,
        sublabel: sub || undefined,
      };
    });
  }, [availableDrivers]);

  const vehicleConfigOptions: TomSelectOption[] = useMemo(() => [
    { value: 'Auto_1', label: '⚡ Otomatis (Rekomendasi Sistem)' },
    { value: 'Avanza_1', label: '🚗 1x Avanza (Max 6 Kursi)' },
    { value: 'Avanza_2', label: '🚗🚗 2x Avanza (2 Unit Split - Max 12 Kursi)' },
    { value: 'Avanza_3', label: '🚗🚗🚗 3x Avanza (3 Unit Split - Max 18 Kursi)' },
    { value: 'Elf Short_1', label: '🚌 1x Elf Short (Max 14 Kursi)' },
    { value: 'Elf Short_2', label: '🚌🚌 2x Elf Short (2 Unit Split - Max 28 Kursi)' },
    { value: 'Elf Long_1', label: '🚐 1x Elf Long (Max 16 Kursi)' },
  ], []);



  useEffect(() => {
    fetchDateOverridesAndDrivers();
  }, [selectedDate]);

  const handleAssignDriverToRoute = async (routeId: string, driverId: string, unitNumber: number = 1) => {
    try {
      const currentUnit1 = unitNumber === 1 ? (driverId || null) : (routeDrivers[`${routeId}_1`] || routeDrivers[routeId] || null);
      const currentUnit2 = unitNumber === 2 ? (driverId || null) : (routeDrivers[`${routeId}_2`] || null);
      const currentUnit3 = unitNumber === 3 ? (driverId || null) : (routeDrivers[`${routeId}_3`] || null);

      const driverAssignments = {
        '1': currentUnit1,
        '2': currentUnit2,
        '3': currentUnit3,
      };

      // Auto-detect driver source type from driver attribute in database:
      // driver_type === 'internal' -> is_billable = false (Internal PT / Rp 0)
      // driver_type === 'vendor' -> is_billable = true (Sewa Vendor / Masuk Invoice)
      let autoIsBillable = routeOverrides[`${routeId}_${unitNumber}`];
      if (driverId) {
        const selDriver = availableDrivers.find((d) => d.id === driverId);
        if (selDriver) {
          if (selDriver.driver_type === 'internal') {
            autoIsBillable = false;
          } else if (selDriver.driver_type === 'vendor') {
            autoIsBillable = true;
          } else {
            // Fallback checking if driver_type is not yet filled
            const dName = selDriver.name.toLowerCase();
            const dDept = (selDriver.department || '').toLowerCase();
            if (dName.includes('internal') || dDept.includes('internal')) {
              autoIsBillable = false;
            } else {
              autoIsBillable = true;
            }
          }
        }
      }

      const isBill1 = unitNumber === 1 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_1`] ?? routeOverrides[routeId] ?? true);
      const isBill2 = unitNumber === 2 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_2`] ?? true);
      const isBill3 = unitNumber === 3 && autoIsBillable !== undefined ? autoIsBillable : (routeOverrides[`${routeId}_3`] ?? true);

      const payload: any = {
        departure_date: selectedDate,
        route_id: routeId,
        assigned_driver_id: currentUnit1,
        assigned_driver_id_unit2: currentUnit2,
        assigned_driver_id_unit3: currentUnit3,
        driver_assignments: driverAssignments,
        is_billable: isBill1,
        is_billable_unit2: isBill2,
        is_billable_unit3: isBill3,
        unit_sources: {
          '1': isBill1,
          '2': isBill2,
          '3': isBill3,
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('invoice_daily_overrides')
          .upsert({
            departure_date: selectedDate,
            route_id: routeId,
            assigned_driver_id: currentUnit1,
            is_billable: isBill1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'departure_date,route_id' });
        if (fallbackErr) throw fallbackErr;
      }

      toast.success(`Supir Unit ${unitNumber} berhasil ditugaskan! ${autoIsBillable === false ? '(🏢 Otomatis: Driver Internal Rp 0)' : autoIsBillable === true ? '(💳 Otomatis: Sewa Vendor Invoice)' : ''}`);
      fetchDateOverridesAndDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menugaskan supir');
    }
  };

  const handleAssignReturnDriverToRoute = async (routeId: string, driverId: string, unitNumber: number = 1) => {
    const unitKey = `${routeId}_${unitNumber}`;
    const newMap = { ...returnRouteDrivers, [unitKey]: driverId };
    if (unitNumber === 1) newMap[routeId] = driverId;
    setReturnRouteDrivers(newMap);

    try {
      const currentUnit1 = newMap[`${routeId}_1`] || newMap[routeId] || null;
      const currentUnit2 = newMap[`${routeId}_2`] || null;
      const currentUnit3 = newMap[`${routeId}_3`] || null;

      const returnDriverAssignments = {
        '1': currentUnit1,
        '2': currentUnit2,
        '3': currentUnit3,
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: selectedDate,
          route_id: routeId,
          has_different_return_driver: true,
          return_driver_assignments: returnDriverAssignments,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;
      toast.success(`Supir Pulang Sore Unit ${unitNumber} berhasil diperbarui! 🌆`);
      fetchDateOverridesAndDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengatur supir pulang');
    }
  };

  const handleToggleOvertimeFromMap = async (booking: Booking) => {
    const newStatus = !(booking as any).is_overtime_no_return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ is_overtime_no_return: newStatus })
        .eq('id', booking.id);
      if (error) throw error;
      toast.success(
        newStatus
          ? `${(booking as any).employee?.name || 'Penumpang'} ditandai LEMBUR (Tidak Pulang Reguler 16:30) 🌙`
          : `${(booking as any).employee?.name || 'Penumpang'} diset kembali IKUT PULANG PP 🚗`
      );
      refetch();
      setSelectedSeatForAdmin((prev) =>
        prev && prev.booking?.id === booking.id
          ? { ...prev, booking: { ...prev.booking, is_overtime_no_return: newStatus } as any }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status lembur penumpang');
    }
  };

  // Helper: Get pickup stops for the currently opened route in Visual Seat Map
  const currentRouteStops = useMemo(() => {
    if (!selectedRouteForMap) return [];
    const rName = selectedRouteForMap.route.route_name.toLowerCase();
    const matched = ROUTE_SCHEDULES.find(
      (s) =>
        s.routeName.toLowerCase() === rName ||
        rName.includes(s.routeName.toLowerCase()) ||
        s.routeName.toLowerCase().includes(rName)
    );
    if (matched && matched.stops.length > 0) {
      return matched.stops.map((s) => s.name);
    }
    const existingStops = Array.from(
      new Set(
        bookings
          .filter((b) => b.route_id === selectedRouteForMap.route.id && b.pickup_point)
          .map((b) => b.pickup_point!)
      )
    );
    return existingStops.length > 0 ? existingStops : ['Halte Utama'];
  }, [selectedRouteForMap, bookings]);

  // Helper: Get employees eligible for the currently opened route who haven't booked yet
  const eligibleEmployees = useMemo(() => {
    if (!selectedRouteForMap) return [];
    const rId = selectedRouteForMap.route.id;
    const isKB = selectedRouteForMap.route.route_name.toLowerCase().includes('karawang barat');

    return allEmployees.filter((emp) => {
      // Must not already have a confirmed booking on selectedDate
      const hasBookingToday = bookings.some(
        (b) => b.employee_id === emp.id && b.status === 'confirmed'
      );
      if (hasBookingToday) return false;

      // Must have right to ride this route (assigned_route_id matches, or default KB if null)
      const isAssigned = emp.assigned_route_id === rId || (!emp.assigned_route_id && isKB);
      return isAssigned;
    });
  }, [allEmployees, selectedRouteForMap, bookings]);

  // Handler: When Admin selects an employee in manual booking dropdown
  const handleSelectManualEmployee = (empId: string) => {
    setManualEmployeeId(empId);
    const emp = allEmployees.find((e) => e.id === empId);
    if (emp?.default_pickup_point && currentRouteStops.includes(emp.default_pickup_point)) {
      setManualPickupPoint(emp.default_pickup_point);
    } else if (emp?.default_pickup_point) {
      setManualPickupPoint(emp.default_pickup_point);
    } else if (currentRouteStops.length > 0) {
      setManualPickupPoint(currentRouteStops[0]);
    } else {
      setManualPickupPoint('');
    }
  };

  // Handler: Confirm manual booking for the selected empty seat
  const handleConfirmManualBooking = async () => {
    if (!selectedRouteForMap || !selectedSeatForAdmin) return;
    if (!manualEmployeeId) {
      toast.error('Silakan pilih karyawan terlebih dahulu!');
      return;
    }
    if (!manualPickupPoint.trim()) {
      toast.error('Silakan pilih titik jemput (halte)!');
      return;
    }

    const emp = allEmployees.find((e) => e.id === manualEmployeeId);
    setIsSubmittingManualBooking(true);
    try {
      const isMulti = (selectedRouteForMap.route.unit_count || 1) > 1;
      const unitNum = isMulti ? adminSelectedUnit : 1;

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          employee_id: manualEmployeeId,
          route_id: selectedRouteForMap.route.id,
          departure_date: selectedDate,
          seat_number: selectedSeatForAdmin.seatNumber,
          unit_number: unitNum,
          vehicle_type: selectedRouteForMap.vehicleType,
          pickup_point: manualPickupPoint.trim(),
          status: 'confirmed',
        })
        .select('*, employee:employees(*), route:routes(*)')
        .single();

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('idx_one_booking_per_day')) {
            throw new Error('Karyawan ini sudah memiliki booking untuk hari ini.');
          }
          if (error.message.includes('idx_unique_seat_per_route_day')) {
            throw new Error('Kursi ini sudah terisi oleh penumpang lain.');
          }
        }
        throw error;
      }

      toast.success(`Berhasil mendaftarkan ${emp?.name || 'karyawan'} ke Kursi No. ${selectedSeatForAdmin.seatNumber}! 🎉`);
      refetch();
      setManualEmployeeId('');
      setManualPickupPoint('');
      setSelectedSeatForAdmin({
        seatNumber: selectedSeatForAdmin.seatNumber,
        booking: data as Booking,
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan penumpang manual');
    } finally {
      setIsSubmittingManualBooking(false);
    }
  };

  // Handler: Cancel / remove a booking directly from seat map dialog
  const handleCancelBookingFromMap = async (bookingId: string, passengerName: string) => {
    if (!window.confirm(`Yakin ingin membatalkan booking kursi untuk ${passengerName}? Kursi ini akan menjadi kosong kembali.`)) {
      return;
    }

    setIsCancellingBooking(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast.success(`Booking untuk ${passengerName} berhasil dibatalkan. Kursi kini kosong.`);
      refetch();
      if (selectedSeatForAdmin) {
        setSelectedSeatForAdmin({
          seatNumber: selectedSeatForAdmin.seatNumber,
          booking: undefined,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan booking');
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // Handler: Drag and Drop Seat Move or Swap
  const handleSeatSwap = async (sourceSeat: number, targetSeat: number) => {
    if (!selectedRouteForMap) return;
    if (sourceSeat === targetSeat) return;

    const isMulti = (selectedRouteForMap.route.unit_count || 1) > 1;
    const rawUnitBookings = isMulti
      ? bookings.filter(
        (b) =>
          b.route_id === selectedRouteForMap.route.id &&
          (b.unit_number || 1) === adminSelectedUnit &&
          b.status === 'confirmed'
      )
      : bookings.filter(
        (b) => b.route_id === selectedRouteForMap.route.id && b.status === 'confirmed'
      );

    const { normalizedBookings } = isMulti
      ? normalizeUnitBookings(rawUnitBookings, 6)
      : { normalizedBookings: rawUnitBookings };

    const sourceBooking = normalizedBookings.find((b) => b.seat_number === sourceSeat);
    if (!sourceBooking) {
      toast.error('Tidak ada penumpang di kursi yang digeser.');
      return;
    }

    const targetBooking = normalizedBookings.find((b) => b.seat_number === targetSeat);
    const sourceName = (sourceBooking as any).employee?.name || 'Penumpang';

    try {
      if (!targetBooking) {
        // Target is an EMPTY seat: Move source passenger to targetSeat
        const { error } = await supabase
          .from('bookings')
          .update({ seat_number: targetSeat })
          .eq('id', sourceBooking.id);

        if (error) throw error;
        toast.success(`${sourceName} dipindahkan ke Kursi No. ${targetSeat}! 💺`);
      } else {
        // Target is an OCCUPIED seat: Swap the two passengers safely
        const targetName = (targetBooking as any).employee?.name || 'Penumpang';

        // 3-step safe swap to avoid unique constraint collisions in Postgres
        // 1. Move sourceBooking to temporary seat -999
        const { error: err1 } = await supabase
          .from('bookings')
          .update({ seat_number: -999 })
          .eq('id', sourceBooking.id);
        if (err1) throw err1;

        // 2. Move targetBooking to sourceSeat
        const { error: err2 } = await supabase
          .from('bookings')
          .update({ seat_number: sourceSeat })
          .eq('id', targetBooking.id);
        if (err2) throw err2;

        // 3. Move sourceBooking to targetSeat
        const { error: err3 } = await supabase
          .from('bookings')
          .update({ seat_number: targetSeat })
          .eq('id', sourceBooking.id);
        if (err3) throw err3;

        toast.success(`Posisi ${sourceName} (No. ${sourceSeat}) & ${targetName} (No. ${targetSeat}) berhasil ditukar! 🔄`);
      }

      refetch();
      // Keep or update selected seat to targetSeat
      setSelectedSeatForAdmin({
        seatNumber: targetSeat,
        booking: { ...sourceBooking, seat_number: targetSeat },
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal memindahkan atau menukar kursi');
      refetch();
    }
  };


  const handleSetRouteInvoiceVehicle = async (routeId: string, vehicleType: string) => {
    try {
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: selectedDate,
          route_id: routeId,
          override_vehicle_type: vehicleType || null,
          is_billable: routeOverrides[routeId] ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;
      toast.success('Tipe armada tagihan invoice berhasil diperbarui! 📄');
      fetchDateOverridesAndDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah armada tagihan invoice');
    }
  };

  const handleToggleUnitBillable = async (routeId: string, unitNumber: number = 1, currentIsBillable: boolean) => {
    const newStatus = !currentIsBillable;
    const unitKey = `${routeId}_${unitNumber}`;
    const newBillableMap = { ...routeOverrides, [unitKey]: newStatus };
    if (unitNumber === 1) newBillableMap[routeId] = newStatus;

    // 1. Optimistic UI update
    setRouteOverrides(newBillableMap);

    try {
      const isBill1 = newBillableMap[`${routeId}_1`] ?? newBillableMap[routeId] ?? true;
      const isBill2 = newBillableMap[`${routeId}_2`] ?? true;
      const isBill3 = newBillableMap[`${routeId}_3`] ?? true;

      const payload: any = {
        departure_date: selectedDate,
        route_id: routeId,
        is_billable: isBill1,
        is_billable_unit2: isBill2,
        is_billable_unit3: isBill3,
        unit_sources: {
          '1': isBill1,
          '2': isBill2,
          '3': isBill3,
        },
        assigned_driver_id: routeDrivers[`${routeId}_1`] || routeDrivers[routeId] || null,
        assigned_driver_id_unit2: routeDrivers[`${routeId}_2`] || null,
        assigned_driver_id_unit3: routeDrivers[`${routeId}_3`] || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('invoice_daily_overrides')
          .upsert({
            departure_date: selectedDate,
            route_id: routeId,
            is_billable: isBill1,
            note: isBill1 ? null : 'Driver / Mobil Sendiri',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'departure_date,route_id' });
        if (fallbackErr) throw fallbackErr;
      }

      toast.success(newStatus ? `Unit ${unitNumber}: Sewa Vendor (Invoice)` : `Unit ${unitNumber}: Driver Sendiri (Rp 0)`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status sumber armada');
      fetchDateOverridesAndDrivers(); // Revert on failure
    }
  };

  const handleToggleRouteBillable = async (routeId: string, currentIsBillable: boolean) => {
    await handleToggleUnitBillable(routeId, 1, currentIsBillable);
  };

  const [isSplitting, setIsSplitting] = useState(false);

  const handleSplitKarawangBaratNow = async (routeId: string) => {
    setIsSplitting(true);
    try {
      const kbBookings = bookings.filter(
        (b) => b.route_id === routeId && b.status === 'confirmed'
      );

      if (kbBookings.length === 0) {
        toast.error('Tidak ada booking aktif di rute Karawang Barat untuk tanggal ini.');
        return;
      }

      const unit1Keywords = ['tanjung pura', 'gempol'];
      let updatedCount = 0;

      for (const booking of kbBookings) {
        const pickup = (booking.pickup_point || '').toLowerCase();
        const targetUnit = unit1Keywords.some((k) => pickup.includes(k)) ? 1 : 2;

        const { error: updErr } = await supabase
          .from('bookings')
          .update({ unit_number: targetUnit, vehicle_type: 'Avanza' })
          .eq('id', booking.id);
        if (!updErr) updatedCount++;
      }

      await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: selectedDate,
          route_id: routeId,
          daily_vehicle_type: 'Avanza',
          daily_unit_count: 2,
          override_vehicle_type: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      toast.success(
        `Berhasil split & susun ulang kursi ${updatedCount} penumpang Karawang Barat ke Unit 1 & Unit 2! 🚗✨`
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membagi penumpang');
    } finally {
      setIsSplitting(false);
    }
  };

  const totalConfirmed = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <div className="space-y-5">
      {/* Header & Date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-[family-name:var(--font-display)]">
            Ringkasan Operasional
          </h1>
          <p className="text-sm text-slate-600">
            {formatDateIndonesian(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
          />
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSendBroadcast()}
            disabled={isBroadcasting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
            title="Kirim Push Notification ke Semua User"
          >
            <Bell className={`w-4 h-4 ${isBroadcasting ? 'animate-pulse' : ''}`} />
            <span>{isBroadcasting ? 'Mengirim...' : 'Broadcast'}</span>
          </button>
        </div>
      </div>

      {/* Broadcast result banner */}
      {broadcastResult && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-primary-50 border border-primary-200 text-xs">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-primary-500 shrink-0" />
            <span className="text-primary-700">
              Push terkirim ke <strong>{broadcastResult.sent}</strong> perangkat
              {broadcastResult.failed > 0 && <>, <span className="text-red-500 font-semibold">{broadcastResult.failed} gagal</span></>}
              {' '}(total terdaftar: {broadcastResult.total})
            </span>
          </div>
          <button
            onClick={() => navigate('/admin/devices')}
            className="text-primary-600 font-bold hover:underline ml-2 shrink-0 cursor-pointer"
          >
            Lihat Perangkat &rarr;
          </button>
        </div>
      )}

      {/* Lock status banner */}
      <Card className={isClosed ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isClosed ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                {isClosed ? 'Booking Terkunci (Lewat 19:00 WIB)' : 'Booking Masih Terbuka'}
              </span>
              <Badge variant={isClosed ? 'warning' : 'success'}>
                {isClosed ? 'Locked' : 'Open'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isClosed
                ? 'Jenis armada terkunci. Tidak dapat otomatis downgrade jika ada pembatalan.'
                : 'Pemesanan dan penyesuaian otomatis armada masih berjalan.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Penumpang</p>
              <p className="text-lg font-bold text-slate-900">{totalConfirmed}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Rute</p>
              <p className="text-lg font-bold text-slate-900">{routes?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500">Daftar Penumpang</p>
              <button
                onClick={() => navigate('/admin/passengers')}
                className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-0.5"
              >
                Lihat Detail <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Routes & Vehicle Status List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Status Armada per Rute
        </h2>

        {routesLoading || bookingsLoading ? (
          <p className="text-sm text-slate-600 py-4">Memuat data...</p>
        ) : (
          routeStats?.map((stat, i) => (
            <motion.div
              key={stat.route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                      {getVehicleIcon(stat.vehicleType)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base font-[family-name:var(--font-display)] flex items-center gap-2">
                        {stat.route.route_name}
                        {/* Vendor Approval Badge (Read-only) */}
                        {(() => {
                          const status = routeApprovalStatus[stat.route.id];
                          if (status === 'approved') return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✅ Vendor Setuju
                            </span>
                          );
                          if (status === 'rejected') return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              ❌ Vendor Tolak
                            </span>
                          );
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              ⏳ Menunggu Vendor
                            </span>
                          );
                        })()}
                      </h3>
                      {/* Configuration Controls Bar */}
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        {/* 1. Konfigurasi Armada */}
                        <div className="flex-1 min-w-[220px] max-w-sm">
                          <span className="text-xs text-slate-600 font-medium block mb-1">Konfigurasi Armada:</span>
                          <TomSelect
                            value={
                              stat.route.manual_vehicle_type
                                ? `${stat.route.manual_vehicle_type}_${stat.route.unit_count || 1}`
                                : 'Auto_1'
                            }
                            onChange={(val) => {
                              if (!val || val === 'Auto_1') {
                                handleUpdateManualVehicle(stat.route.id, 'Auto', 1);
                              } else {
                                const [vType, uCount] = val.split('_');
                                handleUpdateManualVehicle(stat.route.id, vType, Number(uCount));
                              }
                            }}
                            options={vehicleConfigOptions}
                            placeholder="-- Pilih Konfigurasi Armada --"
                          />
                        </div>


                        {/* 2. Supir / Driver (Berangkat) */}
                        {(stat.route.unit_count || 1) > 1 ? (
                          <div className="flex flex-wrap items-center gap-2 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl my-1">
                            <span className="text-xs text-slate-700 font-bold w-full">👨‍✈️ Penugasan Supir Berangkat per Unit:</span>
                            {[...Array(stat.route.unit_count || 1)].map((_, uIdx) => {
                              const uNum = uIdx + 1;
                              const isKB = stat.route.route_name.toLowerCase().includes('karawang barat');
                              const unitLabel = isKB
                                ? uNum === 1
                                  ? 'Unit 1 (Tanjung Pura)'
                                  : uNum === 2
                                    ? 'Unit 2 (Galuh Mas)'
                                    : `Unit ${uNum}`
                                : `Unit ${uNum}`;

                              const currentVal = routeDrivers[`${stat.route.id}_${uNum}`] || (uNum === 1 ? routeDrivers[stat.route.id] : '') || '';

                              return (
                                  <div key={uNum} className="flex-1 min-w-[200px] bg-white p-2 rounded-lg border border-slate-200 shadow-2xs space-y-1">
                                    <span className="text-[11px] text-slate-700 font-bold block">{unitLabel}:</span>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1">
                                        <TomSelect
                                          value={currentVal}
                                          onChange={(val) => handleAssignDriverToRoute(stat.route.id, val, uNum)}
                                          options={driverOptions}
                                          placeholder="-- Pilih Supir Rute Ini --"
                                          onCreate={(typed) => handleOpenAddDriver(typed, stat.route.id, uNum)}
                                          createLabel="Daftarkan Supir Baru"
                                        />
                                      </div>
                                      {currentVal && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const d = availableDrivers.find((drv) => drv.id === currentVal);
                                            if (d) handleOpenEditDriver(d);
                                          }}
                                          className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border border-slate-200"
                                          title="Edit Data Supir & Kendaraan"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex-1 min-w-[220px] max-w-sm">
                              <span className="text-xs text-slate-600 font-medium block mb-1">Supir / Driver (Berangkat):</span>
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1">
                                  <TomSelect
                                    value={routeDrivers[`${stat.route.id}_1`] || routeDrivers[stat.route.id] || ''}
                                    onChange={(val) => handleAssignDriverToRoute(stat.route.id, val, 1)}
                                    options={driverOptions}
                                    placeholder="-- Pilih Supir Rute Ini --"
                                    onCreate={(typed) => handleOpenAddDriver(typed, stat.route.id, 1)}
                                    createLabel="Daftarkan Supir Baru"
                                  />
                                </div>
                                {(routeDrivers[`${stat.route.id}_1`] || routeDrivers[stat.route.id]) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dId = routeDrivers[`${stat.route.id}_1`] || routeDrivers[stat.route.id];
                                      const d = availableDrivers.find((drv) => drv.id === dId);
                                      if (d) handleOpenEditDriver(d);
                                    }}
                                    className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border border-slate-200"
                                    title="Edit Data Supir & Kendaraan"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                        {/* Toggle Supir Pulang Sore Berbeda (Shift 16:30) */}
                        <div className="w-full pt-1">
                          <button
                            type="button"
                            onClick={() => setShowReturnDriverOverride((prev) => ({ ...prev, [stat.route.id]: !prev[stat.route.id] }))}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer py-0.5"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>
                              {showReturnDriverOverride[stat.route.id]
                                ? '▾ Sembunyikan Pengaturan Supir Pulang Sore'
                                : '▸ 🌙 Atur Supir Pulang Sore Berbeda (Shift 16:30)'}
                            </span>
                          </button>

                          {showReturnDriverOverride[stat.route.id] && (
                            <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                                  <Moon className="w-3.5 h-3.5 text-blue-600" />
                                  Supir Pulang Sore (16:30):
                                </span>
                                <span className="text-[10px] text-blue-600 font-medium">
                                  (Default: Sama dengan Supir Berangkat)
                                </span>
                              </div>

                              {(stat.route.unit_count || 1) > 1 ? (
                                <div className="flex flex-wrap gap-2">
                                  {[...Array(stat.route.unit_count || 1)].map((_, uIdx) => {
                                    const uNum = uIdx + 1;
                                    const isKB = stat.route.route_name.toLowerCase().includes('karawang barat');
                                    const unitLabel = isKB ? (uNum === 1 ? 'Unit 1 (Tj. Pura)' : 'Unit 2 (Galuh Mas)') : `Unit ${uNum}`;
                                    const currentVal = returnRouteDrivers[`${stat.route.id}_${uNum}`] || returnRouteDrivers[stat.route.id] || '';

                                    return (
                                      <div key={uNum} className="flex-1 min-w-[200px] bg-white p-2 rounded-lg border border-blue-200 shadow-2xs">
                                        <span className="text-[11px] text-slate-700 font-bold block mb-1">{unitLabel} (Sore):</span>
                                        <TomSelect
                                          value={currentVal}
                                          onChange={(val) => handleAssignReturnDriverToRoute(stat.route.id, val, uNum)}
                                          options={driverOptions}
                                          placeholder="-- Ikuti Supir Berangkat --"
                                          onCreate={(typed) => handleOpenAddDriver(typed, stat.route.id, uNum)}
                                          createLabel="Daftarkan Supir Baru"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="max-w-sm">
                                  <TomSelect
                                    value={returnRouteDrivers[`${stat.route.id}_1`] || returnRouteDrivers[stat.route.id] || ''}
                                    onChange={(val) => handleAssignReturnDriverToRoute(stat.route.id, val, 1)}
                                    options={driverOptions}
                                    placeholder="-- Ikuti Supir Berangkat --"
                                    onCreate={(typed) => handleOpenAddDriver(typed, stat.route.id, 1)}
                                    createLabel="Daftarkan Supir Baru"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>


                        {/* 3. Sumber Armada */}
                        {(stat.route.unit_count || 1) > 1 ? (
                          <div className="flex flex-wrap items-center gap-2 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl my-1">
                            <span className="text-xs text-slate-700 font-bold w-full">🏢 Sumber Armada per Unit Mobil:</span>
                            {[...Array(stat.route.unit_count || 1)].map((_, uIdx) => {
                              const uNum = uIdx + 1;
                              const isKB = stat.route.route_name.toLowerCase().includes('karawang barat');
                              const unitLabel = isKB
                                ? uNum === 1
                                  ? 'Unit 1 (Tanjung Pura)'
                                  : uNum === 2
                                    ? 'Unit 2 (Galuh Mas)'
                                    : `Unit ${uNum}`
                                : `Unit ${uNum}`;

                              const isBillable = routeOverrides[`${stat.route.id}_${uNum}`] ?? (uNum === 1 ? routeOverrides[stat.route.id] : true) ?? true;

                              return (
                                <div key={uNum} className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                  <span className="text-[11px] text-slate-600 font-bold whitespace-nowrap">{unitLabel}:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUnitBillable(stat.route.id, uNum, isBillable)}
                                    className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all border cursor-pointer flex items-center gap-1 ${isBillable
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                      }`}
                                  >
                                    {isBillable ? '💳 Sewa Vendor (Invoice)' : '🏢 Driver Sendiri (Rp 0)'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col justify-end">
                            <span className="text-xs text-slate-600 font-medium block mb-1">Sumber Armada:</span>
                            {(() => {
                              const isBillable = routeOverrides[`${stat.route.id}_1`] ?? routeOverrides[stat.route.id] ?? true;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRouteBillable(stat.route.id, isBillable)}
                                  className={`px-3 py-2 text-xs rounded-xl font-bold transition-all border cursor-pointer flex items-center gap-1 ${isBillable
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                    }`}
                                >
                                  {isBillable ? '💳 Sewa Vendor (Masuk Invoice)' : '🏢 Driver Sendiri / PT (Rp 0)'}
                                </button>
                              );
                            })()}
                          </div>
                        )}

                        {/* 4. Armada Invoice Vendor (Hanya tampil jika sewa vendor / billable) */}
                        {(() => {
                          const isMulti = (stat.route.unit_count || 1) > 1;
                          const isBillable = isMulti
                            ? [...Array(stat.route.unit_count || 1)].some((_, uIdx) => {
                              const u = uIdx + 1;
                              return routeOverrides[`${stat.route.id}_${u}`] ?? (u === 1 ? routeOverrides[stat.route.id] : true) ?? true;
                            })
                            : (routeOverrides[`${stat.route.id}_1`] ?? routeOverrides[stat.route.id] ?? true);

                          if (!isBillable) return null;

                          const currentInvoiceVehicle = routeInvoiceVehicles[stat.route.id] || stat.vehicleType;

                          return (
                            <div className="flex-1 min-w-[220px] max-w-sm">
                              <span className="text-xs text-slate-600 font-medium block mb-1">Armada Invoice Vendor:</span>
                              <TomSelect
                                value={currentInvoiceVehicle}
                                onChange={(val) => handleSetRouteInvoiceVehicle(stat.route.id, val)}
                                options={[
                                  { value: 'Avanza', label: '🚗 Avanza (Tagihan Avanza)' },
                                  { value: 'Elf Short', label: '🚌 Elf Short (Tagihan Elf Short)' },
                                  { value: 'Elf Long', label: '🚐 Elf Long (Tagihan Elf Long)' },
                                ]}
                                placeholder="-- Pilih Armada Invoice --"
                              />
                            </div>

                          );
                        })()}
                      </div>



                      {/* Special Split Zonasi Banner for Karawang Barat */}
                      {stat.route.route_name.toLowerCase().includes('karawang barat') && (
                        <div className="w-full mt-3 p-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 border border-blue-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <RefreshCw className={`w-4 h-4 ${isSplitting ? 'animate-spin' : ''}`} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Split Zonasi (2 Avanza)</span>
                                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">
                                  {stat.confirmedCount} Penumpang
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                Otomatis bagi penumpang ke <span className="font-semibold text-slate-800">Unit 1 (Tj. Pura)</span> & <span className="font-semibold text-slate-800">Unit 2 (Galuh Mas)</span> sesuai titik halte.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSplitKarawangBaratNow(stat.route.id)}
                            disabled={isSplitting || stat.confirmedCount === 0}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSplitting ? 'animate-spin' : ''}`} />
                            <span>{isSplitting ? 'Memproses...' : '⚡ Jalankan Auto-Split'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>


                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">


                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">Terisi / Kapasitas</p>
                      <p className="text-sm font-bold text-slate-900">
                        {stat.confirmedCount} / {stat.maxSeats} Kursi
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAdminSelectedUnit(1);
                          setSelectedRouteForMap({ route: stat.route, vehicleType: stat.vehicleType });
                        }}
                      >
                        Visual Kursi 💺
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/passengers?route=${stat.route.id}&date=${selectedDate}`)}
                      >
                        Daftar Penumpang
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Visual Seat Map Dialog for Admin */}
      <Dialog
        isOpen={!!selectedRouteForMap}
        onClose={() => {
          setSelectedRouteForMap(null);
          setSelectedSeatForAdmin(null);
          setManualEmployeeId('');
          setManualPickupPoint('');
        }}
        title={`Visual Denah Kursi - ${selectedRouteForMap?.route.route_name || ''}`}
      >
        <div className="space-y-4 py-2">
          {selectedRouteForMap && (
            <>
              {/* Unit Selector (If Multi-Unit Enabled) */}
              {(selectedRouteForMap.route.unit_count || 1) > 1 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-900 block">
                    🚗 Pilih Unit Mobil untuk Dilihat:
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[...Array(selectedRouteForMap.route.unit_count || 1)].map((_, idx) => {
                      const uNum = idx + 1;
                      const isSel = adminSelectedUnit === uNum;
                      const unitBookingsCount = bookings.filter(
                        (b) => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === uNum && b.status === 'confirmed'
                      ).length;

                      const getUnitLabel = (u: number) => {
                        const isKB = selectedRouteForMap?.route.route_name.toLowerCase().includes('karawang barat');
                        if (isKB) {
                          return u === 1 ? 'Tanjung Pura' : u === 2 ? 'Galuh Mas' : `Mobil Unit ${u}`;
                        }
                        return `Mobil Unit ${u}`;
                      };

                      return (
                        <button
                          key={uNum}
                          type="button"
                          onClick={() => {
                            setAdminSelectedUnit(uNum);
                            setSelectedSeatForAdmin(null);
                            setManualEmployeeId('');
                            setManualPickupPoint('');
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${isSel
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          {getUnitLabel(uNum)} ({unitBookingsCount} Penumpang)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const isMulti = (selectedRouteForMap.route.unit_count || 1) > 1;
                const rawUnitBookings = isMulti
                  ? bookings.filter(
                    (b) => b.route_id === selectedRouteForMap.route.id &&
                      (b.unit_number || 1) === adminSelectedUnit &&
                      b.status === 'confirmed'
                  )
                  : bookings.filter(
                    (b) => b.route_id === selectedRouteForMap.route.id && b.status === 'confirmed'
                  );

                const { normalizedBookings } = isMulti
                  ? normalizeUnitBookings(rawUnitBookings, 6)
                  : { normalizedBookings: rawUnitBookings };

                const displayVehicle = isMulti
                  ? ((selectedRouteForMap.route.manual_vehicle_type as VehicleType) || 'Avanza')
                  : selectedRouteForMap.vehicleType;

                return (
                  <SeatMap
                    vehicleType={displayVehicle}
                    bookings={normalizedBookings}
                    selectedSeat={selectedSeatForAdmin?.seatNumber || null}
                    allowBookedClick={true}
                    allowDragDrop={true}
                    onSeatSwap={handleSeatSwap}
                    onSeatSelect={(seatNumber) => {
                      const foundBooking = normalizedBookings.find((b) => b.seat_number === seatNumber);
                      setSelectedSeatForAdmin({ seatNumber, booking: foundBooking });
                      setManualEmployeeId('');
                      setManualPickupPoint('');
                    }}
                    onSeatClickWithBooking={(seatNumber, bkg) => {
                      const foundBooking = bkg || normalizedBookings.find((b) => b.seat_number === seatNumber);
                      setSelectedSeatForAdmin({ seatNumber, booking: foundBooking });
                      setManualEmployeeId('');
                      setManualPickupPoint('');
                    }}
                  />
                );
              })()}


              {/* Selected Seat Passenger Info / Manual Booking / Overtime Toggle Panel */}
              {selectedSeatForAdmin?.booking ? (
                <div className="mt-3 p-3.5 bg-purple-50/90 border border-purple-200 rounded-2xl space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Kursi Terpilih No. {selectedSeatForAdmin.seatNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {(selectedSeatForAdmin.booking as any).employee?.name || 'Penumpang'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        NIK: {(selectedSeatForAdmin.booking as any).employee?.nik || '-'} • {(selectedSeatForAdmin.booking as any).employee?.department || '-'}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        📍 Halte: {(selectedSeatForAdmin.booking as any).pickup_point || '-'}
                      </p>
                    </div>

                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border shrink-0 ${(selectedSeatForAdmin.booking as any).is_overtime_no_return
                        ? 'bg-purple-200 text-purple-900 border-purple-300 flex items-center gap-1 shadow-2xs'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1'
                      }`}>
                      {(selectedSeatForAdmin.booking as any).is_overtime_no_return ? (
                        <>
                          <Moon className="w-3 h-3" /> Lembur (Off Pulang)
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" /> Ikut Pulang Reguler
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleOvertimeFromMap(selectedSeatForAdmin.booking!)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${(selectedSeatForAdmin.booking as any).is_overtime_no_return
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                          : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700'
                        }`}
                    >
                      {(selectedSeatForAdmin.booking as any).is_overtime_no_return ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Kembalikan ke Ikut Pulang Reguler (16:30)</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4" />
                          <span>Tandai Lembur (Tidak Pulang Sore 16:30)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isCancellingBooking}
                      onClick={() =>
                        handleCancelBookingFromMap(
                          selectedSeatForAdmin.booking!.id,
                          (selectedSeatForAdmin.booking as any).employee?.name || 'Penumpang'
                        )
                      }
                      title="Batalkan / Kosongkan Kursi Ini"
                      className="py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 shadow-xs cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ) : selectedSeatForAdmin ? (
                /* Empty Seat: Manual Add Passenger Panel */
                <div className="mt-3 p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      <span>Tambah Penumpang ke Kursi No. {selectedSeatForAdmin.seatNumber}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Tersedia / Kosong
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Pilih karyawan yang memiliki hak naik rute <strong>{selectedRouteForMap.route.route_name}</strong> untuk didaftarkan ke kursi ini.
                  </p>

                  <div className="space-y-2.5">
                    {/* 1. Pilih Karyawan */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Pilih Karyawan Berhak ({eligibleEmployees.length} karyawan tersedia):
                      </label>
                      {eligibleEmployees.length === 0 ? (
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 italic">
                          Semua karyawan yang berhak naik rute ini sudah memiliki booking untuk tanggal ini.
                        </div>
                      ) : (
                        <TomSelect
                          value={manualEmployeeId}
                          onChange={handleSelectManualEmployee}
                          options={[
                            { value: '', label: '-- Pilih Karyawan Berhak --' },
                            ...eligibleEmployees.map((e) => ({
                              value: e.id,
                              label: `${e.name} (${e.nik})`,
                              sublabel: `${e.department}${e.default_pickup_point ? ` • Halte: ${e.default_pickup_point}` : ''}`,
                            })),
                          ]}
                          placeholder="Ketik nama atau NIK karyawan..."
                        />
                      )}
                    </div>

                    {/* 2. Titik Jemput (Halte) */}
                    {manualEmployeeId && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Titik Penjemputan (Halte):
                        </label>
                        <select
                          value={manualPickupPoint}
                          onChange={(e) => setManualPickupPoint(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                        >
                          <option value="">-- Pilih Halte Penjemputan --</option>
                          {currentRouteStops.map((stop) => (
                            <option key={stop} value={stop}>
                              📍 {stop}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 3. Tombol Submit */}
                    <button
                      type="button"
                      onClick={handleConfirmManualBooking}
                      disabled={isSubmittingManualBooking || !manualEmployeeId || !manualPickupPoint}
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 shadow-xs cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white border-blue-700"
                    >
                      {isSubmittingManualBooking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan Booking...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Daftarkan ke Kursi No. {selectedSeatForAdmin.seatNumber}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  👆 <em>Klik salah satu kursi pada denah di atas untuk <strong>mendaftarkan penumpang manual</strong> (kursi kosong) atau <strong>mengatur status lembur / hapus</strong> (kursi terisi).</em>
                </div>
              )}

              {/* Quick Passenger Reassign List in Modal for Multi-Unit */}
              {(selectedRouteForMap.route.unit_count || 1) > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>👥 Pindahkan Penumpang antar Unit (Jika Over-capacity):</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Unit 1: {bookings.filter(b => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === 1 && b.status === 'confirmed').length} org •
                      Unit 2: {bookings.filter(b => b.route_id === selectedRouteForMap.route.id && (b.unit_number || 1) === 2 && b.status === 'confirmed').length} org
                    </span>
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {bookings
                      .filter((b) => b.route_id === selectedRouteForMap.route.id && b.status === 'confirmed')
                      .map((b) => {
                        const empName = (b as any).employee?.name || 'Penumpang';
                        const pickup = b.pickup_point || '-';
                        const currentUnit = b.unit_number || 1;

                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <div className="truncate mr-2">
                              <span className="font-bold text-slate-900">{empName}</span>
                              <span className="text-[11px] text-slate-500 ml-1.5 truncate">
                                (📍 {pickup})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] text-slate-500 font-medium">Unit:</span>
                              <select
                                value={currentUnit}
                                onChange={async (e) => {
                                  const targetUnit = parseInt(e.target.value, 10);
                                  try {
                                    const { error } = await supabase
                                      .from('bookings')
                                      .update({ unit_number: targetUnit })
                                      .eq('id', b.id);
                                    if (error) throw error;
                                    toast.success(`${empName} dipindahkan ke Unit ${targetUnit}! 🚗`);
                                    refetch();
                                  } catch (err: any) {
                                    toast.error(err.message || 'Gagal memindahkan unit');
                                  }
                                }}
                                className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded-md text-blue-700 cursor-pointer shadow-2xs"
                              >
                                {[...Array(selectedRouteForMap.route.unit_count || 1)].map((_, idx) => {
                                  const u = idx + 1;
                                  const isKB = selectedRouteForMap.route.route_name.toLowerCase().includes('karawang barat');
                                  const label = isKB
                                    ? u === 1 ? 'Unit 1 (Tanjung Pura)' : u === 2 ? 'Unit 2 (Galuh Mas)' : `Unit ${u}`
                                    : `Unit ${u}`;
                                  return (
                                    <option key={u} value={u}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="text-center text-xs text-slate-500 mt-2">
            Hover / Tap pada nomor kursi merah untuk melihat nama penumpang.
          </p>
        </div>
      </Dialog>

      {/* Register New Driver Modal */}
      {newDriverModal && (
        <Dialog
          isOpen={newDriverModal.isOpen}
          onClose={() => setNewDriverModal(null)}
          title="👨‍✈️ Pendaftaran Supir Baru"
        >
          <form onSubmit={handleSaveNewDriver} className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-800">
                Supir baru akan disimpan ke database dan langsung ditugaskan ke rute ini.
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
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor Polisi (Plat Mobil)
              </label>
              <LicensePlateInput
                value={newDriverPlate}
                onChange={setNewDriverPlate}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Jenis Kendaraan
              </label>
              <select
                value={newDriverVehicle}
                onChange={(e) => setNewDriverVehicle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold cursor-pointer"
              >
                {DRIVER_VEHICLE_MODELS.map((model) => (
                  <option key={model} value={model}>
                    🚗 {model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Kategori Supir / Driver
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDriverType('vendor')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${newDriverType === 'vendor'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  💳 Supir Sewa Vendor
                  <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                    Masuk ke tagihan invoice vendor
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewDriverType('internal')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${newDriverType === 'internal'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  🏢 Supir Internal PT
                  <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                    Armada / supir internal (Rp 0)
                  </span>
                </button>
              </div>
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
                <span>Simpan & Tugaskan</span>
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Existing Driver & Vehicle Modal */}
      {editingDriver && (
        <Dialog
          isOpen={true}
          onClose={() => setEditingDriver(null)}
          title={`Edit Data Supir & Kendaraan — ${editingDriver.name}`}
        >
          <form onSubmit={handleSaveEditDriver} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nama Supir <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editDriverName}
                onChange={(e) => setEditDriverName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor WhatsApp / HP <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={editDriverPhone}
                onChange={(e) => setEditDriverPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor Polisi (Plat Mobil)
              </label>
              <LicensePlateInput
                value={editDriverPlate}
                onChange={setEditDriverPlate}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Jenis Kendaraan
              </label>
              <select
                value={editDriverVehicle}
                onChange={(e) => setEditDriverVehicle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold cursor-pointer"
              >
                {DRIVER_VEHICLE_MODELS.map((model) => (
                  <option key={model} value={model}>
                    🚗 {model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Kategori Supir / Driver
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditDriverType('vendor')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    editDriverType === 'vendor'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  💳 Supir Sewa Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setEditDriverType('internal')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    editDriverType === 'internal'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  🏢 Supir Internal PT
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setEditingDriver(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingEditDriver}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {isSavingEditDriver ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

