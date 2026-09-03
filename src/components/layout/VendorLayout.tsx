// ============================================================
// Vendor Layout — Layout simpel untuk halaman approval vendor
// ============================================================

import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../shared/LoadingScreen';
import tracerLogo from '../../assets/tracer.png';
import { LogOut, CheckSquare, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function VendorLayout() {
  const { employee, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!employee || employee.role !== 'vendor') return;

    // 1. Automatically register push notification subscription for vendor
    import('../../lib/notificationService').then(({ requestNotificationPermission, subscribeToPush }) => {
      requestNotificationPermission()
        .then(() => subscribeToPush(employee.id))
        .catch(console.warn);
    });

    // 2. Listen to Realtime vendor-notifications channel
    const channel = supabase.channel('vendor-notifications');
    channel
      .on('broadcast', { event: 'new-notification' }, (payload: any) => {
        const title = payload.payload?.title || '📋 Konfirmasi Jemputan Besok';
        const msg = payload.payload?.message || 'Pemesanan jemputan untuk besok, silahkan untuk dikonfirmasi';
        
        toast(() => (
          <div className="flex items-start gap-2.5 py-1">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="space-y-0.5">
              <p className="font-bold text-xs text-slate-900">{title}</p>
              <p className="text-xs text-slate-600">{msg}</p>
            </div>
          </div>
        ), {
          duration: 10000,
          style: {
            border: '2px solid #3b82f6',
            borderRadius: '16px',
            padding: '12px 16px',
          },
        });

        // Native browser desktop notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body: msg,
            icon: tracerLogo,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee]);


  if (isLoading) return <LoadingScreen />;

  if (!employee || employee.role !== 'vendor') {
    if (employee?.role === 'superadmin') return <Navigate to="/superadmin" replace />;
    if (employee?.role === 'admin') return <Navigate to="/admin" replace />;
    if (employee?.role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1 border border-slate-200 shadow-xs shrink-0">
              <img src={tracerLogo} alt="TRACER Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 font-[family-name:var(--font-display)] tracking-wide">
                  Portal Vendor
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                {employee.name}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </header>

      {/* Page Title Bar */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            <h1 className="text-sm font-bold tracking-wide">Persetujuan Order Harian</h1>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Setujui atau tolak order armada shuttle setiap hari sebelum masuk tagihan invoice
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
