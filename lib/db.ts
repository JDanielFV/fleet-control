import { createClient } from "@supabase/supabase-js";

// --- Types ---
export interface Driver {
  id: string;
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  curp: string;
  dob: string;
  license_number: string;
  license_issue_date: string;
  license_expiration_date: string;
  license_is_permanent: boolean;
  ine_address: string;
  ine_sex: "M" | "F" | "X";
  ine_elector_key: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  vehicle_name: string;
  model: string;
  class_type: string;
  circulation_expiration_date: string;
  vin: string;
  plate_number: string;
  insurance_policy_img: string; // Base64 or URL
  insurance_expiration_date: string;
  active_driver_id: string | null;
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
  next_maintenance_date: string;
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

// --- Seed Data ---
const seedDrivers: Driver[] = [
  {
    id: "d1",
    first_name: "Juan Carlos",
    paternal_last_name: "Pérez",
    maternal_last_name: "García",
    curp: "PEGC850615HDFRRN01",
    dob: "1985-06-15",
    license_number: "LIC-982736-A",
    license_issue_date: "2024-01-10",
    license_expiration_date: "2027-01-10",
    license_is_permanent: false,
    ine_address: "Av. Chapultepec 340, Roma Norte, CDMX",
    ine_sex: "M",
    ine_elector_key: "PRGRJC85061509M100",
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "d2",
    first_name: "María Elena",
    paternal_last_name: "López",
    maternal_last_name: "Sánchez",
    curp: "LOSM901123MDFLNN02",
    dob: "1990-11-23",
    license_number: "LIC-342890-B",
    license_issue_date: "2022-05-15",
    license_expiration_date: "",
    license_is_permanent: true,
    ine_address: "Calle 10 Num 45, Col. Centro, Guadalajara, Jal.",
    ine_sex: "F",
    ine_elector_key: "LPSMEM90112314F200",
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  }
];

const seedVehicles: Vehicle[] = [
  {
    id: "v1",
    brand: "Nissan",
    vehicle_name: "Versa",
    model: "2022",
    class_type: "Sedán - Tsuru Class",
    circulation_expiration_date: "2026-10-15",
    vin: "3N1CN81D7NL123456",
    plate_number: "982-WXY",
    insurance_policy_img: "",
    insurance_expiration_date: "2026-07-15", // Expiring soon
    active_driver_id: "d1",
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "v2",
    brand: "Chevrolet",
    vehicle_name: "Aveo",
    model: "2021",
    class_type: "Sedán - Económico",
    circulation_expiration_date: "2027-04-20",
    vin: "KL1TA54B9MC654321",
    plate_number: "145-ABC",
    insurance_policy_img: "",
    insurance_expiration_date: "2026-12-01",
    active_driver_id: null,
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
  }
];

const seedAssignments: Assignment[] = [
  {
    id: "a1",
    vehicle_id: "v1",
    driver_id: "d1",
    action_type: "ASSIGN",
    reason: "Inicio de contrato semanal estándar",
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  }
];

const seedChecklists: Checklist[] = [
  {
    id: "c1",
    vehicle_id: "v1",
    driver_id: "d1",
    type: "DELIVERY",
    mileage: 45200,
    gasoline_level: "6/8",
    checklist_items: {
      lights: true,
      brakes: true,
      tires: true,
      bodywork: false, // small scratch
      documents: true,
    },
    irregularities: "Raspón leve en fascia trasera derecha.",
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  }
];

const seedWeeklyRentals: WeeklyRental[] = [
  {
    id: "r1",
    driver_id: "d1",
    week_start: "2026-06-22",
    rent_amount: 2500,
    paid_amount: 1500,
    accumulated_debt: 1000,
    status: "PARTIAL",
    payments_log: [
      { amount: 1000, date: "2026-06-23" },
      { amount: 500, date: "2026-06-25" },
    ],
    created_at: "2026-06-22T08:00:00.000Z",
  },
  {
    id: "r2",
    driver_id: "d1",
    week_start: "2026-06-29",
    rent_amount: 2500,
    paid_amount: 0,
    accumulated_debt: 3500, // 2500 + 1000 from previous week
    status: "UNPAID",
    payments_log: [],
    created_at: "2026-06-29T08:00:00.000Z",
  }
];

const seedMaintenances: Maintenance[] = [
  {
    id: "m1",
    vehicle_id: "v1",
    cost: 1800,
    description: "Cambio de aceite, filtro y revisión de frenos de 40,000 km",
    maintenance_date: "2026-05-10",
    next_maintenance_date: "2026-08-10",
    created_at: "2026-05-10T12:00:00.000Z",
  }
];

// --- Supabase Connection & LocalStorage Database Handler ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to initialize local storage
function getLocalData<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  const stored = localStorage.getItem(`fleet_${key}`);
  if (!stored) {
    localStorage.setItem(`fleet_${key}`, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(stored);
}

function setLocalData<T>(key: string, data: T[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`fleet_${key}`, JSON.stringify(data));
  }
}

// Mexican Verification Rules Helper
// Returns the months and color based on the last numeric digit of the license plate
export interface VerificationSchedule {
  color: string;
  months: string;
  semester1: string; // e.g. "Febrero - Marzo"
  semester2: string; // e.g. "Agosto - Septiembre"
  lastDigits: number[];
}

export function getVerificationSchedule(plate: string): VerificationSchedule {
  // Extract last digit of plate number
  const match = plate.replace(/\D/g, "");
  const lastDigitStr = match ? match.slice(-1) : "5";
  const lastDigit = parseInt(lastDigitStr, 10);

  switch (lastDigit) {
    case 5:
    case 6:
      return {
        color: "Amarillo",
        months: "Feb-Mar / Ago-Sep",
        semester1: "Febrero - Marzo",
        semester2: "Agosto - Septiembre",
        lastDigits: [5, 6],
      };
    case 7:
    case 8:
      return {
        color: "Rosa",
        months: "Mar-Abr / Sep-Oct",
        semester1: "Marzo - Abril",
        semester2: "Septiembre - Octubre",
        lastDigits: [7, 8],
      };
    case 3:
    case 4:
      return {
        color: "Rojo",
        months: "Abr-May / Oct-Nov",
        semester1: "Abril - Mayo",
        semester2: "Octubre - Noviembre",
        lastDigits: [3, 4],
      };
    case 1:
    case 2:
      return {
        color: "Verde",
        months: "May-Jun / Nov-Dic",
        semester1: "Mayo - Junio",
        semester2: "Noviembre - Diciembre",
        lastDigits: [1, 2],
      };
    case 9:
    case 0:
    default:
      return {
        color: "Azul",
        months: "Jun-Jul / Dic-Ene",
        semester1: "Junio - Julio",
        semester2: "Diciembre - Enero",
        lastDigits: [9, 0],
      };
  }
}

// --- Live DB API Layer ---
export const db = {
  // --- Drivers ---
  async getDrivers(): Promise<Driver[]> {
    if (supabase) {
      const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("drivers", seedDrivers);
  },

  async saveDriver(driver: Omit<Driver, "id" | "created_at"> & { id?: string }): Promise<Driver> {
    const fullDriver: Driver = {
      id: driver.id || Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      ...driver,
    };
    if (supabase) {
      const { data, error } = await supabase.from("drivers").upsert(fullDriver).select().single();
      if (!error && data) return data;
    }
    const drivers = getLocalData("drivers", seedDrivers);
    const existingIndex = drivers.findIndex((d) => d.id === fullDriver.id);
    if (existingIndex >= 0) {
      drivers[existingIndex] = { ...drivers[existingIndex], ...driver };
    } else {
      drivers.unshift(fullDriver);
    }
    setLocalData("drivers", drivers);
    return fullDriver;
  },

  // --- Vehicles ---
  async getVehicles(): Promise<Vehicle[]> {
    if (supabase) {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("vehicles", seedVehicles);
  },

  async saveVehicle(vehicle: Omit<Vehicle, "id" | "created_at"> & { id?: string }): Promise<Vehicle> {
    const fullVehicle: Vehicle = {
      id: vehicle.id || Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      ...vehicle,
    };
    if (supabase) {
      const { data, error } = await supabase.from("vehicles").upsert(fullVehicle).select().single();
      if (!error && data) return data;
    }
    const vehicles = getLocalData("vehicles", seedVehicles);
    const existingIndex = vehicles.findIndex((v) => v.id === fullVehicle.id);
    if (existingIndex >= 0) {
      vehicles[existingIndex] = { ...vehicles[existingIndex], ...vehicle };
    } else {
      vehicles.unshift(fullVehicle);
    }
    setLocalData("vehicles", vehicles);
    return fullVehicle;
  },

  // --- Assignments ---
  async getAssignments(): Promise<Assignment[]> {
    if (supabase) {
      const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("assignments", seedAssignments);
  },

  async createAssignment(vehicleId: string, driverId: string, type: "ASSIGN" | "RELEASE", reason: string): Promise<Assignment> {
    const newAssignment: Assignment = {
      id: Math.random().toString(36).substring(2, 11),
      vehicle_id: vehicleId,
      driver_id: driverId,
      action_type: type,
      reason,
      created_at: new Date().toISOString(),
    };

    // Update active_driver_id on vehicle
    const vehicles = getLocalData("vehicles", seedVehicles);
    const vIndex = vehicles.findIndex((v) => v.id === vehicleId);
    if (vIndex >= 0) {
      vehicles[vIndex].active_driver_id = type === "ASSIGN" ? driverId : null;
      setLocalData("vehicles", vehicles);
    }

    if (supabase) {
      // Direct update of vehicle is required in actual supabase schema too
      await supabase.from("vehicles").update({ active_driver_id: type === "ASSIGN" ? driverId : null }).eq("id", vehicleId);
      const { data, error } = await supabase.from("assignments").insert(newAssignment).select().single();
      if (!error && data) return data;
    }

    const assignments = getLocalData("assignments", seedAssignments);
    assignments.unshift(newAssignment);
    setLocalData("assignments", assignments);

    return newAssignment;
  },

  // --- Checklists ---
  async getChecklists(): Promise<Checklist[]> {
    if (supabase) {
      const { data, error } = await supabase.from("checklists").select("*").order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("checklists", seedChecklists);
  },

  async saveChecklist(checklist: Omit<Checklist, "id" | "created_at">): Promise<Checklist> {
    const fullChecklist: Checklist = {
      id: Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      ...checklist,
    };
    if (supabase) {
      const { data, error } = await supabase.from("checklists").insert(fullChecklist).select().single();
      if (!error && data) return data;
    }
    const checklists = getLocalData("checklists", seedChecklists);
    checklists.unshift(fullChecklist);
    setLocalData("checklists", checklists);
    return fullChecklist;
  },

  // --- Weekly Rentals & Finance ---
  async getWeeklyRentals(): Promise<WeeklyRental[]> {
    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").select("*").order("week_start", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("weekly_rentals", seedWeeklyRentals);
  },

  async addPayment(driverId: string, weekStart: string, amount: number): Promise<WeeklyRental> {
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    const rentalIndex = rentals.findIndex((r) => r.driver_id === driverId && r.week_start === weekStart);

    let updatedRental: WeeklyRental;

    if (rentalIndex >= 0) {
      const current = rentals[rentalIndex];
      const newPaid = current.paid_amount + amount;
      // Recalculate status and debt
      let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "PARTIAL";
      if (newPaid >= current.rent_amount) {
        newStatus = "PAID";
      } else if (newPaid === 0) {
        newStatus = "UNPAID";
      }
      
      const newAccumulatedDebt = Math.max(0, current.accumulated_debt - amount);

      updatedRental = {
        ...current,
        paid_amount: newPaid,
        accumulated_debt: newAccumulatedDebt,
        status: newStatus,
        payments_log: [...current.payments_log, { amount, date: new Date().toISOString().split("T")[0] }],
      };
      rentals[rentalIndex] = updatedRental;
    } else {
      // Create new rental record for the driver
      const newAccumulatedDebt = Math.max(0, 2500 - amount);
      updatedRental = {
        id: Math.random().toString(36).substring(2, 11),
        driver_id: driverId,
        week_start: weekStart,
        rent_amount: 2500,
        paid_amount: amount,
        accumulated_debt: newAccumulatedDebt,
        status: amount >= 2500 ? "PAID" : amount > 0 ? "PARTIAL" : "UNPAID",
        payments_log: [{ amount, date: new Date().toISOString().split("T")[0] }],
        created_at: new Date().toISOString(),
      };
      rentals.unshift(updatedRental);
    }

    setLocalData("weekly_rentals", rentals);

    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").upsert(updatedRental).select().single();
      if (!error && data) return data;
    }

    return updatedRental;
  },

  async createWeeklyRental(rental: Omit<WeeklyRental, "id" | "created_at" | "payments_log">): Promise<WeeklyRental> {
    const fullRental: WeeklyRental = {
      id: Math.random().toString(36).substring(2, 11),
      payments_log: [],
      created_at: new Date().toISOString(),
      ...rental,
    };
    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").insert(fullRental).select().single();
      if (!error && data) return data;
    }
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    rentals.unshift(fullRental);
    setLocalData("weekly_rentals", rentals);
    return fullRental;
  },

  // --- Maintenances ---
  async getMaintenances(): Promise<Maintenance[]> {
    if (supabase) {
      const { data, error } = await supabase.from("maintenances").select("*").order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return getLocalData("maintenances", seedMaintenances);
  },

  async saveMaintenance(maintenance: Omit<Maintenance, "id" | "created_at">): Promise<Maintenance> {
    const fullMaint: Maintenance = {
      id: Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      ...maintenance,
    };
    if (supabase) {
      const { data, error } = await supabase.from("maintenances").insert(fullMaint).select().single();
      if (!error && data) return data;
    }
    const maintenances = getLocalData("maintenances", seedMaintenances);
    maintenances.unshift(fullMaint);
    setLocalData("maintenances", maintenances);
    return fullMaint;
  },

  // --- Alerts (Derived Dynamically) ---
  async getAlerts(): Promise<Alert[]> {
    const drivers = await this.getDrivers();
    const vehicles = await this.getVehicles();
    const maintenances = await this.getMaintenances();
    const alerts: Alert[] = [];
    const today = new Date();

    // 1. Driver License Alerts
    drivers.forEach((driver) => {
      if (driver.license_is_permanent) return;
      if (!driver.license_expiration_date) return;
      
      const expDate = new Date(driver.license_expiration_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alerts.push({
          id: `alert-lic-${driver.id}`,
          type: "LICENSE",
          title: `Licencia de Conducir Vencida / Por Vencer`,
          description: `La licencia de ${driver.first_name} ${driver.paternal_last_name} vence en ${diffDays} días (${driver.license_expiration_date}).`,
          targetId: driver.id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 7 ? "warning" : "info",
          dueDate: driver.license_expiration_date,
        });
      }
    });

    // 2. Vehicle Insurance Alerts
    vehicles.forEach((vehicle) => {
      if (!vehicle.insurance_expiration_date) return;
      
      const expDate = new Date(vehicle.insurance_expiration_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alerts.push({
          id: `alert-ins-${vehicle.id}`,
          type: "INSURANCE",
          title: `Seguro del Vehículo Vencido / Por Vencer`,
          description: `La póliza de seguro del auto ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) vence en ${diffDays} días.`,
          targetId: vehicle.id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 10 ? "warning" : "info",
          dueDate: vehicle.insurance_expiration_date,
        });
      }

      // 3. Vehicle Verification Alerts (Dynamic Mexican logic)
      if (vehicle.plate_number) {
        const schedule = getVerificationSchedule(vehicle.plate_number);
        // Verification happens in semesters. Let's find the current year/semester and notify if near.
        const month = today.getMonth(); // 0 = Jan, 11 = Dec
        
        let shouldAlert = false;
        let period = "";
        let limitDate = "";
        
        // Simple rules check based on last digit
        const match = vehicle.plate_number.replace(/\D/g, "");
        const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;
        
        if (lastDigit === 5 || lastDigit === 6) {
          // Yellow: Feb-Mar & Aug-Sep
          if (month === 0 || month === 1 || month === 2) {
            shouldAlert = true;
            period = "Primer Semestre (Feb-Mar)";
            limitDate = `${today.getFullYear()}-03-31`;
          } else if (month === 6 || month === 7 || month === 8) {
            shouldAlert = true;
            period = "Segundo Semestre (Ago-Sep)";
            limitDate = `${today.getFullYear()}-09-30`;
          }
        } else if (lastDigit === 7 || lastDigit === 8) {
          // Pink: Mar-Apr & Sep-Oct
          if (month === 1 || month === 2 || month === 3) {
            shouldAlert = true;
            period = "Primer Semestre (Mar-Abr)";
            limitDate = `${today.getFullYear()}-04-30`;
          } else if (month === 7 || month === 8 || month === 9) {
            shouldAlert = true;
            period = "Segundo Semestre (Sep-Oct)";
            limitDate = `${today.getFullYear()}-10-31`;
          }
        } else if (lastDigit === 3 || lastDigit === 4) {
          // Red: Apr-May & Oct-Nov
          if (month === 2 || month === 3 || month === 4) {
            shouldAlert = true;
            period = "Primer Semestre (Abr-May)";
            limitDate = `${today.getFullYear()}-05-31`;
          } else if (month === 8 || month === 9 || month === 10) {
            shouldAlert = true;
            period = "Segundo Semestre (Oct-Nov)";
            limitDate = `${today.getFullYear()}-11-30`;
          }
        } else if (lastDigit === 1 || lastDigit === 2) {
          // Green: May-Jun & Nov-Dic
          if (month === 3 || month === 4 || month === 5) {
            shouldAlert = true;
            period = "Primer Semestre (May-Jun)";
            limitDate = `${today.getFullYear()}-06-30`;
          } else if (month === 9 || month === 10 || month === 11) {
            shouldAlert = true;
            period = "Segundo Semestre (Nov-Dic)";
            limitDate = `${today.getFullYear()}-12-31`;
          }
        } else {
          // Blue: Jun-Jul & Dec-Jan
          if (month === 4 || month === 5 || month === 6) {
            shouldAlert = true;
            period = "Primer Semestre (Jun-Jul)";
            limitDate = `${today.getFullYear()}-07-31`;
          } else if (month === 10 || month === 11 || month === 0) {
            shouldAlert = true;
            period = "Segundo Semestre (Dic-Ene)";
            limitDate = `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`;
          }
        }

        if (shouldAlert) {
          alerts.push({
            id: `alert-ver-${vehicle.id}`,
            type: "VERIFICATION",
            title: `Verificación Vehicular Pendiente`,
            description: `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) con terminación ${lastDigit} (Engomado ${schedule.color}) debe verificar en ${period}.`,
            targetId: vehicle.id,
            severity: "warning",
            dueDate: limitDate,
          });
        }
      }
    });

    // 4. Maintenance Alerts
    maintenances.forEach((maint) => {
      if (!maint.next_maintenance_date) return;
      
      const nextDate = new Date(maint.next_maintenance_date);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 15) {
        alerts.push({
          id: `alert-maint-${maint.id}`,
          type: "MAINTENANCE",
          title: `Mantenimiento Programado`,
          description: `Próximo servicio programado para el vehículo en ${diffDays} días (${maint.next_maintenance_date}).`,
          targetId: maint.vehicle_id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 5 ? "warning" : "info",
          dueDate: maint.next_maintenance_date,
        });
      }
    });

    return alerts;
  },
};
