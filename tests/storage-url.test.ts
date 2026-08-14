import { describe, it, expect } from "vitest";
import { resolveDocUrl } from "../lib/db/storage";

describe("resolveDocUrl (documentos en bucket privado)", () => {
  it("deja pasar URLs públicas y data URLs", () => {
    expect(resolveDocUrl("https://x.supabase.co/obj/foo.png")).toBe("https://x.supabase.co/obj/foo.png");
    expect(resolveDocUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(resolveDocUrl(null)).toBe("");
    expect(resolveDocUrl(undefined)).toBe("");
    expect(resolveDocUrl("")).toBe("");
  });

  it("es idempotente para rutas ya resueltas a /api/doc", () => {
    const resolved = "/api/doc?path=u1%2Fdoc_abc.png";
    expect(resolveDocUrl(resolved)).toBe(resolved);
  });

  it("convierte un storage path owner-scoped en /api/doc codificado", () => {
    expect(resolveDocUrl("u1/driver_abc.png")).toBe("/api/doc?path=u1%2Fdriver_abc.png");
  });

  it("codifica caracteres especiales del path", () => {
    const out = resolveDocUrl("u1/licencia foto 2026.png");
    expect(out).toBe("/api/doc?path=u1%2Flicencia%20foto%202026.png");
  });
});
