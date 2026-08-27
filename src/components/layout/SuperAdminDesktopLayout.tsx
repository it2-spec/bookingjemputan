import { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../shared/LoadingScreen';
import tracerLogo from '../../assets/tracer.png';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Navigation,
  LogOut,
  ChevronRight,
  Bell,
  Search,
  SlidersHorizontal,
  FileText,
  Smartphone,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const superAdminNav = [
  { path: '/superadmin', label: 'Dashboard & Monitor', icon: LayoutDashboard, exact: true },
  { path: '/superadmin/approvals', label: 'Approval Rute Penumpang', icon: CheckSquare, badge: 'New' },
  { path: '/superadmin/drivers', label: 'Live Location Driver', icon: Navigation },
  { path: '/superadmin/passengers', label: 'Daftar Karyawan / Driver', icon: Users },
  { path: '/superadmin/devices', label: 'Perangkat Terdaftar (Push)', icon: Smartphone },
  { path: '/superadmin/invoice', label: 'Rekap Invoice Armada', icon: FileText },
];

export function SuperAdminDesktopLayout() {
  const { employee, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading) return <LoadingScreen />;

  if (!employee || employee.role !== 'superadmin') {
    // If regular admin logs in, navigate to /admin. If employee/driver, go to /
    if (employee?.role === 'admin') return <Navigate to="/admin" replace />;
    if (employee?.role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex overflow-hidden font-sans">
      {/* Sidebar Navigation Webview Desktop */}
      <aside
        className={cn(
          'bg-white text-slate-900 border-r border-slate-200 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 shadow-md',
          collapsed ? 'w-20' : 'w-72'
        )}
      >
        <div>
          {/* Logo Header */}
          <div className="h-16 border-b border-slate-200 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 border border-slate-200 shadow-sm shrink-0">
                <img src={tracerLogo} alt="TRACER Logo" className="w-full h-full object-contain rounded-lg" />
              </div>
              {!collapsed && (
                <div>
                  <h1 className="text-sm font-bold text-slate-900 tracking-wide font-[family-name:var(--font-display)]">
                    TEAM TRACER
                  </h1>
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                    Superadmin Workspace
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="p-3 space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Navigasi Utama
              </p>
            )}

            {superAdminNav.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group relative',
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-blue-600'
                  )}
                >
                  <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-600')} />
                  {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700 font-bold border border-blue-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-200 space-y-2">
          {!collapsed ? (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  SA
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{employee.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Superadmin System</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="w-full py-3 flex justify-center text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Desktop Webview Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Topbar Header */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari karyawan, driver, atau rute..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 relative cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button
              onClick={() => navigate('/')}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              Mode Penumpang <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
