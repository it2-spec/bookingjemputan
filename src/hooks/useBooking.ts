// ============================================================
// Shuttle Booking — Booking Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Booking, BookingFormData, VehicleType } from '../lib/types';
import { getVehicleType } from '../lib/vehicleLogic';

/**
 * Fetch all confirmed bookings for a given route and date.
 */
export function useRouteBookings(routeId: string | null, departureDate: string) {
  return useQuery({
    queryKey: ['bookings', routeId, departureDate],
    queryFn: async () => {
      if (!routeId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('*, employee:employees(*)')
        .eq('route_id', routeId)
        .eq('departure_date', departureDate)
        .eq('status', 'confirmed')
        .order('seat_number', { ascending: true });

      if (error) throw error;
      return (data || []) as Booking[];
    },
    enabled: !!routeId,
    refetchInterval: 10000, // Poll every 10 seconds as backup
  });
}

/**
 * Fetch the active (confirmed) booking for an employee on a given date.
 */
export function useActiveBooking(employeeId: string | null, departureDate: string) {
  return useQuery({
    queryKey: ['activeBooking', employeeId, departureDate],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from('bookings')
        .select('*, route:routes(*)')
        .eq('employee_id', employeeId)
        .eq('departure_date', departureDate)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (error) throw error;
      return data as Booking | null;
    },
    enabled: !!employeeId,
  });
}

/**
 * Fetch all bookings for an employee (history).
 */
export function useBookingHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ['bookingHistory', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('*, route:routes(*)')
        .eq('employee_id', employeeId)
        .order('departure_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Booking[];
    },
    enabled: !!employeeId,
  });
}

/**
 * Create a new booking.
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: BookingFormData) => {
      // First, get the current confirmed count to determine vehicle type
      const { data: existingBookings, error: countError } = await supabase
        .from('bookings')
        .select('id')
        .eq('route_id', formData.routeId)
        .eq('departure_date', formData.departureDate)
        .eq('status', 'confirmed');

      if (countError) throw countError;

      const confirmedCount = (existingBookings?.length || 0) + 1;
      const vehicleType: VehicleType = getVehicleType(confirmedCount);

      // Check capacity
      if (confirmedCount > 16) {
        throw new Error('Kapasitas penuh. Tidak dapat memesan kursi.');
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          employee_id: formData.routeId ? undefined : undefined, // handled below
          ...formData,
          route_id: formData.routeId,
          vehicle_type: vehicleType,
          status: 'confirmed',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          if (error.message.includes('idx_one_booking_per_day')) {
            throw new Error('Anda sudah memiliki booking untuk hari ini.');
          }
          if (error.message.includes('idx_unique_seat_per_route_day')) {
            throw new Error('Kursi sudah dipesan oleh penumpang lain.');
          }
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activeBooking'] });
      queryClient.invalidateQueries({ queryKey: ['bookingHistory'] });
    },
  });
}

/**
 * Cancel an existing booking.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('status', 'confirmed')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activeBooking'] });
      queryClient.invalidateQueries({ queryKey: ['bookingHistory'] });
    },
  });
}

/**
 * Fetch all bookings for admin (with employee and route details).
 */
export function useAdminBookings(departureDate: string) {
  return useQuery({
    queryKey: ['adminBookings', departureDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, employee:employees(*), route:routes(*)')
        .eq('departure_date', departureDate)
        .order('route_id')
        .order('seat_number', { ascending: true });

      if (error) throw error;
      return (data || []) as Booking[];
    },
  });
}
