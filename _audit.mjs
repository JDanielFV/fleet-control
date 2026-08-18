/**
 * Fase 0 — Auditoría de responsividad.
 *
 * Levanta las vistas principales en varios viewports, sembrando una sesión y
 * datos demo en localStorage (modo demo — nunca toca Supabase). Guarda
 * capturas en docs/superpowers/screens/before/<width>/ y un JSON de métricas
 * de overflow para detectar scroll horizontal.
 *
 * Uso:
 *   # servidor en modo demo (sin vars de Supabase)
 *   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
 *   SUPABASE_SERVICE_ROLE_KEY= SUPABASE_JWT_SECRET= npm run dev -- -p 3100
 *   node _audit.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { buildInitScript } from "./_audit-seed.mjs";

const BASE = "http://localhost:3100";
const OUT = "docs/superpowers/screens/before";

// ---------------------------------------------------------------- views setup
const VIEWPORTS = [
  { width: 375, height: 667, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 430, height: 932, mobile: true },
  { width: 768, height: 1024, mobile: true },
  // Rango híbrido 768–1024 (sidebar visible + overlays): línea base para la
  // decisión de breakpoints de la Fase 1 (ver docs/superpowers/plans/2026-08-18-breakpoints-phase1.md)
  { width: 800, height: 900, mobile: true },
  { width: 900, height: 900, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 1440, height: 900, mobile: false },
];

const TABS = [
  { key: "checklists", label: "Check Lists" },
  { key: "drivers", label: "Choferes" },
  { key: "vehicles", label: "Autos" },
  { key: "users", label: "Usuarios" },
];

const allMetrics = [];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const dir = path.join(OUT, String(vp.width));
  fs.mkdirSync(dir, { recursive: true });

  // Contexto con sesión → dashboard + tabs
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  await ctx.addInitScript(buildInitScript(true));
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  // Esperar a que renderice el dashboard (main) o el login; capturar igual si falla.
  try {
    await page.waitForSelector("main", { timeout: 30000 });
  } catch {
    console.warn(`[${vp.width}] sin <main> — ¿login o error?`);
  }
  // Quitar el indicador flotante de dev-tools de Next (intercepta clicks en el bottom nav).
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove()).catch(() => {});
  await page.waitForTimeout(600);

  for (const tab of TABS) {
    try {
      const btn = page.getByRole("button", { name: tab.label, exact: false });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: path.join(dir, `${tab.key}.png`) });
      allMetrics.push(await collectMetrics(page, tab.key, vp.width));

      // En móvil, captura también el scroll al fondo del main (listas largas)
      if (vp.width < 1024) {
        await page.evaluate(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTo(0, main.scrollHeight);
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(dir, `${tab.key}-bottom.png`) });
        await page.evaluate(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTo(0, 0);
        });
      }
    } catch (err) {
      console.warn(`[${vp.width}] ${tab.key}: ${err.message}`);
      allMetrics.push({ label: tab.key, viewport: vp.width, error: err.message });
    }
  }

  // Diálogo "Registrar vehículo" solo en 375
  if (vp.width === 375) {
    try {
      await page.getByRole("button", { name: "Autos" }).first().click();
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: "Registrar vehículo" }).first().click();
      await page.waitForTimeout(1100);
      await page.screenshot({ path: path.join(dir, "vehicle-dialog.png") });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch (err) {
      console.warn(`[375] vehicle-dialog: ${err.message}`);
    }
  }

  await ctx.close();
  console.log(`[${vp.width}] sesión capturada`);
}

// Login (solo 375 y 430) — sin sesión, con usuarios sembrados
for (const width of [375, 430]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 932 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(buildInitScript(false));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  try {
    await page.waitForSelector("form", { timeout: 30000 });
  } catch {
    console.warn(`[${width}] login sin <form> — ¿cayó al dashboard o error?`);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, String(width), "login.png") });
  allMetrics.push(await collectMetrics(page, "login", width));
  await ctx.close();
}

await browser.close();

// ------------------------------------------------------------- report (JSON)
fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(allMetrics, null, 2));
console.log("\n--- Métricas de overflow ---");
for (const m of allMetrics) {
  if (m.error) {
    console.log(`${m.viewport}px ${m.label}: ERROR ${m.error}`);
    continue;
  }
  const flags = [];
  if (m.docOverflow) flags.push("DOC-OVERFLOW");
  if (m.mainOverflow) flags.push("MAIN-OVERFLOW");
  const wide = m.tablesWiderThanViewport;
  if (wide.length) flags.push(`TABLAS_ANCHAS(${wide.map((t) => `${t.width}px/${t.cols}col`).join(", ")})`);
  console.log(`${m.viewport}px ${m.label.padEnd(12)} inner=${m.innerWidth} doc=${m.docScrollWidth} main=${m.mainScrollWidth}/${m.mainClientWidth} targets<40=${m.smallTargetCount ?? 0} ${flags.join(" ") || "OK"}`);
}
console.log(`\nCapturas en ${OUT}/`);

async function collectMetrics(page, label, viewport) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector("main");
    const tables = [...document.querySelectorAll("table")].map((t) => ({
      width: Math.round(t.getBoundingClientRect().width),
      cols: t.querySelectorAll("thead th").length,
      visible: !!(t.offsetWidth || t.getClientRects().length),
    }));
    // Targets táctiles < 40px de alto (mínimo recomendado 40–44px)
    const selectors = "button, [role='button'], input, select, textarea, a";
    const small = [];
    for (const el of document.querySelectorAll(selectors)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (r.height < 40 && r.width >= 24) {
        small.push({ tag: el.tagName, h: Math.round(r.height), w: Math.round(r.width), text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 20) });
      }
    }
    // Barra de búsqueda del dashboard (si el flex-wrap la desbordó)
    const searchBar = document.querySelector('[class*="ECECEC"]');
    return {
      docOverflow: doc.scrollWidth > window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      mainOverflow: main ? main.scrollWidth > main.clientWidth : null,
      mainClientWidth: main ? main.clientWidth : null,
      mainScrollWidth: main ? main.scrollWidth : null,
      tablesWiderThanViewport: tables.filter((t) => t.visible && t.width > window.innerWidth).map((t) => t),
      smallTargetCount: small.length,
      smallTargets: small.slice(0, 10),
      searchBarHeight: searchBar ? Math.round(searchBar.getBoundingClientRect().height) : null,
    };
  });
  m.label = label;
  m.viewport = viewport;
  return m;
}
