// ============================================================
// Profile Page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  User,
  CreditCard,
  Building2,
  Phone,
  LogOut,
  Moon,
  Sun,
  Info,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_VERSION } from '../lib/constants';
import { getInitials } from '../lib/utils';

export default function ProfilePage() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };

  if (!employee) return null;

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
          Profil
        </h1>
      </motion.div>

      {/* Avatar & Name */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center py-4"
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow mb-3">
          <span className="text-2xl font-bold text-white">
            {getInitials(employee.name)}
          </span>
        </div>
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 font-[family-name:var(--font-display)]">
          {employee.name}
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {employee.department}
        </p>
      </motion.div>

      {/* Profile info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <div className="space-y-4">
            <ProfileField
              icon={<User className="w-4 h-4" />}
              label="Nama Lengkap"
              value={employee.name}
              locked
            />
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<CreditCard className="w-4 h-4" />}
              label="NIK"
              value={employee.nik}
              locked
            />
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<Building2 className="w-4 h-4" />}
              label="Departemen"
              value={employee.department}
              locked
            />
            <div className="border-b border-surface-100 dark:border-surface-800" />
            <ProfileField
              icon={<Phone className="w-4 h-4" />}
              label="No. Telepon"
              value={employee.phone || '-'}
            />
          </div>
        </Card>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
          Pengaturan
        </h3>

        <Card animate={false} className="space-y-3">
          {employee.role === 'admin' && (
            <>
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center justify-between w-full cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      Panel Admin
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">
                      Buka Dashboard Operasional
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-surface-400" />
              </button>
              <div className="border-b border-surface-100 dark:border-surface-800" />
            </>
          )}
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-between w-full cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                {isDark ? (
                  <Moon className="w-4 h-4 text-primary-500" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                  Mode Gelap
                </p>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {isDark ? 'Aktif' : 'Nonaktif'}
                </p>
              </div>
            </div>
            <div
              className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                isDark ? 'bg-primary-600' : 'bg-surface-300'
              } relative`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  isDark ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </Card>
      </motion.div>

      {/* App info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card animate={false} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Info className="w-4 h-4 text-surface-400" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
              {APP_NAME}
            </p>
          </div>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            Versi {APP_VERSION}
          </p>
        </Card>
      </motion.div>

      {/* Logout button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          variant="danger"
          fullWidth
          size="lg"
          icon={<LogOut className="w-5 h-5" />}
          onClick={() => setShowLogoutDialog(true)}
        >
          Keluar
        </Button>
      </motion.div>

      {/* Logout confirmation */}
      <Dialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        title="Keluar"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Apakah Anda yakin ingin keluar dari aplikasi?
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowLogoutDialog(false)}
            >
              Batal
            </Button>
            <Button variant="danger" fullWidth onClick={handleLogout}>
              Ya, Keluar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
  locked = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary-500 dark:text-primary-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
          {value}
        </p>
      </div>
      {locked && (
        <span className="text-[9px] text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
          🔒
        </span>
      )}
    </div>
  );
}
