// --- Types ---

export interface Driver {
  id: string;
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
  driver_photo_img?: string | null;
  address_proof_img?: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  vehicle_name: string;
  model: string;
  class_type: string;
  color?: string | null;
  circulation_expiration_date: string | null;
  vin: string;
  plate_number: string;
  insurance_policy_img: string; // Base64 or URL
  insurance_expiration_date: string | null;
  active_driver_id: string | null;
  rent_cost: number;
  next_service_mileage?: number | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  action_type: "ASSIGN" | "RELEASE";
  reason: string;
  created_at: string;
}

export interface Checklist {
  id: string;
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
  driver_id: string;
  week_start: string; // YYYY-MM-DD (typically a Monday)
  rent_amount: number;
  paid_amount: number;
  accumulated_debt: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  payments_log: Payment[];
  created_at: string;
}

export interface Maintenance {
  id: string;
  vehicle_id: string;
  cost: number;
  description: string;
  maintenance_date: string;
  next_maintenance_date: string | null;
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

export interface VerificationSchedule {
  color: string;
  months: string;
  semester1: string; // e.g. "Febrero - Marzo"
  semester2: string; // e.g. "Agosto - Septiembre"
  lastDigits: number[];
}
