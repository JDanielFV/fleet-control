-- ============================================================================
-- NOTA IMPORTANTE
-- ============================================================================
-- Este archivo es el snapshot histórico del esquema demo (acceso público anónimo).
-- La fuente de verdad actual son las migraciones en supabase/migrations/
-- (00001_rls_owner_scoping, 20260813000010_secure_document_storage,
-- 20260813000020_integrity_and_credits, 20260813000030_push_subscriptions),
-- que aplican RLS owner-scoped y ELIMINAN las políticas públicas de abajo.
-- Este archivo se conserva como referencia del modelo de datos base.
-- ============================================================================

-- 0. Tabla de usuarios (migración 20260710000000_create_users_table)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    webauthn_credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. Create Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    model TEXT,
    class_type TEXT,
    circulation_expiration_date DATE,
    circulation_img TEXT,
    vin TEXT,
    plate_number TEXT UNIQUE NOT NULL,
    insurance_policy_img TEXT,
    insurance_policy_pages TEXT,
    insurance_expiration_date DATE,
    active_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    color TEXT,
    rent_cost NUMERIC(10, 2) NOT NULL DEFAULT 2500.00,
    next_service_mileage INTEGER,
    next_service_mileage_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
    action_type TEXT CHECK (action_type IN ('ASSIGN', 'RELEASE')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Checklists Table
CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    rent_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) DEFAULT 0.00,
    accumulated_debt NUMERIC(10, 2) DEFAULT 0.00,
    status TEXT CHECK (status IN ('PAID', 'PARTIAL', 'UNPAID')),
    payments_log JSONB DEFAULT '[]'::jsonb,
    condoned_days INTEGER DEFAULT 0,
    condoned_amount NUMERIC(10, 2) DEFAULT 0.00,
    is_prorated BOOLEAN DEFAULT FALSE,
    prorated_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Maintenances Table
CREATE TABLE IF NOT EXISTS maintenances (
    id TEXT PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
    cost NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    maintenance_date DATE NOT NULL,
    next_maintenance_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tablas nuevas (migraciones 20260813000020 / 20260813000030)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_until TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS driver_credits (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS: habilitado por las migraciones (owner-scoped). Las políticas públicas
-- de abajo son la línea base demo histórica; las migraciones las eliminan
-- y aplican owner_id = auth.uid().
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Allow public write drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read vehicles" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Allow public write vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket RLS: legacy demo baseline (public). Reemplazada por la
-- migración 20260813000010 (bucket privado + policies owner-scoped).
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