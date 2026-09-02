// ============================================================
// Shuttle Booking — Auth Context
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '../lib/types';

interface AuthContextType {
  employee: Employee | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (nik: string) => Promise<{ success: boolean; employee?: Employee; error?: string }>;
  logout: () => void;
  updateEmployeeState: (updated: Partial<Employee>) => void;
  refreshEmployee: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'shuttle_booking_employee';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount and validate against DB
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Employee;
        // Immediately set from cache (fast UX) then validate in background
        setEmployee(parsed);
        setIsLoading(false);

        // Background validation: verify employee still exists in DB
        supabase
          .from('employees')
          .select('*')
          .eq('id', parsed.id)
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              // Employee no longer valid in DB — clear session
              setEmployee(null);
              localStorage.removeItem(STORAGE_KEY);
            } else {
              // Refresh employee data from DB in case profile was updated
              const freshEmp = data as Employee;
              setEmployee(freshEmp);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(freshEmp));

              // Automatically ensure push subscription exists in DB
              import('../lib/notificationService').then(({ subscribeToPush }) => {
                subscribeToPush(freshEmp.id).catch(console.warn);
              });
            }
          });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (nik: string): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('nik', nik.trim())
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'NIK tidak ditemukan. Silakan hubungi Admin.',
        };
      }

      const emp = data as Employee;
      setEmployee(emp);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emp));

      // Automatically register device to push_subscriptions
      import('../lib/notificationService').then(({ subscribeToPush }) => {
        subscribeToPush(emp.id).catch(console.warn);
      });

      return { success: true, employee: emp };
    } catch {
      return {
        success: false,
        error: 'Terjadi kesalahan. Silakan coba lagi.',
      };
    }
  }, []);

  const logout = useCallback(() => {
    setEmployee(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateEmployeeState = useCallback((updated: Partial<Employee>) => {
    setEmployee((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshEmployee = useCallback(async () => {
    if (!employee?.id) return;
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employee.id)
        .single();
      if (!error && data) {
        const fresh = data as Employee;
        setEmployee(fresh);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      }
    } catch (e) {
      console.warn('Failed to refresh employee:', e);
    }
  }, [employee?.id]);

  return (
    <AuthContext.Provider
      value={{
        employee,
        isLoading,
        isAuthenticated: !!employee,
        login,
        logout,
        updateEmployeeState,
        refreshEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
