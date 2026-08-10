// ============================================================
// Shuttle Booking — TypeScript Type Definitions
// ============================================================

// ----- Enums -----

export type VehicleType = 'Avanza' | 'Elf Short' | 'Elf Long';

export type BookingStatus = 'confirmed' | 'cancelled' | 'closed';

export type UserRole = 'employee' | 'driver' | 'admin' | 'superadmin';

// ----- Database Row Types -----

export interface Employee {
  id: string;
  nik: string;
  name: string;
  department: string;
  phone: string | null;
  role: UserRole;
  assigned_route_id?: string | null;
  assigned_route_name?: string | null;
  route_change_status?: 'pending' | 'none';
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  driver_name?: string;
  route_id?: string | null;
  route_name?: string | null;
  latitude: number;
  longitude: number;
  status: 'active' | 'heading_to_pickup' | 'in_transit' | 'completed' | 'offline';
  speed?: number;
  updated_at: string;
}

export interface RouteChangeRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  nik?: string;
  department?: string;
  current_route_id: string | null;
  current_route_name?: string | null;
  requested_route_id: string;
  requested_route_name?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface Route {
  id: string;
  route_name: string;
  departure_time: string; // '05:30:00'
  created_at: string;
}

export interface Booking {
  id: string;
  employee_id: string;
  route_id: string;
  departure_date: string; // 'YYYY-MM-DD'
  seat_number: number;
  vehicle_type: VehicleType;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  vehicle_lock: boolean;
}

// ----- Joined / Enriched Types -----

export interface BookingWithDetails extends Booking {
  employee?: Employee;
  route?: Route;
}

export interface RouteWithBookings extends Route {
  bookings: Booking[];
  confirmedCount: number;
  vehicleType: VehicleType;
  remainingSeats: number;
  maxSeats: number;
}

// ----- UI State Types -----

export type SeatStatus = 'available' | 'booked' | 'selected' | 'disabled';

export interface SeatInfo {
  seatNumber: number;
  status: SeatStatus;
  bookedBy?: string; // employee name
}

// ----- Auth Types -----

export interface AuthState {
  employee: Employee | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ----- Form Types -----

export interface BookingFormData {
  routeId: string;
  departureDate: string;
  seatNumber: number;
  vehicleType: VehicleType;
}

// ----- API Response Types -----

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ----- Dashboard Stats -----

export interface DashboardStats {
  todayBookings: number;
  bookingsPerRoute: {
    routeName: string;
    count: number;
  }[];
  vehiclesUsed: {
    routeName: string;
    vehicleType: VehicleType;
    passengerCount: number;
  }[];
  remainingSeats: {
    routeName: string;
    remaining: number;
    total: number;
  }[];
}

// ----- Route Schedule & Timeline Types -----

export type RouteDirection = 'masuk' | 'pulang';

export type StopLiveStatus = 'passed' | 'next' | 'upcoming' | 'arriving';

export interface RouteStop {
  id?: string;
  name: string;
  time: string; // '05:30'
  estimatedTime?: string;
  address?: string;
  isPickupPoint?: boolean;
}

export interface RouteSchedule {
  routeName: string;
  icon?: string;
  description?: string;
  departureTime?: string;
  arrivalTime?: string;
  direction?: RouteDirection;
  stops: RouteStop[];
}
