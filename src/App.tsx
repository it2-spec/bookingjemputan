// ============================================================
// Main Application Router Setup
// ============================================================

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
import { DriverDashboard } from './pages/driver/DriverDashboard';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';

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
    ],
  },
  {
    path: '/superadmin',
    element: <SuperAdminDesktopLayout />,
    children: [
      { index: true, element: <SuperAdminDashboard /> },
      { path: 'approvals', element: <AdminRouteApprovalList /> },
      { path: 'drivers', element: <DriverDashboard /> },
      { path: 'passengers', element: <AdminPassengerList /> },
    ],
  },
]);

// Activates reminder hook inside AuthProvider context
function ReminderProvider() {
  useBookingReminder();
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
