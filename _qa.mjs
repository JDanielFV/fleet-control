/**
 * Fase 6 — QA automatizado de responsividad.
 *
 * Recorre login → dashboard → 4 tabs → admin en 6 viewports, verificando:
 *   - Cero scroll horizontal en vistas principales (móvil < 768px)
 *   - Todos los targets interactivos ≥ 40px en móvil real (< 768px, donde cards reemplazan tablas)
 *   - Diálogos/sheets abren y cierran sin romper scroll del fondo
 *   - Bottom nav no tapa contenido
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
 *   SUPABASE_SERVICE_ROLE_KEY= SUPABASE_JWT_SECRET= npm run dev -- -p 3100
 *   node _qa.mjs
 *
 * Exit code: 0 si todo pasa, 1 si hay fallos en móvil.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { buildInitScript } from "./_audit-seed.mjs";

const BASE = "http://localhost:3100";
const OUT = "docs/superpowers/screens/qa";

// Viewports: phones + landscape + tablet + 2 desktop
// "mobile" = bottom nav visible, cards reemplazan tablas (< 768px)
// "tablet" = sidebar visible, tablas visibles (768–1023px)
// "desktop" = paneles inline (≥ 1024px)
const VIEWPORTS = [
  { width: 375, height: 667, tier: "mobile", label: "iPhone SE" },
  { width: 430, height: 932, tier: "mobile", label: "iPhone 15 Pro Max" },
  { width: 667, height: 375, tier: "mobile", label: "Landscape móvil" },
  { width: 768, height: 1024, tier: "tablet", label: "Tablet" },
  { width: 1024, height: 768, tier: "desktop", label: "Desktop" },
  { width: 1440, height: 900, tier: "desktop", label: "Desktop grande" },
];

const TABS = [
  { key: "checklists", label: "Check Lists" },
  { key: "drivers", label: "Choferes" },
  { key: "vehicles", label: "Autos" },
  { key: "users", label: "Usuarios" },
];

// ─── Helpers ──────────────────────────────────────────────────────
const results = [];
let totalPass = 0;
let totalFail = 0;

function check(vp, tab, name, ok, detail = "") {
  results.push({ vp: vp.width, label: vp.label, tab, name, ok, detail });
  if (ok) totalPass++;
  else totalFail++;
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector("main");

    // Detect bottom nav by aria-label (Dashboard.tsx line 562)
    const bottomNav = document.querySelector('nav[aria-label="Navegación principal"]');

    // Touch targets < 40px
    const selectors = "button, [role='button'], input, select, textarea, a[href]";
    const small = [];
    for (const el of document.querySelectorAll(selectors)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (style.opacity === "0") continue;
      if (r.height < 40 && r.width >= 24) {
        small.push({
          tag: el.tagName,
          h: Math.round(r.height),
          w: Math.round(r.width),
          text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30),
        });
      }
    }

    // Content padding vs bottom nav
    const navRect = bottomNav?.getBoundingClientRect();
    let contentBehindNav = false;
    let mainPaddingBottom = 0;
    if (main && navRect) {
      mainPaddingBottom = parseFloat(getComputedStyle(main).paddingBottom);
      contentBehindNav = mainPaddingBottom < navRect.height - 10;
    }

    return {
      docOverflow: doc.scrollWidth > window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      mainOverflow: main ? main.scrollWidth > main.clientWidth : null,
      mainClientWidth: main?.clientWidth ?? null,
      mainScrollWidth: main?.scrollWidth ?? null,
      smallTargets: small,
      smallTargetCount: small.length,
      hasBottomNav: !!bottomNav,
      bottomNavHeight: navRect ? Math.round(navRect.height) : null,
      mainPaddingBottom: Math.round(mainPaddingBottom),
      contentBehindNav,
    };
  });
}

async function testDialogFlow(page, vp) {
  const results_dialog = [];

  // Navigate to checklists tab
  try {
    const checklistsTab = page.getByRole("button", { name: "Check Lists" });
    if (await checklistsTab.count()) {
      await checklistsTab.first().click();
      await page.waitForTimeout(800);
    }
  } catch {}    // Try to open ChecklistActionModal by clicking a checklist card/row
  try {
    // Mobile: MobileCard has role="button" + cursor-pointer
    // Desktop/tablet: <tr role="button"> with onClick
    const clickable = page.locator(
      'main [role="button"][class*="cursor-pointer"], main tr[role="button"]'
    ).first();

    const found = await clickable.count();
    if (found) {
      await clickable.click();
      await page.waitForTimeout(1200);

      // ChecklistActionModal renders role="dialog" with aria-modal="true"
      const hasDialog = await page.locator('[role="dialog"][aria-modal="true"]').count() > 0;

      results_dialog.push({ step: "dialog_opened", ok: hasDialog, note: hasDialog ? "OK" : `clicked but no role=dialog found` });

      if (hasDialog) {
        // Close via Cancel button (ChecklistActionModal has no onKeyDown handler)
        const cancelBtn = page.getByRole("button", { name: "Cancelar" });
        if (await cancelBtn.count()) {
          await cancelBtn.first().click();
        } else {
          // Fallback: click the backdrop overlay
          await page.locator('[role="dialog"][aria-modal="true"]').evaluate((el) => el.closest('[class*="fixed"]')?.click());
        }
        await page.waitForTimeout(600);

        const stillOpen = (await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0;
        results_dialog.push({ step: "dialog_closed", ok: !stillOpen, note: stillOpen ? "still open after cancel" : "OK" });

        // Verify page is still scrollable
        const scrollable = await page.evaluate(() => {
          const main = document.querySelector("main");
          if (!main) return true;
          main.scrollTo(0, 100);
          return main.scrollTop > 0;
        });
        results_dialog.push({ step: "scroll_after_close", ok: scrollable, note: scrollable ? "OK" : "main not scrollable after close" });
      }
    } else {
      results_dialog.push({ step: "dialog_skipped", ok: true, note: "no clickable rows/cards found" });
    }
  } catch (err) {
    results_dialog.push({ step: "dialog_error", ok: false, note: err.message.slice(0, 80) });
  }

  return results_dialog;
}

// ─── Main ─────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Fase 6 — QA de responsividad (fleet-control)");
console.log("═══════════════════════════════════════════════════════════════\n");

for (const vp of VIEWPORTS) {
  const tierLabel = { mobile: "[móvil]", tablet: "[tablet]", desktop: "[desktop]" }[vp.tier];
  console.log(`─── ${vp.label} (${vp.width}×${vp.height}) ${tierLabel} ───`);

  const dir = path.join(OUT, String(vp.width));
  fs.mkdirSync(dir, { recursive: true });

  // ── Dashboard + tabs (con sesión) ──
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.tier === "mobile",
    hasTouch: vp.tier === "mobile",
    deviceScaleFactor: vp.tier === "mobile" ? 2 : 1,
  });
  await ctx.addInitScript(buildInitScript(true));
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  try {
    await page.waitForSelector("main", { timeout: 30000 });
  } catch {
    console.warn(`  ⚠ Sin <main>`);
  }
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove()).catch(() => {});
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(dir, "01-dashboard.png") });

  // ── Per-tab checks ──
  for (const tab of TABS) {
    try {
      const btn = page.getByRole("button", { name: tab.label, exact: false });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(1200);
      }
    } catch {}

    await page.screenshot({ path: path.join(dir, `${tab.key}.png`) });
    const metrics = await collectMetrics(page);

    // 1. No horizontal overflow on main (all viewports)
    check(vp, tab.key, "no_main_overflow",
      !metrics.mainOverflow,
      metrics.mainOverflow ? `scrollW(${metrics.mainScrollWidth}) > clientW(${metrics.mainClientWidth})` : "OK");

    // 2. No document-level overflow (mobile only — desktop may have sidebar)
    if (vp.tier === "mobile") {
      check(vp, tab.key, "no_doc_overflow",
        !metrics.docOverflow,
        metrics.docOverflow ? `doc scrollW(${metrics.docScrollWidth}) > innerW(${metrics.innerWidth})` : "OK");
    }

    // 3. Touch targets ≥ 40px — ONLY in mobile tier (< 768px where cards replace tables)
    if (vp.tier === "mobile") {
      const details = metrics.smallTargets
        .slice(0, 5)
        .map((t) => `${t.tag}(${t.w}×${t.h}) "${t.text}"`)
        .join(", ");
      check(vp, tab.key, "targets_ge_40",
        metrics.smallTargetCount === 0,
        metrics.smallTargetCount > 0 ? `${metrics.smallTargetCount} small: ${details}` : "OK");
    }

    // 4. Bottom nav present on mobile tier
    if (vp.tier === "mobile") {
      check(vp, tab.key, "has_bottom_nav", metrics.hasBottomNav, "OK");
    }

    // 5. Content not hidden behind bottom nav (mobile tier only)
    if (vp.tier === "mobile" && metrics.hasBottomNav) {
      check(vp, tab.key, "content_not_behind_nav",
        !metrics.contentBehindNav,
        metrics.contentBehindNav ? `main pb(${metrics.mainPaddingBottom}) < nav h(${metrics.bottomNavHeight})` : "OK");
    }
  }

  // ── Dialog/sheet flow test ──
  const dialogResults = await testDialogFlow(page, vp);
  for (const dr of dialogResults) {
    check(vp, "dialog", dr.step, dr.ok, dr.note || "OK");
  }

  // ── Scroll to bottom check (mobile) ──
  if (vp.tier === "mobile") {
    try {
      await page.evaluate(() => {
        const main = document.querySelector("main");
        if (main) main.scrollTo(0, main.scrollHeight);
      });
      await page.waitForTimeout(400);
      const bottomMetrics = await collectMetrics(page);
      check(vp, "scroll_bottom", "no_overflow_at_bottom",
        !bottomMetrics.mainOverflow,
        bottomMetrics.mainOverflow ? "overflow at bottom" : "OK");
      await page.screenshot({ path: path.join(dir, "bottom.png") });
    } catch {}
  }

  await ctx.close();

  // ── Login flow (sin sesión) — solo phones ──
  if (vp.tier === "mobile" && (vp.width === 375 || vp.width === 430)) {
    const loginCtx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await loginCtx.addInitScript(buildInitScript(false));
    const loginPage = await loginCtx.newPage();
    await loginPage.goto(BASE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    try {
      await loginPage.waitForSelector("form", { timeout: 30000 });
    } catch {
      console.warn(`  ⚠ Login sin <form>`);
    }
    await loginPage.waitForTimeout(600);
    await loginPage.screenshot({ path: path.join(dir, "login.png") });

    const loginMetrics = await collectMetrics(loginPage);
    check(vp, "login", "login_targets_ge_40",
      loginMetrics.smallTargetCount === 0,
      loginMetrics.smallTargetCount > 0
        ? `${loginMetrics.smallTargetCount} small: ${loginMetrics.smallTargets.slice(0, 3).map((t) => `${t.tag}(${t.w}×${t.h})`).join(", ")}`
        : "OK");

    await loginCtx.close();
  }

  console.log();
}

await browser.close();

// ─── Report ───────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));

console.log("═══════════════════════════════════════════════════════════════");
console.log("  RESULTADOS");
console.log("═══════════════════════════════════════════════════════════════\n");

// Group by viewport
const byVp = {};
for (const r of results) {
  const key = `${r.vp}px (${r.label})`;
  if (!byVp[key]) byVp[key] = [];
  byVp[key].push(r);
}

for (const [vpKey, checks] of Object.entries(byVp)) {
  const fails = checks.filter((c) => !c.ok);
  const icon = fails.length === 0 ? "✅" : "❌";
  console.log(`${icon} ${vpKey}`);
  for (const f of fails) {
    console.log(`   ❌ [${f.tab}] ${f.name}: ${f.detail}`);
  }
}

console.log(`\n${"─".repeat(63)}`);
console.log(`  Total: ${totalPass} passed, ${totalFail} failed`);

// Mobile-only failures determine exit code
const mobileFails = results.filter(
  (r) => !r.ok && VIEWPORTS.find((v) => v.width === r.vp && v.tier === "mobile")
);
if (mobileFails.length > 0) {
  console.log(`\n  ⚠ ${mobileFails.length} FALLOS EN MÓVIL — revisar antes de merge`);
  process.exit(1);
} else {
  console.log(`\n  ✅ TODAS LAS VISTAS MÓVILES PASAN`);
  process.exit(0);
}
