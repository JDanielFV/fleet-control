import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signJwt, verifyJwt } from "../lib/jwt";

const SECRET = "test-secret-supabase-jwt";

describe("jwt sign/verify (HS256)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    process.env.SUPABASE_JWT_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
    vi.useRealTimers();
  });

  it("firma un JWT de 3 partes con claims de sesión", async () => {
    const token = await signJwt({ sub: "user-1", email: "a@b.com", app_role: "admin" });
    const parts = token.split(".");
    expect(parts).toHaveLength(3);

    const payload = await verifyJwt(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-1");
    expect(payload?.email).toBe("a@b.com");
    expect(payload?.app_role).toBe("admin");
  });

  it("usa role=authenticated para que auth.uid() resuelva en RLS", async () => {
    const token = await signJwt({ sub: "user-1" });
    const payload = await verifyJwt(token);
    expect(payload?.role).toBe("authenticated");
    expect(payload?.iss).toBe("fleet-control");
  });

  it("rechaza un token manipulado", async () => {
    const token = await signJwt({ sub: "user-1" });
    const [h, p] = token.split(".");
    const tampered = `${h}.${p.slice(0, -1)}x.invalid-signature`;
    expect(await verifyJwt(tampered)).toBeNull();
  });

  it("rechaza un token firmado con otro secret", async () => {
    const token = await signJwt({ sub: "user-1" });
    process.env.SUPABASE_JWT_SECRET = "otro-secret-distinto";
    expect(await verifyJwt(token)).toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const token = await signJwt({ sub: "user-1" }, 1); // expira en 1s
    vi.setSystemTime(new Date("2026-08-13T12:00:03Z"));
    expect(await verifyJwt(token)).toBeNull();
  });

  it("acepta un token dentro de su vigencia", async () => {
    const token = await signJwt({ sub: "user-1" }, 3600);
    vi.setSystemTime(new Date("2026-08-13T12:30:00Z"));
    expect(await verifyJwt(token)).not.toBeNull();
  });

  it("sin SUPABASE_JWT_SECRET: sign lanza y verify devuelve null", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    await expect(signJwt({ sub: "user-1" })).rejects.toThrow();
    expect(await verifyJwt("a.b.c")).toBeNull();
  });
});
