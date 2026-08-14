import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRegistrationToken,
  getRegistrationToken,
  useRegistrationToken,
} from "../lib/db/tokens";

/**
 * Predicado de validación del token de invitación (mismo criterio que el
 * flujo server-side: existe, sin usar y no expirado).
 */
function isTokenValid(rt: { used_at: string | null; expires_at: string }): boolean {
  return rt.used_at === null && new Date(rt.expires_at).getTime() > Date.now();
}

describe("registration tokens (modo demo)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
  });

  it("crea un token con expiración de 24 h y lo persiste", async () => {
    const rt = await createRegistrationToken(null);
    expect(rt.token).toMatch(/^[0-9a-f]{64}$/);
    expect(rt.created_by).toBeNull();
    expect(rt.used_at).toBeNull();

    const stored = await getRegistrationToken(rt.token);
    expect(stored?.id).toBe(rt.id);
    expect(new Date(stored!.expires_at).getTime() - Date.now()).toBe(24 * 60 * 60 * 1000);
  });

  it("guarda quién creó el token", async () => {
    const rt = await createRegistrationToken("owner-abc");
    expect(rt.created_by).toBe("owner-abc");
    expect((await getRegistrationToken(rt.token))?.created_by).toBe("owner-abc");
  });

  it("un token sin usar y vigente es válido", async () => {
    const rt = await createRegistrationToken(null);
    expect(isTokenValid(rt)).toBe(true);
  });

  it("consumir el token (un solo uso) lo invalida", async () => {
    const rt = await createRegistrationToken(null);
    await useRegistrationToken(rt.id);

    const stored = await getRegistrationToken(rt.token);
    expect(stored?.used_at).not.toBeNull();
    expect(isTokenValid(stored!)).toBe(false);
  });

  it("un token expirado es inválido", async () => {
    const rt = await createRegistrationToken(null);
    // 25 h después: fuera de vigencia
    vi.setSystemTime(new Date("2026-08-14T13:00:00Z"));
    expect(isTokenValid(rt)).toBe(false);
  });

  it("un token inexistente no se encuentra", async () => {
    expect(await getRegistrationToken("token-que-no-existe")).toBeNull();
  });

  it("tokens distintos son independientes", async () => {
    const a = await createRegistrationToken(null);
    const b = await createRegistrationToken(null);
    expect(a.token).not.toBe(b.token);
    await useRegistrationToken(a.id);
    expect(isTokenValid((await getRegistrationToken(b.token))!)).toBe(true);
  });
});
