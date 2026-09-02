// ============================================================
// App Layout Component
// ============================================================

import { Outlet, Navigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../shared/LoadingScreen';
import { EmployeeOnboardingModal } from '../employee/EmployeeOnboardingModal';

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Onboarding Dialog if profile/pickup is incomplete */}
      <EmployeeOnboardingModal />

      {/* Main content area with bottom padding for nav */}
      <main className="pb-20 max-w-lg mx-auto">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}

