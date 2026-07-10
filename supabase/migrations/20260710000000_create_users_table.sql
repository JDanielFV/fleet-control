-- ============================================
-- Tabla de usuarios del sistema (operadores/admin)
-- Para usar con WebAuthn (passkeys) como método de autenticación
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    -- WebAuthn credentials stored as JSONB array
    -- Cada entrada: { id, publicKey, counter, transports[], createdAt, deviceName }
    webauthn_credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Información adicional del operador (Vázquez, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsqueda por email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- RLS: permitir acceso público (sin auth) para demo/operación local
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert users" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update users" ON public.users
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete users" ON public.users
    FOR DELETE USING (true);
