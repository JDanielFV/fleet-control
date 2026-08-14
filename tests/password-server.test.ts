import { describe, it, expect } from "vitest";
import {
  hashPasswordServer,
  verifyPasswordServer,
  isScryptHash,
} from "../lib/password-server";
import { hashPassword } from "../lib/password"; // esquema legacy SHA-256

describe("password-server (scrypt)", () => {
  it("genera un hash con prefijo scrypt y salt propio", async () => {
    const hash = await hashPasswordServer("mi-password-segura");
    expect(isScryptHash(hash)).toBe(true);
    const parts = hash.split("$");
    expect(parts).toHaveLength(3); // scrypt$salt$hash
    expect(parts[0]).toBe("scrypt");
  });

  it("verifica la contraseña correcta (sin upgrade necesario)", async () => {
    const hash = await hashPasswordServer("mi-password-segura");
    const result = await verifyPasswordServer("mi-password-segura", hash);
    expect(result.ok).toBe(true);
    expect(result.needsUpgrade).toBe(false);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPasswordServer("mi-password-segura");
    const result = await verifyPasswordServer("incorrecta", hash);
    expect(result.ok).toBe(false);
  });

  it("usa un salt distinto por hash (misma password → hashes distintos)", async () => {
    const a = await hashPasswordServer("misma-password");
    const b = await hashPasswordServer("misma-password");
    expect(a).not.toBe(b);
  });

  it("maneja hashes nulos/vacíos", async () => {
    expect(await verifyPasswordServer("x", null)).toEqual({ ok: false, needsUpgrade: false });
    expect(await verifyPasswordServer("x", undefined)).toEqual({ ok: false, needsUpgrade: false });
    expect(isScryptHash(null)).toBe(false);
    expect(isScryptHash("")).toBe(false);
  });

  it("rechaza formatos corruptos en la verificación", async () => {
    // isScryptHash solo chequea el prefijo (discriminador rápido)...
    expect(isScryptHash("scrypt$solo-dos-partes")).toBe(true);
    // ...pero la verificación exige exactamente 3 partes (scrypt$salt$hash).
    const result = await verifyPasswordServer("x", "scrypt$solo-dos-partes");
    expect(result.ok).toBe(false);
    expect(await verifyPasswordServer("x", "scrypt$AAAAAAAA$ZZZZ")).toMatchObject({ ok: false });
  });
});

describe("upgrade-on-login (hashes legacy SHA-256)", () => {
  it("verifica un hash legacy y marca needsUpgrade=true", async () => {
    const legacyHash = await hashPassword("clave-vieja");
    const result = await verifyPasswordServer("clave-vieja", legacyHash);
    expect(result.ok).toBe(true);
    expect(result.needsUpgrade).toBe(true);
  });

  it("rechaza una password incorrecta contra un hash legacy (sin upgrade)", async () => {
    const legacyHash = await hashPassword("clave-vieja");
    const result = await verifyPasswordServer("otra-clave", legacyHash);
    expect(result.ok).toBe(false);
    expect(result.needsUpgrade).toBe(false);
  });

  it("tras el upgrade, la nueva verificación usa scrypt (simula re-hash en login)", async () => {
    const legacyHash = await hashPassword("clave-vieja");
    const result = await verifyPasswordServer("clave-vieja", legacyHash);
    expect(result.needsUpgrade).toBe(true);

    // El login route hace exactamente esto: re-hashea con scrypt.
    const upgraded = await hashPasswordServer("clave-vieja");
    const after = await verifyPasswordServer("clave-vieja", upgraded);
    expect(after.ok).toBe(true);
    expect(after.needsUpgrade).toBe(false);
  });
});
