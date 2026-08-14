import { createClient } from "@supabase/supabase-js";
import { getSessionToken } from "@/lib/session";
export type * from "./types";
export { getVerificationSchedule, genId, normalizeEmptyDates } from "./utils";
export { getMondayOf, prorateRent, estimateServiceDate } from "../utils";

// --- Supabase Connection ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

/**
 * Build a Supabase client for the current request.
 *
 * Client-side, it attaches the session JWT (minted at login with
 * SUPABASE_JWT_SECRET, stored in the session) as a Bearer token so
 * PostgREST treats the caller as `authenticated` and RLS policies
 * (owner_id = auth.uid()) apply. Without a JWT it falls back to the anon
 * key — useful pre-RLS and in local mode.
 *
 * Server-side (no window) it creates a plain anon client; server routes
 * that need privileged access create their own service-role client.
 */
export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = getSessionToken();
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });
}

// Re-export all entity-specific modules
export * from "./drivers";
export * from "./vehicles";
export * from "./assignments";
export * from "./checklists";
export * from "./finances";
export * from "./maintenances";
export * from "./renewal-logs";
export * from "./alerts";
export * from "./inventory";
export * from "./users";
export * from "./tokens";
