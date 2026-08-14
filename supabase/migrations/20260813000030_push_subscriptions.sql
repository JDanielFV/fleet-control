-- Migration: suscripciones push persistentes (Web Push)
--
-- Reemplaza el store en memoria de /api/push (se perdía en cada deploy).
-- RLS owner-scoped: cada dueño solo ve sus propias suscripciones; el
-- envío lo hace el server con service-role (bypassa RLS).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_scope_push_select" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owner_scope_push_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_push_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());