// ============================================================
// Admin Layout Component
// ============================================================

import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../shared/LoadingScreen';
import { Shield, LayoutDashboard, Users, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/passengers', label: 'Penumpang', icon: Users, exact: false },
];

export function AdminLayout() {
  const { employee, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!employee || employee.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Admin header */}
      <header className="sticky top-0 z-40 glass border-b border-surface-200/50 dark:border-surface-700/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors touch-target cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
                Admin Panel
              </h1>
              <p className="text-[10px] text-surface-500">Shuttle Booking</p>
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
                    : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'
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
