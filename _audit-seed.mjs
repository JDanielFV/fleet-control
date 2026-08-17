/**
 * Seed demo (modo localStorage) compartido por los scripts de auditoría.
 * Nada de esto toca Supabase: solo `fleet_*` keys del localStorage.
 */
export const OWNER_ID = "audit-owner-001";

const TODAY = new Date();
const iso = (daysFromNow) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
};

export const seed = {
  users: [
    { id: OWNER_ID, display_name: "Admin Auditor", email: "admin@demo.local", role: "admin", webauthn_credentials: [], metadata: {}, is_active: true, last_login_at: null, created_at: iso(-30), updated_at: iso(-1) },
    { id: "u-owner-2", display_name: "Operador B", email: "op2@demo.local", role: "owner", webauthn_credentials: [], metadata: {}, is_active: true, last_login_at: null, created_at: iso(-20), updated_at: iso(-2) },
    { id: "u-owner-3", display_name: "Operador C", email: "op3@demo.local", role: "owner", webauthn_credentials: [], metadata: {}, is_active: true, last_login_at: null, created_at: iso(-10), updated_at: iso(-3) },
  ],
  drivers: [
    { id: "d1", owner_id: OWNER_ID, first_name: "Juan", paternal_last_name: "Pérez", maternal_last_name: "López", curp: "PEJL900101HDFRPN09", dob: "1990-01-01", license_number: "LIC-001234", license_issue_date: iso(-300), license_expiration_date: iso(20), license_is_permanent: false, ine_address: "Calle Hidalgo 123, Col. Centro, CDMX", ine_sex: "M", ine_elector_key: "PEJL90010112H300", created_at: iso(-60) },
    { id: "d2", owner_id: OWNER_ID, first_name: "María", paternal_last_name: "García", maternal_last_name: "Torres", curp: "GATM850505MDFRRN02", dob: "1985-05-05", license_number: "LIC-002345", license_issue_date: iso(-400), license_expiration_date: null, license_is_permanent: true, ine_address: "Av. Juárez 456, Col. Roma, CDMX", ine_sex: "F", ine_elector_key: "GATM85050512M400", created_at: iso(-55) },
    { id: "d3", owner_id: OWNER_ID, first_name: "Carlos", paternal_last_name: "Hernández", maternal_last_name: "Ruiz", curp: "HERL780712HDFRZN04", dob: "1978-07-12", license_number: "LIC-003456", license_issue_date: iso(-500), license_expiration_date: iso(-15), license_is_permanent: false, ine_address: "Blvd. de las Flores 789, Zapopan, JAL", ine_sex: "M", ine_elector_key: "HERL78071214J500", created_at: iso(-50) },
    { id: "d4", owner_id: OWNER_ID, first_name: "Ana", paternal_last_name: "Martínez", maternal_last_name: "Cruz", curp: "MACA930225MDFRRL07", dob: "1993-02-25", license_number: "LIC-004567", license_issue_date: iso(-250), license_expiration_date: iso(200), license_is_permanent: false, ine_address: "Calle 5 de Mayo 321, Puebla, PUE", ine_sex: "F", ine_elector_key: "MACA93022514P700", created_at: iso(-45) },
    { id: "d5", owner_id: OWNER_ID, first_name: "Luis", paternal_last_name: "Rodríguez", maternal_last_name: "Mendoza", curp: "RODM880818HDFNNS03", dob: "1988-08-18", license_number: "LIC-005678", license_issue_date: iso(-350), license_expiration_date: null, license_is_permanent: true, ine_address: "Av. Revolución 654, Monterrey, NL", ine_sex: "M", ine_elector_key: "RODM88081819N300", created_at: iso(-40) },
    { id: "d6", owner_id: OWNER_ID, first_name: "Sofía", paternal_last_name: "Flores", maternal_last_name: "Vega", curp: "FLOV960404MDFRGS05", dob: "1996-04-04", license_number: "LIC-006789", license_issue_date: iso(-180), license_expiration_date: iso(10), license_is_permanent: false, ine_address: "Calle Sonora 987, Guadalajara, JAL", ine_sex: "F", ine_elector_key: "FLOV96040414G500", created_at: iso(-35) },
  ],
  vehicles: [
    { id: "v1", owner_id: OWNER_ID, brand: "Nissan", vehicle_name: "Versa", model: "2022", class_type: "Sedán", color: "Blanco", circulation_expiration_date: iso(120), vin: "3N1AB7AP0MY123456", plate_number: "982-WXY", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1001", insurance_expiration_date: iso(15), verification_expiration_date: iso(60), verification_img: null, verification_completed: true, status: "active", service_out_date: null, service_return_date: null, active_driver_id: "d1", rent_cost: 2500, next_service_mileage: 50000, created_at: iso(-60) },
    { id: "v2", owner_id: OWNER_ID, brand: "Toyota", vehicle_name: "Hilux", model: "2021", class_type: "Pickup", color: "Gris", circulation_expiration_date: iso(90), vin: "3TMLZ4EN5MM045678", plate_number: "456-ABC", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1002", insurance_expiration_date: iso(-8), verification_expiration_date: iso(30), verification_img: null, verification_completed: true, status: "active", service_out_date: null, service_return_date: null, active_driver_id: "d2", rent_cost: 3500, next_service_mileage: 80000, created_at: iso(-55) },
    { id: "v3", owner_id: OWNER_ID, brand: "Chevrolet", vehicle_name: "Aveo", model: "2020", class_type: "Sedán", color: "Rojo", circulation_expiration_date: iso(200), vin: "3G1DA6E78LL234567", plate_number: "789-DEF", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1003", insurance_expiration_date: iso(180), verification_expiration_date: iso(150), verification_img: null, verification_completed: true, status: "active", service_out_date: null, service_return_date: null, active_driver_id: "d3", rent_cost: 2200, next_service_mileage: 60000, created_at: iso(-50) },
    { id: "v4", owner_id: OWNER_ID, brand: "Honda", vehicle_name: "CR-V", model: "2023", class_type: "SUV", color: "Negro", circulation_expiration_date: iso(300), vin: "5J6RW2H86PL345678", plate_number: "321-GHI", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1004", insurance_expiration_date: iso(25), verification_expiration_date: iso(45), verification_img: null, verification_completed: false, status: "active", service_out_date: null, service_return_date: null, active_driver_id: "d4", rent_cost: 4000, next_service_mileage: 45000, created_at: iso(-45) },
    { id: "v5", owner_id: OWNER_ID, brand: "Volkswagen", vehicle_name: "Jetta", model: "2019", class_type: "Sedán", color: "Azul", circulation_expiration_date: iso(30), vin: "3VWD17AJ0KM456789", plate_number: "654-JKL", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1005", insurance_expiration_date: iso(10), verification_expiration_date: iso(-20), verification_img: null, verification_completed: false, status: "in_service", service_out_date: iso(-5), service_return_date: null, active_driver_id: null, rent_cost: 2000, next_service_mileage: 90000, created_at: iso(-40) },
    { id: "v6", owner_id: OWNER_ID, brand: "Kia", vehicle_name: "Rio", model: "2022", class_type: "Hatchback", color: "Plata", circulation_expiration_date: iso(250), vin: "KNADM4A30N5678901", plate_number: "987-MNO", insurance_policy_img: "", insurance_policy_pages: "[]", insurance_policy_number: "POL-1006", insurance_expiration_date: iso(150), verification_expiration_date: iso(90), verification_img: null, verification_completed: true, status: "active", service_out_date: null, service_return_date: null, active_driver_id: null, rent_cost: 2300, next_service_mileage: 40000, created_at: iso(-30) },
  ],
  assignments: [
    { id: "a1", owner_id: OWNER_ID, vehicle_id: "v1", driver_id: "d1", action_type: "ASSIGN", reason: "Asignación inicial", created_at: iso(-60) },
    { id: "a2", owner_id: OWNER_ID, vehicle_id: "v2", driver_id: "d2", action_type: "ASSIGN", reason: "Asignación inicial", created_at: iso(-55) },
    { id: "a3", owner_id: OWNER_ID, vehicle_id: "v3", driver_id: "d3", action_type: "ASSIGN", reason: "Asignación inicial", created_at: iso(-50) },
    { id: "a4", owner_id: OWNER_ID, vehicle_id: "v4", driver_id: "d4", action_type: "ASSIGN", reason: "Asignación inicial", created_at: iso(-45) },
  ],
  checklists: [
    { id: "c1", owner_id: OWNER_ID, vehicle_id: "v1", driver_id: "d1", type: "WEEKLY_START", mileage: 45230, gasoline_level: "6/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(-14) },
    { id: "c2", owner_id: OWNER_ID, vehicle_id: "v1", driver_id: "d1", type: "WEEKLY_START", mileage: 45810, gasoline_level: "5/8", checklist_items: { lights: true, brakes: true, tires: false, bodywork: true, documents: true }, irregularities: "Llanta trasera izquierda con desgaste", created_at: iso(-7) },
    { id: "c3", owner_id: OWNER_ID, vehicle_id: "v1", driver_id: "d1", type: "WEEKLY_START", mileage: 46390, gasoline_level: "7/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(0) },
    { id: "c4", owner_id: OWNER_ID, vehicle_id: "v2", driver_id: "d2", type: "WEEKLY_START", mileage: 61200, gasoline_level: "4/8", checklist_items: { lights: true, brakes: false, tires: true, bodywork: true, documents: true }, irregularities: "Frenos requieren revisión", created_at: iso(-14) },
    { id: "c5", owner_id: OWNER_ID, vehicle_id: "v2", driver_id: "d2", type: "WEEKLY_START", mileage: 61890, gasoline_level: "6/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(-7) },
    { id: "c6", owner_id: OWNER_ID, vehicle_id: "v2", driver_id: "d2", type: "WEEKLY_START", mileage: 62540, gasoline_level: "5/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: false }, irregularities: "Falta tarjeta de circulación en la guantera", created_at: iso(0) },
    { id: "c7", owner_id: OWNER_ID, vehicle_id: "v3", driver_id: "d3", type: "WEEKLY_START", mileage: 33100, gasoline_level: "8/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(-7) },
    { id: "c8", owner_id: OWNER_ID, vehicle_id: "v3", driver_id: "d3", type: "WEEKLY_START", mileage: 33750, gasoline_level: "7/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(0) },
    { id: "c9", owner_id: OWNER_ID, vehicle_id: "v4", driver_id: "d4", type: "WEEKLY_START", mileage: 28400, gasoline_level: "5/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: false, documents: true }, irregularities: "Rayón en puerta trasera derecha", created_at: iso(-7) },
    { id: "c10", owner_id: OWNER_ID, vehicle_id: "v4", driver_id: "d4", type: "WEEKLY_START", mileage: 29010, gasoline_level: "6/8", checklist_items: { lights: true, brakes: true, tires: true, bodywork: true, documents: true }, irregularities: "", created_at: iso(0) },
  ],
  weekly_rentals: [
    { id: "r1", owner_id: OWNER_ID, driver_id: "d1", week_start: iso(-14), rent_amount: 2500, paid_amount: 2500, is_prorated: true, prorated_days: 4, condoned_days: 0, condoned_amount: 0, status: "PAID", payments_log: [{ amount: 2500, date: iso(-12) }], created_at: iso(-14) },
    { id: "r2", owner_id: OWNER_ID, driver_id: "d1", week_start: iso(-7), rent_amount: 2500, paid_amount: 2500, is_prorated: false, condoned_days: 0, condoned_amount: 0, status: "PAID", payments_log: [{ amount: 2500, date: iso(-6) }], created_at: iso(-7) },
    { id: "r3", owner_id: OWNER_ID, driver_id: "d1", week_start: iso(0), rent_amount: 2500, paid_amount: 1500, is_prorated: false, condoned_days: 0, condoned_amount: 0, status: "PARTIAL", payments_log: [{ amount: 1500, date: iso(-1) }], created_at: iso(0) },
    { id: "r4", owner_id: OWNER_ID, driver_id: "d2", week_start: iso(-7), rent_amount: 3500, paid_amount: 3500, is_prorated: false, condoned_days: 0, condoned_amount: 0, status: "PAID", payments_log: [{ amount: 3500, date: iso(-5) }], created_at: iso(-7) },
    { id: "r5", owner_id: OWNER_ID, driver_id: "d2", week_start: iso(0), rent_amount: 3500, paid_amount: 0, is_prorated: false, condoned_days: 2, condoned_amount: 1000, status: "UNPAID", payments_log: [], created_at: iso(0) },
    { id: "r6", owner_id: OWNER_ID, driver_id: "d3", week_start: iso(-7), rent_amount: 2200, paid_amount: 2200, is_prorated: false, condoned_days: 0, condoned_amount: 0, status: "PAID", payments_log: [{ amount: 2200, date: iso(-4) }], created_at: iso(-7) },
    { id: "r7", owner_id: OWNER_ID, driver_id: "d3", week_start: iso(0), rent_amount: 2200, paid_amount: 800, is_prorated: false, condoned_days: 1, condoned_amount: 314, status: "PARTIAL", payments_log: [{ amount: 800, date: iso(-1) }], created_at: iso(0) },
    { id: "r8", owner_id: OWNER_ID, driver_id: "d4", week_start: iso(0), rent_amount: 4000, paid_amount: 0, is_prorated: false, condoned_days: 0, condoned_amount: 0, status: "UNPAID", payments_log: [], created_at: iso(0) },
  ],
};

export const SESSION = {
  userId: OWNER_ID,
  email: "admin@demo.local",
  displayName: "Admin Auditor",
  role: "admin",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  token: null,
};

/** Init script que siembra localStorage (sesión opcional). */
export function buildInitScript(withSession) {
  const payload = { seed, session: withSession ? SESSION : null };
  return `(() => {
    const p = ${JSON.stringify(payload)};
    const set = (key, val) => localStorage.setItem("fleet_" + key, JSON.stringify(val));
    for (const [k, v] of Object.entries(p.seed)) set(k, v);
    if (p.session) localStorage.setItem("fleet_session", JSON.stringify(p.session));
    else localStorage.removeItem("fleet_session");
  })();`;
}
