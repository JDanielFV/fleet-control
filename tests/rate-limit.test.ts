import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  getClientIp,
  loginRateLimitKey,
  LOGIN_LOCKED_MESSAGE,
} from "../lib/rate-limit";

const KEY = "daniel@test.com|1.2.3.4";

describe("login rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    resetLoginRateLimit(KEY);
  });

  afterEach(() => {
    resetLoginRateLimit(KEY);
    vi.useRealTimers();
  });

  it("permite hasta 5 fallos y descuenta los restantes", () => {
    for (let i = 1; i <= 5; i++) {
      const state = checkLoginRateLimit(KEY);
      expect(state.allowed).toBe(true);
      expect(state.remaining).toBe(5 - i + 1);
      recordLoginFailure(KEY);
    }
  });

  it("bloquea el 6º intento con bloqueo temporal y Retry-After", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(KEY);
    const locked = checkLoginRateLimit(KEY);
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("sigue bloqueado durante el lockout", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(KEY);
    // 10 minutos después el bloqueo sigue activo
    vi.setSystemTime(new Date("2026-08-13T12:10:00Z"));
    expect(checkLoginRateLimit(KEY).allowed).toBe(false);
  });

  it("libera el bloqueo al expirar la ventana", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure(KEY);
    vi.setSystemTime(new Date("2026-08-13T12:16:00Z"));
    expect(checkLoginRateLimit(KEY).allowed).toBe(true);
  });

  it("un login exitoso resetea el contador", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(KEY);
    resetLoginRateLimit(KEY);
    const state = checkLoginRateLimit(KEY);
    expect(state.allowed).toBe(true);
    expect(state.remaining).toBe(5);
  });

  it("llaves distintas son independientes", () => {
    const other = loginRateLimitKey("otro@test.com", "9.9.9.9");
    for (let i = 0; i < 5; i++) recordLoginFailure(KEY);
    expect(checkLoginRateLimit(KEY).allowed).toBe(false);
    expect(checkLoginRateLimit(other).allowed).toBe(true);
  });

  it("el mensaje de bloqueo es genérico", () => {
    expect(LOGIN_LOCKED_MESSAGE).toContain("Demasiados intentos");
    expect(LOGIN_LOCKED_MESSAGE).not.toContain("@");
  });
});

describe("getClientIp / loginRateLimitKey", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("cae a x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(getClientIp(req)).toBe("198.51.100.9");
  });

  it("cae a unknown sin headers", () => {
    expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
  });

  it("normaliza el email en la llave compuesta", () => {
    expect(loginRateLimitKey("  User@Test.COM ", "1.2.3.4")).toBe("user@test.com|1.2.3.4");
  });
});
