/**
 * Vitest global setup (node environment).
 *
 * The demo-mode data modules (lib/db/tokens.ts and friends) read and write
 * through `localStorage` guarded by `typeof window === "undefined"`. In node
 * there is no window/localStorage, so we install a minimal in-memory
 * implementation to exercise that code path in tests.
 */

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// `typeof window === "undefined"` guards in lib/db/* switch to the
// localStorage path when window exists.
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  writable: true,
  configurable: true,
});
