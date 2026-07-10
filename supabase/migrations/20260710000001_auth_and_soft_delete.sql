-- ============================================
-- Migration: registration tokens, password auth, soft delete
-- ============================================

-- 1. Add password_hash to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Registration tokens table
CREATE TABLE IF NOT EXISTS public.registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add deleted_at to drivers and vehicles for soft delete
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON public.registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON public.drivers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at);

-- 5. RLS policies for registration_tokens
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read registration_tokens" ON public.registration_tokens
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert registration_tokens" ON public.registration_tokens
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update registration_tokens" ON public.registration_tokens
    FOR UPDATE USING (true) WITH CHECK (true);
