-- 1. Create Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    paternal_last_name TEXT NOT NULL,
    maternal_last_name TEXT,
    curp TEXT UNIQUE NOT NULL,
    dob DATE,
    license_number TEXT,
    license_issue_date DATE,
    license_expiration_date DATE,
    license_is_permanent BOOLEAN DEFAULT FALSE,
    ine_address TEXT,
    ine_sex TEXT CHECK (ine_sex IN ('M', 'F', 'X')),
    ine_elector_key TEXT,
    ine_img TEXT,
    license_img TEXT,
    driver_photo_img TEXT,
    address_proof_img TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    model TEXT,
    class_type TEXT,
    circulation_expiration_date DATE,
    circulation_img TEXT,
    vin TEXT,
    plate_number TEXT UNIQUE NOT NULL,
    insurance_policy_img TEXT,
    insurance_expiration_date DATE,
    active_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    color TEXT,
    rent_cost NUMERIC(10, 2) NOT NULL DEFAULT 2500.00,
    next_service_mileage INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
    action_type TEXT CHECK (action_type IN ('ASSIGN', 'RELEASE')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Checklists Table
CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('DELIVERY', 'WEEKLY_START')),
    mileage INTEGER NOT NULL,
    gasoline_level TEXT NOT NULL,
    checklist_items JSONB NOT NULL,
    irregularities TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Weekly Rentals Table
CREATE TABLE IF NOT EXISTS weekly_rentals (
    id TEXT PRIMARY KEY,
    driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    rent_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) DEFAULT 0.00,
    accumulated_debt NUMERIC(10, 2) DEFAULT 0.00,
    status TEXT CHECK (status IN ('PAID', 'PARTIAL', 'UNPAID')),
    payments_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Maintenances Table
CREATE TABLE IF NOT EXISTS maintenances (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    cost NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    maintenance_date DATE NOT NULL,
    next_maintenance_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) policies for anonymous demo access
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

-- RLS hardening: the fleet tables are scoped by owner (see
-- migrations/20260812000000_rls_owner_scoping.sql). The app uses a custom
-- auth (password + WebAuthn against the `users` table) and mints a JWT
-- signed with SUPABASE_JWT_SECRET (role=authenticated, sub=user_id), so
-- policies keyed on auth.uid() = owner_id apply. The anon key can no longer
-- read/write fleet data.
--
-- PENDING (milestone B): the `users` and `registration_tokens` tables still
-- carry the permissive public policies below. They will be closed once
-- registration moves to a server-side route (service-role key) that hashes
-- passwords with scrypt.
CREATE POLICY "Allow public read drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Allow public write drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read vehicles" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Allow public write vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket RLS: allow public access to documentos bucket
CREATE POLICY "Allow public read documentos" ON storage.objects FOR SELECT USING (bucket_id = 'documentos');
CREATE POLICY "Allow public insert documentos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "Allow public delete documentos" ON storage.objects FOR DELETE USING (bucket_id = 'documentos');

CREATE POLICY "Allow public read assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Allow public write assignments" ON assignments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read checklists" ON checklists FOR SELECT USING (true);
CREATE POLICY "Allow public write checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read weekly_rentals" ON weekly_rentals FOR SELECT USING (true);
CREATE POLICY "Allow public write weekly_rentals" ON weekly_rentals FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read maintenances" ON maintenances FOR SELECT USING (true);
CREATE POLICY "Allow public write maintenances" ON maintenances FOR ALL USING (true) WITH CHECK (true);
