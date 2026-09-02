// ============================================================
// Main Application Router Setup
// ============================================================

import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { useBookingReminder } from './hooks/useBookingReminder';

import { SuperAdminDesktopLayout } from './components/layout/SuperAdminDesktopLayout';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import RoutesPage from './pages/RoutesPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPassengerList from './pages/admin/AdminPassengerList';
import AdminRouteApprovalList from './pages/admin/AdminRouteApprovalList';
import AdminPushDevicesPage from './pages/admin/AdminPushDevicesPage';
import { DriverDashboard } from './pages/driver/DriverDashboard';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminPassengers from './pages/superadmin/SuperAdminPassengers';
import SuperAdminInvoice from './pages/superadmin/SuperAdminInvoice';
import { VendorLayout } from './components/layout/VendorLayout';
import VendorApprovalPage from './pages/vendor/VendorApprovalPage';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'booking', element: <BookingPage /> },
      { path: 'routes', element: <RoutesPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '/driver',
    element: <DriverDashboard />,
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'passengers', element: <AdminPassengerList /> },
      { path: 'approvals', element: <AdminRouteApprovalList /> },
      { path: 'devices', element: <AdminPushDevicesPage /> },
    ],
  },
  {
    path: '/superadmin',
    element: <SuperAdminDesktopLayout />,
    children: [
      { index: true, element: <SuperAdminDashboard /> },
      { path: 'approvals', element: <AdminRouteApprovalList /> },
      { path: 'drivers', element: <DriverDashboard /> },
      { path: 'passengers', element: <SuperAdminPassengers /> },
      { path: 'devices', element: <AdminPushDevicesPage /> },
      { path: 'invoice', element: <SuperAdminInvoice /> },
    ],
  },
  {
    path: '/vendor',
    element: <VendorLayout />,
    children: [
      { index: true, element: <VendorApprovalPage /> },
    ],
  },
]);

// Activates reminder hook and prompts for notification permission on initial app launch
function ReminderProvider() {
  useBookingReminder();

  useEffect(() => {
    // Check if permission already asked before
    const hasPrompted = localStorage.getItem('initial_notification_prompted');
    if (!hasPrompted) {
      localStorage.setItem('initial_notification_prompted', 'true');
      import('./lib/notificationService').then(({ requestNotificationPermission }) => {
        // Small delay so UI renders smoothly first
        setTimeout(() => {
          requestNotificationPermission().catch(console.warn);
        }, 1000);
      });
    }
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReminderProvider />
        <RouterProvider router={router} />
        <Toaster position="top-center" reverseOrder={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
