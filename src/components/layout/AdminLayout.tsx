// ============================================================
// Admin Layout Component
// ============================================================

import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../shared/LoadingScreen';
import { LayoutDashboard, Users, Shield, ArrowLeft, Smartphone } from 'lucide-react';
import tracerLogo from '../../assets/tracer.png';
import { cn } from '../../lib/utils';

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/passengers', label: 'Penumpang', icon: Users, exact: false },
  { path: '/admin/approvals', label: 'Approval Rute', icon: Shield, exact: false },
  { path: '/admin/devices', label: 'Perangkat Terdaftar', icon: Smartphone, exact: false },
];

export function AdminLayout() {
  const { employee, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!employee || (employee.role !== 'admin' && employee.role !== 'superadmin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 safe-top">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors touch-target cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center p-0.5">
              <img src={tracerLogo} alt="TRACER" className="w-full h-full object-contain rounded" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 font-[family-name:var(--font-display)]">
                Admin Panel
              </h1>
              <p className="text-[10px] text-slate-600 font-medium">TEAM TRACER</p>
            </div>
          </div>
        </div>

        {/* Admin nav tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-2">
          {adminNavItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
