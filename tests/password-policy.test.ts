import { describe, it, expect } from "vitest";
import { MIN_PASSWORD_LENGTH, validatePassword } from "../lib/password-policy";

describe("política de contraseñas", () => {
  it("rechaza contraseñas más cortas que el mínimo", () => {
    const result = validatePassword("abc123");
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rechaza cadenas vacías", () => {
    expect(validatePassword("").valid).toBe(false);
  });

  it("acepta contraseñas de exactamente el mínimo", () => {
    const result = validatePassword("a".repeat(MIN_PASSWORD_LENGTH));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
