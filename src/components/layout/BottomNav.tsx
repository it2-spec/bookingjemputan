// ============================================================
// Bottom Navigation Component
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, Ticket, Clock, User } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/booking', label: 'Booking', icon: Ticket },
  { path: '/history', label: 'Riwayat', icon: Clock },
  { path: '/profile', label: 'Profil', icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide bottom nav on admin pages
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-surface-200/50 dark:border-surface-700/50 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 px-3 min-w-[64px] touch-target transition-colors duration-200 cursor-pointer',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300'
              )}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-0.5 font-medium',
                  isActive && 'font-semibold'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
