// ============================================================
// Shuttle Booking — TypeScript Type Definitions
// ============================================================

// ----- Enums -----

export type VehicleType = 'Avanza' | 'Elf Short' | 'Elf Long';

export type BookingStatus = 'confirmed' | 'cancelled' | 'closed';

export type UserRole = 'employee' | 'admin';

// ----- Database Row Types -----

export interface Employee {
  id: string;
  nik: string;
  name: string;
  department: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface Route {
  id: string;
  route_name: string;
  departure_time: string; // '07:30:00'
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

// ----- Route Schedule / Timeline Types -----

/**
 * Arah perjalanan shuttle.
 * - masuk:  pagi, dari area jemput menuju kantor (PT XYZ)
 * - pulang: sore, rute dibalik dari kantor (PT XYZ) menuju area jemput
 */
export type RouteDirection = 'masuk' | 'pulang';

/**
 * A single pickup stop within a route schedule.
 */
export interface RouteStop {
  name: string;
  /** Estimated arrival time at this stop, 24h format 'HH:MM' (WIB) */
  time: string;
}

/**
 * Full schedule for a route: an ordered list of stops from the
 * departure point (first) to the destination (last).
 */
export interface RouteSchedule {
  routeName: string;
  /** Emoji icon representing the route area */
  icon: string;
  /** Ordered stops. Index 0 = departure, last index = destination. */
  stops: RouteStop[];
}

/**
 * Live status of a stop relative to the current time.
 * - passed:   current time is after the stop's estimated time
 * - arriving: current time equals the stop's estimated time
 * - upcoming: the vehicle has not reached the stop yet
 */
export type StopLiveStatus = 'passed' | 'arriving' | 'upcoming';

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
