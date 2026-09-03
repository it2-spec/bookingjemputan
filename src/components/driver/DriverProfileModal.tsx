import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { LicensePlateInput } from '../ui/LicensePlateInput';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Car,
  Phone,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Bell,
  MapPin,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { requestNotificationPermission } from '../../lib/notificationService';

export const DRIVER_VEHICLE_MODELS = [
  'Toyota Avanza',
  'Daihatsu Xenia',
  'Mitsubishi X-Pander',
  'Toyota Fortuner',
  'Honda HR-V',
  'Isuzu Elf Long',
  'Isuzu Elf Short',
] as const;

export function formatLicensePlate(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let p1 = '', p2 = '', p3 = '';
  let i = 0;
  // Prefix: 1-2 letters (e.g. B, T, D, AB)
  while (i < cleaned.length && /[A-Z]/.test(cleaned[i]) && p1.length < 2) {
    p1 += cleaned[i++];
  }
  // Middle: 1-4 digits (e.g. 1234)
  while (i < cleaned.length && /[0-9]/.test(cleaned[i]) && p2.length < 4) {
    p2 += cleaned[i++];
  }
  // Suffix: 1-3 letters (e.g. ABC)
  while (i < cleaned.length && /[A-Z]/.test(cleaned[i]) && p3.length < 3) {
    p3 += cleaned[i++];
  }
  return [p1, p2, p3].filter(Boolean).join(' ');
}

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export function DriverProfileModal({
  isOpen,
  onClose,
  isMandatory = false,
}: DriverProfileModalProps) {
  const { employee, updateEmployeeState } = useAuth();

  const [phone, setPhone] = useState(employee?.phone || '');
  const [licensePlate, setLicensePlate] = useState(employee?.license_plate || '');
  const [vehicleModel, setVehicleModel] = useState(employee?.vehicle_model || DRIVER_VEHICLE_MODELS[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Permission states
  const [notifGranted, setNotifGranted] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [geoGranted, setGeoGranted] = useState(false);
  const [isRequestingPerms, setIsRequestingPerms] = useState(false);

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone || '');
      setLicensePlate(employee.license_plate || '');
      if (employee.vehicle_model) {
        setVehicleModel(employee.vehicle_model);
      }
    }
  }, [employee]);

  // Check initial permissions
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifGranted(Notification.permission === 'granted');
    }
    if ('permissions' in navigator && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
        setGeoGranted(result.state === 'granted');
        result.onchange = () => setGeoGranted(result.state === 'granted');
      }).catch(() => {});
    }
  }, []);

  const handleRequestPermissions = async () => {
    setIsRequestingPerms(true);
    try {
      // 1. Request Notification
      const perm = await requestNotificationPermission();
      setNotifGranted(perm === 'granted');

      // 2. Request Geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setGeoGranted(true);
            toast.success('Izin lokasi & notifikasi berhasil diaktifkan! ✅');
          },
          (err) => {
            console.warn('Geolocation denied:', err);
            toast.error('Izin lokasi ditolak: ' + err.message);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch (err: any) {
      toast.error('Gagal meminta izin: ' + err.message);
    } finally {
      setIsRequestingPerms(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Nomor WhatsApp wajib diisi');
      return;
    }
    if (!licensePlate.trim()) {
      toast.error('Nomor Polisi wajib diisi (Contoh: B 1234 ABC)');
      return;
    }
    if (!vehicleModel) {
      toast.error('Pilih jenis kendaraan Anda');
      return;
    }

    if (!employee) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          phone: phone.trim(),
          license_plate: licensePlate.trim(),
          vehicle_model: vehicleModel,
        })
        .eq('id', employee.id);

      if (error) throw error;

      updateEmployeeState({
        phone: phone.trim(),
        license_plate: licensePlate.trim(),
        vehicle_model: vehicleModel,
      });

      toast.success('Data profil driver dan kendaraan berhasil disimpan! 🎉');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data driver');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isMandatory ? () => {} : onClose}
      title="Data Diri Driver & Kendaraan"
      showCloseButton={!isMandatory}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {isMandatory && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Lengkapi Data Kendaraan & Izin Aplikasi</p>
              <p className="text-amber-700 mt-0.5">
                Sebelum memulai tugas operasional jemputan, mohon lengkapi No WhatsApp, No Polisi, dan jenis kendaraan yang Anda bawa.
              </p>
            </div>
          </div>
        )}

        {/* Permissions Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <span className="text-xs font-bold text-slate-800 block">
            Status Izin Akses Perangkat
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                notifGranted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Bell className="w-3.5 h-3.5" /> Notifikasi
              </span>
              {notifGranted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-[10px] text-amber-600 font-bold">Belum</span>
              )}
            </div>

            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                geoGranted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-3.5 h-3.5" /> Lokasi GPS
              </span>
              {geoGranted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-[10px] text-amber-600 font-bold">Belum</span>
              )}
            </div>
          </div>

          {(!notifGranted || !geoGranted) && (
            <button
              type="button"
              onClick={handleRequestPermissions}
              disabled={isRequestingPerms}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isRequestingPerms ? 'Memproses Izin...' : 'Aktifkan Izin Notifikasi & Lokasi'}
            </button>
          )}
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              Nomor WhatsApp / HP Aktif <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Digunakan oleh admin dan penumpang untuk koordinasi penjemputan.
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              Nomor Polisi (Plat Kendaraan) <span className="text-red-500">*</span>
            </label>
            <LicensePlateInput
              value={licensePlate}
              onChange={(val) => setLicensePlate(val)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Car className="w-3.5 h-3.5 text-blue-600" />
              Jenis Kendaraan <span className="text-red-500">*</span>
            </label>
            <select
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-bold cursor-pointer"
            >
              {DRIVER_VEHICLE_MODELS.map((model) => (
                <option key={model} value={model}>
                  🚗 {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-slate-100 flex gap-3">
          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Simpan Data Driver</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
