import { getVehicleType } from '../../lib/vehicleLogic';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Route, VehicleType } from '../../lib/types';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';
import {
  FileText,
  Download,
  Printer,
  Settings2,
  RefreshCw,
  CalendarRange,
  Bus,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Ban,
  Clock,
  XCircle,
} from 'lucide-react';


// ----- Types -----

interface RouteVehiclePrice {
  id?: string;
  route_id: string;
  vehicle_type: VehicleType;
  price_per_day: number;
}

interface InvoiceDailyOverride {
  id?: string;
  departure_date: string;
  route_id: string;
  is_billable: boolean;
  override_vehicle_type?: VehicleType | null;
  custom_price?: number | null;
  note?: string | null;
  vendor_approval_status?: 'pending' | 'approved' | 'rejected';
  vendor_approved_at?: string | null;
  vendor_approval_note?: string | null;
}


interface RouteRecap {
  routeId: string;
  routeName: string;
  vehicleType: VehicleType | string;
  passengerCount: number;
  price: number;
  subtotal: number;
  isBillable: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  note?: string;
}


interface DayRecap {
  date: string;
  routes: RouteRecap[];
  dayTotal: number;
}

// ----- Helpers -----

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateLocal(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

const VEHICLE_COLORS: Record<VehicleType, string> = {
  'Avanza': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Elf Short': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'Elf Long': 'bg-violet-100 text-violet-700 border border-violet-200',
};

const VEHICLE_TYPES: VehicleType[] = ['Avanza', 'Elf Short', 'Elf Long'];

export default function SuperAdminInvoice() {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const [rekapData, setRekapData] = useState<DayRecap[]>([]);
  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [prices, setPrices] = useState<RouteVehiclePrice[]>([]);
  const [overrides, setOverrides] = useState<InvoiceDailyOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // Price modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editPrices, setEditPrices] = useState<RouteVehiclePrice[]>([]);
  const [savingPrices, setSavingPrices] = useState(false);

  // Data Fetching
  const fetchRoutes = async () => {
    const { data } = await supabase
      .from('routes')
      .select('*')
      .order('route_name', { ascending: true });
    if (data) setRoutes(data as Route[]);
  };

  const fetchPrices = async () => {
    const { data } = await supabase.from('route_vehicle_prices').select('*');
    if (data) setPrices(data as RouteVehiclePrice[]);
  };

  const fetchOverrides = async () => {
    const { data } = await supabase.from('invoice_daily_overrides').select('*');
    if (data) setOverrides(data as InvoiceDailyOverride[]);
  };

  useEffect(() => {
    fetchRoutes();
    fetchPrices();
    fetchOverrides();
  }, []);

  const getPriceForRoute = (routeId: string, vehicleType: VehicleType | string): number => {
    const targetType = vehicleType.includes('Avanza') ? 'Avanza' : vehicleType.includes('Elf Short') ? 'Elf Short' : vehicleType.includes('Elf Long') ? 'Elf Long' : vehicleType;
    const found = prices.find(
      (p) => p.route_id === routeId && p.vehicle_type === targetType
    );
    return found?.price_per_day ?? 0;
  };

  // Main Calculation Logic
  const handleHitungRekap = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Pilih rentang tanggal terlebih dahulu');
      return;
    }
    if (dateFrom > dateTo) {
      toast.error('Tanggal mulai tidak boleh lebih besar dari tanggal akhir');
      return;
    }

    setLoading(true);
    setHasQueried(false);

    try {
      // 1. Fetch overrides & prices newest
      const [{ data: latestOverrides }, { data: latestPrices }] = await Promise.all([
        supabase.from('invoice_daily_overrides').select('*'),
        supabase.from('route_vehicle_prices').select('*'),
      ]);

      const activeOverrides: InvoiceDailyOverride[] = latestOverrides || overrides;
      const activePrices: RouteVehiclePrice[] = latestPrices || prices;

      if (latestOverrides) setOverrides(latestOverrides);
      if (latestPrices) setPrices(latestPrices);

      // 2. Query bookings (termasuk employee dan departure_time untuk export Excel)
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          departure_date,
          route_id,
          vehicle_type,
          status,
          pickup_point,
          employee:employees(id, name, department),
          route:routes(id, route_name, departure_time)
        `)
        .gte('departure_date', dateFrom)
        .lte('departure_date', dateTo)
        .eq('status', 'confirmed')
        .order('departure_date', { ascending: true });

      if (error) throw error;
      setRawBookings(bookings as any[] || []);

      if (!bookings || bookings.length === 0) {
        setRekapData([]);
        setHasQueried(true);
        toast('Tidak ada booking terkonfirmasi pada rentang tanggal ini', { icon: 'ℹ️' });
        return;
      }

      // Grouping
      const byDate: Record<
        string,
        Record<string, { routeName: string; vehicleTypes: string[]; count: number }>
      > = {};

      (bookings as any[]).forEach((b) => {
        const date: string = b.departure_date;
        const routeId: string = b.route_id;
        const routeName: string = b.route?.route_name ?? 'Unknown';

        if (!byDate[date]) byDate[date] = {};
        if (!byDate[date][routeId]) {
          byDate[date][routeId] = { routeName, vehicleTypes: [], count: 0 };
        }

        byDate[date][routeId].vehicleTypes.push(b.vehicle_type);
        byDate[date][routeId].count++;
      });

      // Build DayRecap[]
      const result: DayRecap[] = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, routeMap]) => {
          const routeRecaps: RouteRecap[] = Object.entries(routeMap).map(
            ([routeId, info]) => {
              const matchedOverride = activeOverrides.find(
                (o) => o.departure_date === date && o.route_id === routeId
              );

              // Check if there are multi-unit overrides (e.g. 1 unit vendor, 1 unit internal)
              const unitSources = (matchedOverride as any)?.unit_sources;
              const hasUnitSources = unitSources && typeof unitSources === 'object';
              const isUnit1Billable = hasUnitSources ? Boolean(unitSources['1']) : (matchedOverride ? matchedOverride.is_billable : true);
              const isUnit2Billable = hasUnitSources ? Boolean(unitSources['2']) : ((matchedOverride as any)?.is_billable_unit2 ?? true);

              const isBillable = matchedOverride ? (matchedOverride.is_billable || isUnit1Billable || isUnit2Billable) : true;

              // --- Vendor Approval Status ---
              // Default 'pending' jika belum ada override atau belum disetujui vendor
              const approvalStatus: 'pending' | 'approved' | 'rejected' =
                matchedOverride?.vendor_approval_status ?? 'pending';
              const isApproved = approvalStatus === 'approved';

              const matchedRoute = routes.find((r) => r.id === routeId);
              const fallbackVehicle =
                matchedRoute?.manual_vehicle_type && matchedRoute.manual_vehicle_type !== 'Auto'
                  ? matchedRoute.manual_vehicle_type
                  : getVehicleType(info.count);

              const vehicleType =
                matchedOverride?.override_vehicle_type || fallbackVehicle;


              let price = 0;
              // Hanya hitung harga jika billable DAN sudah disetujui vendor
              if (isBillable && isApproved) {
                // If 1 is vendor and 1 is internal for a 2-unit split, invoice price is 1x Avanza instead of Elf Short
                if (hasUnitSources && (isUnit1Billable !== isUnit2Billable)) {
                  const avanzaPrice = activePrices.find(
                    (p) => p.route_id === routeId && p.vehicle_type === 'Avanza'
                  )?.price_per_day ?? 0;
                  price = matchedOverride?.custom_price ?? avanzaPrice;
                } else if (!isUnit1Billable && !isUnit2Billable) {
                  price = 0;
                } else {
                  price =
                    matchedOverride?.custom_price ??
                    (activePrices.find(
                      (p) => p.route_id === routeId && p.vehicle_type === vehicleType
                    )?.price_per_day ?? 0);
                }
              }

              let note = matchedOverride?.vendor_approval_note || matchedOverride?.note || undefined;
              if (hasUnitSources && isUnit1Billable !== isUnit2Billable) {
                note = isUnit1Billable 
                  ? 'Unit 1: Vendor (Avanza) | Unit 2: Internal PT (Rp 0)' 
                  : 'Unit 1: Internal PT (Rp 0) | Unit 2: Vendor (Avanza)';
              }

              return {
                routeId,
                routeName: info.routeName,
                vehicleType: hasUnitSources && isUnit1Billable !== isUnit2Billable ? 'Avanza (1 Unit Vendor)' : vehicleType,
                passengerCount: info.count,
                price,
                subtotal: price, // Rp 0 jika tidak billable atau belum approved
                isBillable: isBillable && isApproved && price > 0,
                approvalStatus,
                note,
              };
            }
          );


          routeRecaps.sort((a, b) => a.routeName.localeCompare(b.routeName));
          const dayTotal = routeRecaps.reduce((sum, r) => sum + r.subtotal, 0);
          return { date, routes: routeRecaps, dayTotal };
        });

      setRekapData(result);
      setHasQueried(true);
      toast.success(
        `Rekap dimuat: ${result.length} hari aktif, ${bookings.length} penumpang total`
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat rekap');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Billable status for a date + route directly from table
  const handleToggleBillable = async (date: string, routeId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const payload = {
        departure_date: date,
        route_id: routeId,
        is_billable: newStatus,
        note: newStatus ? null : 'Mobil Internal / Driver Sendiri',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert(payload, { onConflict: 'departure_date,route_id' });

      if (error) throw error;

      toast.success(
        newStatus
          ? `Diubah ke: Masuk Invoice (Disewa)`
          : `Diubah ke: Driver Sendiri (Tidak Masuk Invoice)`
      );

      // Re-trigger calculation
      handleHitungRekap();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status penagihan');
    }
  };

  // Approve order vendor dari halaman rekap invoice (superadmin)
  const handleApproveOrder = async (date: string, routeId: string) => {
    try {
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: date,
          route_id: routeId,
          is_billable: true,
          vendor_approval_status: 'approved',
          vendor_approved_at: new Date().toISOString(),
          vendor_approval_note: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;
      toast.success('Order disetujui oleh vendor ✅');
      handleHitungRekap();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyetujui order');
    }
  };

  // Reject order vendor dari halaman rekap invoice (superadmin)
  const handleRejectOrder = async (date: string, routeId: string) => {
    try {
      const { error } = await supabase
        .from('invoice_daily_overrides')
        .upsert({
          departure_date: date,
          route_id: routeId,
          is_billable: false,
          vendor_approval_status: 'rejected',
          vendor_approved_at: new Date().toISOString(),
          vendor_approval_note: 'Ditolak dari halaman rekap invoice',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'departure_date,route_id' });

      if (error) throw error;
      toast.success('Order ditolak ❌');
      handleHitungRekap();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak order');
    }
  };

  const grandTotal = rekapData.reduce((sum, d) => sum + d.dayTotal, 0);
  const totalPassengers = rekapData.reduce(
    (sum, d) => sum + d.routes.reduce((rs, r) => rs + r.passengerCount, 0),
    0
  );
  const totalVendorTrips = rekapData.reduce(
    (sum, d) => sum + d.routes.filter((r) => r.approvalStatus === 'approved' && r.isBillable).length,
    0
  );
  const totalInternalTrips = rekapData.reduce(
    (sum, d) => sum + d.routes.filter((r) => !r.isBillable && r.approvalStatus !== 'pending').length,
    0
  );
  const totalPendingTrips = rekapData.reduce(
    (sum, d) => sum + d.routes.filter((r) => r.approvalStatus === 'pending').length,
    0
  );


  // Hari libur nasional Indonesia 2025-2026 (YYYY-MM-DD)
  const NATIONAL_HOLIDAYS = new Set([
    // 2025
    '2025-01-01','2025-01-27','2025-01-28','2025-01-29',
    '2025-01-30','2025-01-31','2025-03-28','2025-03-29',
    '2025-03-30','2025-03-31','2025-04-01','2025-04-02',
    '2025-04-18','2025-05-01','2025-05-12','2025-05-13',
    '2025-05-29','2025-06-01','2025-06-06','2025-06-09',
    '2025-08-17','2025-09-05','2025-10-02','2025-12-25',
    '2025-12-26',
    // 2026
    '2026-01-01', // Tahun Baru Masehi
    '2026-01-16', // Isra Mi'raj
    '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', // Tahun Baru Imlek & Cuti
    '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22', // Idul Fitri / Nyepi
    '2026-04-02', '2026-04-03', // Wafat Isa Almasih / Paskah
    '2026-05-01', // Hari Buruh
    '2026-05-14', // Kenaikan Isa Almasih
    '2026-05-19', // Hari Raya Waisak
    '2026-05-25', // Cuti Bersama
    '2026-06-01', // Hari Lahir Pancasila
    '2026-06-26', // Idul Adha
    '2026-07-16', // 1 Muharam
    '2026-08-17', // HUT Kemerdekaan RI
    '2026-08-25', // Maulid Nabi Muhammad SAW
    '2026-12-24', '2026-12-25', // Hari Raya Natal & Cuti
  ]);

  const isRedDay = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    return dow === 0 || dow === 6 || NATIONAL_HOLIDAYS.has(dateStr);
  };

  // Export Excel — 2 Sheet: Rekap Invoice + Rekap Per Rute (dengan styling, merge cell & number format)
  const handleExportExcel = async () => {
    if (rekapData.length === 0) {
      toast.error('Tidak ada data rekap untuk di-export');
      return;
    }

    const RETURN_TIME = '16:30';
    const COMPANY_NAME = 'PT. SAKAE RIKEN INDONESIA';

    // Border style tipis untuk seluruh sel tabel
    const THIN_BORDER: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    // ============================================================
    // SHEET 1: Rekap Invoice (1 baris per rute per tanggal)
    // ============================================================
    const headerRow = [
      'Tanggal',
      'Antar Masuk',
      'Antar Pulang',
      'Rit',
      'Rute',
      'Jenis Kendaraan',
      'Rute & Jenis Kendaraan',
      'Nama Karyawan',
      'Jumlah Karyawan',
      'Keterangan',
      'Harga',
    ];

    const dataRows: (string | number)[][] = [];

    rekapData.forEach((day) => {
      day.routes.forEach((route) => {
        // Format tanggal: dd/mm/yyyy
        const [y, m, d] = day.date.split('-');
        const tanggal = `${(d || '').padStart(2, '0')}/${(m || '').padStart(2, '0')}/${y}`;

        // Ambil nama semua penumpang rute ini pada tanggal ini, gabung dengan koma
        const passengerNames = rawBookings
          .filter((b) => b.departure_date === day.date && b.route_id === route.routeId)
          .map((b) => b.employee?.name?.trim())
          .filter(Boolean);

        const matchedRoute = routes.find((r) => r.id === route.routeId);
        const antarMasuk = matchedRoute?.departure_time ? matchedRoute.departure_time.slice(0, 5) : '06:00';
        const antarPulang = RETURN_TIME;
        const rit = 1;
        const rute = route.routeName;
        const jenisKendaraan = route.vehicleType;
        const ruteDanJenis = `${rute} - ${jenisKendaraan}`;
        const namaKaryawan = passengerNames.length > 0 ? passengerNames.join(', ') : '-';
        // Count berdasarkan delimiter koma
        const jumlahKaryawan = passengerNames.length;
        const keterangan = route.note ?? (route.approvalStatus === 'approved' && route.isBillable ? 'Sewa Vendor' : !route.isBillable ? 'Driver Sendiri (Rp 0)' : 'Menunggu Persetujuan');
        const harga = route.subtotal;

        dataRows.push([
          tanggal,
          antarMasuk,
          antarPulang,
          rit,
          rute,
          jenisKendaraan,
          ruteDanJenis,
          namaKaryawan,
          jumlahKaryawan,
          keterangan,
          harga,
        ]);
      });
    });

    // ============================================================
    // SHEET 2: Rekap Per Rute (ExcelJS — full cell styling & merge)
    // ============================================================

    // Semua kombinasi "Rute - Jenis Kendaraan" dari tabel prices
    const VEHICLE_ORDER: VehicleType[] = ['Avanza', 'Elf Short', 'Elf Long'];
    const ruteKombinasi: string[] = [];
    const hargaPerKombinasi: Record<string, number> = {};

    const sortedRoutes = [...routes].sort((a, b) => a.route_name.localeCompare(b.route_name));
    sortedRoutes.forEach((r) => {
      VEHICLE_ORDER.forEach((vt) => {
        const priceEntry = prices.find((p) => p.route_id === r.id && p.vehicle_type === vt);
        if (priceEntry) {
          const key = `${r.route_name} - ${vt}`;
          ruteKombinasi.push(key);
          hargaPerKombinasi[key] = priceEntry.price_per_day;
        }
      });
    });

    // Build lookup: date+routeKombinasi -> route recap
    const pivotLookup: Record<string, RouteRecap> = {};
    rekapData.forEach((day) => {
      day.routes.forEach((route) => {
        const key = `${day.date}__${route.routeName} - ${route.vehicleType}`;
        pivotLookup[key] = route;
      });
    });

    // Generate semua tanggal kalender dalam rentang dateFrom s/d dateTo
    const allCalendarDates: string[] = [];
    const cursor = new Date(dateFrom);
    const endDate = new Date(dateTo);
    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      const dd = String(cursor.getDate()).padStart(2, '0');
      allCalendarDates.push(`${y}-${mm}-${dd}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    // Total Rit per kombinasi
    const totalRitPerKombinasi: number[] = ruteKombinasi.map((k) =>
      allCalendarDates.reduce((sum, date) => sum + (pivotLookup[`${date}__${k}`] ? 1 : 0), 0)
    );

    // Total Rp per kombinasi
    const totalRpPerKombinasi: number[] = ruteKombinasi.map((k, i) =>
      totalRitPerKombinasi[i] * (hargaPerKombinasi[k] ?? 0)
    );
    const subTotal = totalRpPerKombinasi.reduce((s, v) => s + v, 0);

    const firstRoute = routes[0];
    const jamMasuk = firstRoute?.departure_time ? firstRoute.departure_time.slice(0, 5) : '07:30';
    const jamKerja = `${jamMasuk} - ${RETURN_TIME} (HARI KERJA)`;

    // --- ExcelJS workbook ---
    const wb2 = new ExcelJS.Workbook();

    // Format angka: 2 desimal, dan nilai 0 ditampilkan sebagai tanda strip (-)
    const NUMBER_FORMAT_DASH_ZERO = '#,##0.00;-#,##0.00;"-"';

    // ============================================================
    // BUILD SHEET 1 (Rekap Invoice)
    // ============================================================
    const ejSheet1 = wb2.addWorksheet('Rekap Invoice');
    ejSheet1.columns = [
      { width: 14 }, { width: 13 }, { width: 13 }, { width: 6 },
      { width: 22 }, { width: 18 }, { width: 30 }, { width: 50 },
      { width: 16 }, { width: 32 }, { width: 18 },
    ];

    ejSheet1.addRow([`Rekap Invoice Armada Shuttle — Periode: ${dateFrom} s/d ${dateTo}`]).font = { bold: true };
    ejSheet1.addRow([]); // baris kosong

    const s1Header = ejSheet1.addRow(headerRow);
    s1Header.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    dataRows.forEach((rowValues) => {
      const row = ejSheet1.addRow(rowValues);
      row.eachCell((cell, colNum) => {
        cell.border = THIN_BORDER;
        if (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 4 || colNum === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        // Format Harga kolom 11: 2 decimal, 0 -> (-)
        if (colNum === 11 && typeof cell.value === 'number') {
          cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    });

    // ============================================================
    // BUILD SHEET 2 (Rekap Per Rute)
    // ============================================================
    const ejSheet2 = wb2.addWorksheet('Rekap Per Rute');
    const totalCols = 1 + ruteKombinasi.length;
    const colWidths = [14, ...ruteKombinasi.map(() => 22)];
    ejSheet2.columns = colWidths.map((w) => ({ width: w }));

    // Red fill for holidays/weekends
    const RED_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF0000' },
    };
    const RED_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
    const BOLD_FONT: Partial<ExcelJS.Font> = { bold: true };

    // Header rows (baris 1-4)
    ejSheet2.addRow([COMPANY_NAME]).font = BOLD_FONT;
    ejSheet2.addRow([`REKAPAN PENGGUNAAN MOBIL KFH REGULER ${dateFrom} s/d ${dateTo} VIA NON TOLL`]);
    ejSheet2.addRow([jamKerja]);
    ejSheet2.addRow([]); // baris kosong

    // Sub-header Row 5: TANGGAL | RUTE
    const rh1 = ejSheet2.addRow(['TANGGAL', 'RUTE', ...Array(ruteKombinasi.length - 1).fill('')]);
    rh1.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });

    // Sub-header Row 6: kombinasi rute
    const rh2 = ejSheet2.addRow(['', ...ruteKombinasi]);
    rh2.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = BOLD_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
    });

    // Merge Header Cells
    ejSheet2.mergeCells(5, 1, 6, 1); // TANGGAL (A5:A6)
    if (totalCols >= 2) {
      ejSheet2.mergeCells(5, 2, 5, totalCols); // RUTE (B5:endCol5)
    }

    // Data rows: tanggal kalender
    allCalendarDates.forEach((date) => {
      const [y, m, d] = date.split('-');
      const tanggalFmt = `${(d || '').padStart(2, '0')}/${(m || '').padStart(2, '0')}/${y}`;
      const values: (string | number)[] = [tanggalFmt];
      ruteKombinasi.forEach((k) => {
        values.push(pivotLookup[`${date}__${k}`] ? 1 : 0);
      });
      const row = ejSheet2.addRow(values);
      const isRed = isRedDay(date);

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNum > 1 && typeof cell.value === 'number') {
          cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
        }
        if (isRed) {
          cell.fill = RED_FILL;
          cell.font = RED_FONT;
        }
      });
    });

    // Total Rit row
    const trRow = ejSheet2.addRow(['Total Rit', ...totalRitPerKombinasi]);
    trRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = BOLD_FONT;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (colNum > 1 && typeof cell.value === 'number') {
        cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
      }
    });

    // Harga Per Rit row
    const hprRow = ejSheet2.addRow(['Harga Per Rit', ...ruteKombinasi.map((k) => hargaPerKombinasi[k] ?? 0)]);
    hprRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = BOLD_FONT;
      cell.border = THIN_BORDER;
      if (colNum > 1 && typeof cell.value === 'number') {
        cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    // Total Rp row
    const tRpRow = ejSheet2.addRow(['Total Rp', ...totalRpPerKombinasi]);
    tRpRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = BOLD_FONT;
      cell.border = THIN_BORDER;
      if (colNum > 1 && typeof cell.value === 'number') {
        cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    // Sub Total row
    const subTotalRowNum = 6 + allCalendarDates.length + 4;
    const stRow = ejSheet2.addRow(['Sub Total', subTotal]);
    stRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = BOLD_FONT;
      cell.border = THIN_BORDER;
      if (colNum === 2 && typeof cell.value === 'number') {
        cell.numFmt = NUMBER_FORMAT_DASH_ZERO;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });


    // Merge Sub Total (B[row]:endCol[row])
    if (totalCols >= 2) {
      ejSheet2.mergeCells(subTotalRowNum, 2, subTotalRowNum, totalCols);
    }

    // Write to buffer and trigger download
    const buffer = await wb2.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Invoice_Armada_${dateFrom}_sd_${dateTo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File Excel berhasil didownload! 📄');
  };






  const handlePrint = () => {
    if (rekapData.length === 0) {
      toast.error('Tidak ada data rekap untuk dicetak');
      return;
    }
    window.print();
  };

  // Price Modal
  const openPriceModal = () => {
    const newEditPrices: RouteVehiclePrice[] = [];
    routes.forEach((route) => {
      VEHICLE_TYPES.forEach((vt) => {
        const existing = prices.find(
          (p) => p.route_id === route.id && p.vehicle_type === vt
        );
        newEditPrices.push({
          id: existing?.id,
          route_id: route.id,
          vehicle_type: vt,
          price_per_day: existing?.price_per_day ?? 0,
        });
      });
    });
    setEditPrices(newEditPrices);
    setShowPriceModal(true);
  };

  const updateEditPrice = (routeId: string, vehicleType: VehicleType, value: number) => {
    setEditPrices((prev) =>
      prev.map((ep) =>
        ep.route_id === routeId && ep.vehicle_type === vehicleType
          ? { ...ep, price_per_day: value }
          : ep
      )
    );
  };

  const handleSavePrices = async () => {
    setSavingPrices(true);
    try {
      const upsertData = editPrices.map((ep) => ({
        ...(ep.id ? { id: ep.id } : {}),
        route_id: ep.route_id,
        vehicle_type: ep.vehicle_type,
        price_per_day: ep.price_per_day,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('route_vehicle_prices')
        .upsert(upsertData, { onConflict: 'route_id,vehicle_type' });

      if (error) throw error;

      toast.success('Harga armada berhasil disimpan!');
      await fetchPrices();
      setShowPriceModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan harga');
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-[family-name:var(--font-display)] flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Rekap Invoice Armada
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Merekap armada sewa vendor vs armada internal per tanggal & rute untuk penagihan invoice
            </p>
          </div>

          <button
            onClick={openPriceModal}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Settings2 className="w-4 h-4 text-slate-500" />
            Pengaturan Harga Armada
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 no-print">
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-800">Rentang Tanggal Invoice</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleHitungRekap}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {loading ? 'Menghitung...' : 'Hitung Rekap'}
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-slate-500 self-center">Cepat:</span>
            {[
              { label: 'Bulan Ini', from: getFirstDayOfMonthStr(), to: getTodayStr() },
              {
                label: 'Bulan Lalu',
                from: (() => {
                  const d = new Date();
                  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-01`;
                })(),
                to: (() => {
                  const d = new Date();
                  d.setDate(0);
                  return d.toISOString().split('T')[0];
                })(),
              },
              {
                label: '7 Hari Terakhir',
                from: (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 6);
                  return d.toISOString().split('T')[0];
                })(),
                to: getTodayStr(),
              },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setDateFrom(preset.from);
                  setDateTo(preset.to);
                }}
                className="px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-full transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result Area */}
        {hasQueried && (
          <div id="invoice-print-area">
            {/* Print Header */}
            <div className="hidden print:block mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                PT. [Nama Perusahaan] — Rekap Invoice Armada Shuttle
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Periode: {formatDateLocal(dateFrom)} s/d {formatDateLocal(dateTo)}
              </p>
            </div>

            {rekapData.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada data booking terkonfirmasi
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Pada rentang {formatDateLocal(dateFrom)} — {formatDateLocal(dateTo)}
                </p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print mb-4">
                  <div className="bg-blue-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Hari Operasional</p>
                    <p className="text-xl font-bold mt-1 text-blue-600">{rekapData.length} <span className="text-xs text-slate-500 font-normal">hari</span></p>
                  </div>
                  <div className={`border rounded-2xl p-4 shadow-xs ${totalPendingTrips > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Menunggu Vendor
                    </p>
                    <p className={`text-xl font-bold mt-1 ${totalPendingTrips > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {totalPendingTrips} <span className="text-xs text-slate-500 font-normal">trip</span>
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Sewa Vendor (Approved)</p>
                    <p className="text-xl font-bold mt-1 text-emerald-600">{totalVendorTrips} <span className="text-xs text-slate-500 font-normal">trip</span></p>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Driver Sendiri (Rp 0)</p>
                    <p className="text-xl font-bold mt-1 text-slate-700">{totalInternalTrips} <span className="text-xs text-slate-500 font-normal">trip</span></p>
                  </div>
                  <div className="bg-violet-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Total Penumpang</p>
                    <p className="text-xl font-bold mt-1 text-violet-600">{totalPassengers} <span className="text-xs text-slate-500 font-normal">orang</span></p>
                  </div>
                  <div className="bg-amber-50 border border-slate-200 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-slate-500">Grand Total Tagihan</p>
                    <p className="text-xl font-bold mt-1 text-amber-600 font-mono">{formatRupiah(grandTotal)}</p>
                    {totalPendingTrips > 0 && (
                      <p className="text-[10px] text-amber-500 mt-0.5">({totalPendingTrips} trip belum disetujui)</p>
                    )}
                  </div>
                </div>


                {/* Table */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 no-print">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Bus className="w-5 h-5 text-blue-600" />
                        Rekap Armada per Hari
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Klik status pada kolom <strong>Status Tagihan</strong> untuk mengubah (Sewa Vendor vs Driver Sendiri/Internal)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Excel
                      </button>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[150px]">
                            Tanggal
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Rute
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Armada
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Penumpang
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider no-print">
                            Status Tagihan (Klik Utk Ubah)
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider no-print">
                            Status Vendor
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Harga/Hari
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekapData.map((day, dayIdx) => (
                          <>
                            {day.routes.map((route, routeIdx) => (
                              <tr
                                key={`${day.date}-${route.routeId}`}
                                className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                                  route.approvalStatus === 'pending'
                                    ? 'bg-amber-50/40'
                                    : route.approvalStatus === 'rejected'
                                    ? 'bg-red-50/30'
                                    : !route.isBillable
                                    ? 'bg-slate-50/80'
                                    : dayIdx % 2 === 0 ? '' : 'bg-slate-50/30'
                                }`}
                              >
                                <td className="px-5 py-3">
                                  {routeIdx === 0 ? (
                                    <div>
                                      <p className="text-xs font-bold text-slate-900">
                                        {formatDateLocal(day.date)}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        {day.date}
                                      </p>
                                    </div>
                                  ) : null}
                                </td>

                                <td className="px-4 py-3">
                                  <span className="font-semibold text-slate-800 text-sm">
                                    {route.routeName}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${VEHICLE_COLORS[route.vehicleType as VehicleType] || 'bg-blue-100 text-blue-800'
                                      }`}
                                  >
                                    {route.vehicleType}
                                  </span>
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <span className="text-sm font-semibold text-slate-700">
                                    {route.passengerCount}
                                    <span className="text-slate-400 font-normal text-xs ml-1">
                                      org
                                    </span>
                                  </span>
                                </td>

                                {/* Billable Toggle Column (Interactive in screen, badge in print) */}
                                <td className="px-4 py-3 no-print">
                                  <button
                                    onClick={() =>
                                      handleToggleBillable(day.date, route.routeId, route.isBillable)
                                    }
                                    title="Klik untuk mengubah status invoice"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${route.isBillable
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                                      }`}
                                  >
                                    {route.isBillable ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Sewa Vendor
                                      </>
                                    ) : (
                                      <>
                                        <Ban className="w-3.5 h-3.5 text-slate-500" /> Driver Sendiri (Rp 0)
                                      </>
                                    )}
                                  </button>
                                </td>

                                {/* Vendor Approval Status Column */}
                                <td className="px-4 py-3 no-print">
                                  <div className="flex flex-col gap-1.5">
                                    {route.approvalStatus === 'pending' && (
                                      <>
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                                          <Clock className="w-3 h-3" /> Menunggu
                                        </span>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleApproveOrder(day.date, route.routeId)}
                                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                          >
                                            <Check className="w-3 h-3" /> Setujui
                                          </button>
                                          <button
                                            onClick={() => handleRejectOrder(day.date, route.routeId)}
                                            className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                          >
                                            <Ban className="w-3 h-3" /> Tolak
                                          </button>
                                        </div>
                                      </>
                                    )}
                                    {route.approvalStatus === 'approved' && (
                                      <>
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                                          <CheckCircle2 className="w-3 h-3" /> Disetujui
                                        </span>
                                        <button
                                          onClick={() => handleRejectOrder(day.date, route.routeId)}
                                          className="text-[10px] text-slate-400 hover:text-red-500 underline underline-offset-1 cursor-pointer transition-colors text-left w-fit"
                                        >
                                          Batalkan
                                        </button>
                                      </>
                                    )}
                                    {route.approvalStatus === 'rejected' && (
                                      <>
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 w-fit">
                                          <XCircle className="w-3 h-3" /> Ditolak
                                        </span>
                                        <button
                                          onClick={() => handleApproveOrder(day.date, route.routeId)}
                                          className="text-[10px] text-slate-400 hover:text-emerald-600 underline underline-offset-1 cursor-pointer transition-colors text-left w-fit"
                                        >
                                          Setujui
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>


                                <td className="px-4 py-3 text-right">
                                  {!route.isBillable ? (
                                    <span className="text-xs text-slate-400 font-mono line-through">
                                      {formatRupiah(getPriceForRoute(route.routeId, route.vehicleType))}
                                    </span>
                                  ) : route.price === 0 ? (
                                    <span className="text-xs text-amber-600 font-semibold">
                                      Belum diset
                                    </span>
                                  ) : (
                                    <span className="text-sm text-slate-700 font-mono">
                                      {formatRupiah(route.price)}
                                    </span>
                                  )}
                                </td>

                                <td className="px-5 py-3 text-right">
                                  <span className={`text-sm font-bold font-mono ${route.isBillable ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {formatRupiah(route.subtotal)}
                                  </span>
                                </td>
                              </tr>
                            ))}

                            {/* Subtotal Row */}
                            <tr className="bg-slate-100/70 border-b-2 border-slate-200">
                              <td
                                colSpan={7}
                                className="px-5 py-2 text-right text-xs font-bold text-slate-600"
                              >
                                Subtotal {formatDateLocal(day.date)}
                              </td>
                              <td className="px-5 py-2 text-right text-xs font-bold text-slate-900 font-mono">
                                {formatRupiah(day.dayTotal)}
                              </td>
                            </tr>
                          </>
                        ))}
                      </tbody>

                      {/* Grand Total */}
                      <tfoot>
                        <tr className="bg-blue-600">
                          <td
                            colSpan={7}
                            className="px-5 py-4 text-right text-sm font-extrabold text-blue-100 uppercase tracking-wider"
                          >
                            Grand Total Invoice ({dateFrom} s/d {dateTo})
                          </td>
                          <td className="px-5 py-4 text-right text-base font-extrabold text-white font-mono">
                            {formatRupiah(grandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Trip bertanda <strong>Driver Sendiri (Rp 0)</strong> secara otomatis dikecualikan dari grand total tagihan invoice vendor.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Excel
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print / PDF
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!hasQueried && !loading && (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center no-print">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              Pilih rentang tanggal dan klik{' '}
              <span className="text-blue-600">"Hitung Rekap"</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Rekap armada dan total tagihan invoice akan muncul di sini
            </p>
          </div>
        )}
      </div>

      {/* Modal Price */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-600" />
                  Pengaturan Harga Armada per Rute
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Harga sewa vendor per hari/trip untuk setiap jenis armada pada rute tersebut
                </p>
              </div>
              <button
                onClick={() => setShowPriceModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {routes.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Memuat data rute...
                </div>
              ) : (
                routes.map((route) => (
                  <div
                    key={route.id}
                    className="border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-sm font-bold text-slate-900">
                        🚌 {route.route_name}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        ({route.departure_time} WIB)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-slate-200">
                      {VEHICLE_TYPES.map((vt) => {
                        const ep = editPrices.find(
                          (p) => p.route_id === route.id && p.vehicle_type === vt
                        );
                        return (
                          <div key={vt} className="p-4 space-y-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${VEHICLE_COLORS[vt]}`}
                            >
                              {vt}
                            </span>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">
                                Rp
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={10000}
                                value={ep?.price_per_day ?? 0}
                                onChange={(e) =>
                                  updateEditPrice(route.id, vt, parseInt(e.target.value) || 0)
                                }
                                className="w-full pl-8 pr-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                              />
                            </div>
                            {ep && ep.price_per_day > 0 && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                {formatRupiah(ep.price_per_day)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Harga ditetapkan <strong>per hari/trip</strong> untuk satu armada pada rute tersebut.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setShowPriceModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSavePrices}
                disabled={savingPrices}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingPrices ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {savingPrices ? 'Menyimpan...' : 'Simpan Semua Harga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
