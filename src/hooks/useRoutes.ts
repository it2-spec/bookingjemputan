// ============================================================
// Shuttle Booking — Routes Hook
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Route } from '../lib/types';

/**
 * Fetch all available shuttle routes.
 */
export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('route_name', { ascending: true });

      if (error) throw error;
      return (data || []) as Route[];
    },
    staleTime: 1000 * 60 * 60, // Routes rarely change, cache for 1 hour
  });
}

/**
 * Fetch a single route by ID.
 */
export function useRoute(routeId: string | null) {
  return useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      if (!routeId) return null;
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      if (error) throw error;
      return data as Route;
    },
    enabled: !!routeId,
    staleTime: 1000 * 60 * 60,
  });
}
