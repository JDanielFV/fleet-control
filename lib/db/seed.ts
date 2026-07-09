import type { Driver, Vehicle, Assignment, Checklist, WeeklyRental, Maintenance } from "./types";

export const seedDrivers: Driver[] = [
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

export const seedVehicles: Vehicle[] = [
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
    insurance_policy_pages: "[]",
    insurance_policy_number: "POL-2026-001",
    insurance_expiration_date: "2026-07-15",
    verification_expiration_date: "2026-08-31",
    status: "active",
    service_out_date: null,
    service_return_date: null,
    active_driver_id: "d1",
    rent_cost: 2500,
    next_service_mileage: 50000,
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
    insurance_policy_pages: "[]",
    insurance_policy_number: "POL-2026-002",
    insurance_expiration_date: "2026-12-01",
    verification_expiration_date: "2027-02-28",
    status: "active",
    service_out_date: null,
    service_return_date: null,
    active_driver_id: null,
    rent_cost: 2500,
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
  }
];

export const seedAssignments: Assignment[] = [
  {
    id: "a1",
    vehicle_id: "v1",
    driver_id: "d1",
    action_type: "ASSIGN",
    reason: "Inicio de contrato semanal estándar",
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  }
];

export const seedChecklists: Checklist[] = [
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

export const seedWeeklyRentals: WeeklyRental[] = [
  {
    id: "r1",
    driver_id: "d1",
    week_start: "2026-06-22",
    rent_amount: 2500,
    paid_amount: 1500,
    is_prorated: false,
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
    is_prorated: false,
    status: "UNPAID",
    payments_log: [],
    created_at: "2026-06-29T08:00:00.000Z",
  }
];

export const seedMaintenances: Maintenance[] = [
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
