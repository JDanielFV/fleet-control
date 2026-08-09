// --- Types ---

export interface Driver {
  id: string;
  /** Id del usuario dueño de este registro (multi-usuario) */
  owner_id?: string | null;
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  curp: string;
  dob: string | null;
  license_number: string;
  license_issue_date: string | null;
  license_expiration_date: string | null;
  license_is_permanent: boolean;
  ine_address: string;
  ine_sex: "M" | "F" | "X";
  ine_elector_key: string;
  ine_img?: string | null;
  license_img?: string | null;
  driver_photo_img?: string | null;
  address_proof_img?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  owner_id?: string | null;
  brand: string;
  vehicle_name: string;
  model: string;
  class_type: string;
  color?: string | null;
  circulation_expiration_date: string | null;
  circulation_img?: string | null;
  vin: string;
  plate_number: string;
  insurance_policy_img: string; // Base64 or URL (first page)
  insurance_policy_pages: string; // JSON array of all pages
  insurance_policy_number: string; // Número de póliza
  insurance_expiration_date: string | null;
  verification_expiration_date: string | null; // Fecha de verificación vehicular
  verification_img: string | null; // Foto de evidencia de verificación
  verification_completed: boolean; // Marca si ya se verificó
  status: "active" | "in_service"; // Estado del auto
  service_out_date: string | null; // Fecha de retiro a servicio
  service_return_date: string | null; // Fecha de regreso de servicio
  active_driver_id: string | null;
  rent_cost: number;
  next_service_mileage?: number | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  owner_id?: string | null;
  vehicle_id: string;
  driver_id: string;
  action_type: "ASSIGN" | "RELEASE";
  reason: string;
  created_at: string;
}

export interface Checklist {
  id: string;
  owner_id?: string | null;
  vehicle_id: string;
  driver_id: string;
  type: "DELIVERY" | "WEEKLY_START";
  mileage: number;
  gasoline_level: string; // "1/8", "2/8", ..., "8/8"
  checklist_items: {
    lights: boolean;
    brakes: boolean;
    tires: boolean;
    bodywork: boolean;
    documents: boolean;
  };
  irregularities: string;
  created_at: string;
}

export interface Payment {
  amount: number;
  date: string;
}

export interface WeeklyRental {
  id: string;
  owner_id?: string | null;
  driver_id: string;
  week_start: string; // YYYY-MM-DD (typically a Monday)
  rent_amount: number;
  paid_amount: number;
  /**
   * If true, the rent was prorated for a partial first week
   * (driver assigned mid-week). Display a 'Proporcional · N días'
   * badge in the UI. Subsequent weeks are always full price.
   */
  is_prorated: boolean;
  /** Days worked in the prorated first week (only meaningful when is_prorated). */
  prorated_days?: number;
  /** Days the vehicle was in service / condoned (no rental charge) */
  condoned_days: number;
  /** Amount condoned (rent_amount / 7 * condoned_days) */
  condoned_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  payments_log: Payment[];
  created_at: string;
}

/**
 * Credit a driver has built up because a payment exceeded the total
 * pending debt. Applied to the next rental created for this driver.
 */
export interface DriverCredit {
  driver_id: string;
  amount: number;
  updated_at: string;
}

export interface User {
  id: string;
  display_name: string;
  email: string | null;
  password_hash?: string | null;
  role: "admin" | "owner";
  webauthn_credentials: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationToken {
  id: string;
  token: string;
  created_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Session {
  userId: string;
  email: string;
  displayName: string;
  role: "admin" | "owner";
  expiresAt: string; // ISO date of today 23:59
}

export interface Maintenance {
  id: string;
  owner_id?: string | null;
  vehicle_id: string;
  cost: number;
  description: string;
  maintenance_date: string;
  next_maintenance_date: string | null;
  created_at: string;
}

export interface RenewalLog {
  id: string;
  owner_id?: string | null;
  vehicle_id: string;
  type: "CIRCULACION" | "SEGURO";
  previous_expiration: string | null;
  new_expiration: string;
  created_at: string;
}

export interface Alert {
  id: string;
  type: "LICENSE" | "INSURANCE" | "VERIFICATION" | "MAINTENANCE";
  title: string;
  description: string;
  targetId: string; // vehicle_id or driver_id
  severity: "critical" | "warning" | "info";
  dueDate: string;
}

export interface VehicleInventory {
  id: string;
  owner_id?: string | null;
  vehicle_id: string;
  photos: { angle: string; url: string }[];
  items: { name: string; quantity: number }[];
  created_at: string;
  updated_at: string;
}

export interface VerificationSchedule {
  color: string;
  months: string;
  semester1: string; // e.g. "Febrero - Marzo"
  semester2: string; // e.g. "Agosto - Septiembre"
  lastDigits: number[];
}
