// ============================================================
// Shuttle Booking — Realtime Bookings Hook
// ============================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Subscribes to real-time changes on the bookings table.
 * Automatically invalidates React Query cache when changes occur.
 */
export function useRealtimeBookings(routeId?: string | null, departureDate?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = routeId
      ? `bookings-${routeId}-${departureDate}`
      : 'bookings-all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          // Invalidate all booking-related queries on any change
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['activeBooking'] });
          queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, routeId, departureDate]);
}
