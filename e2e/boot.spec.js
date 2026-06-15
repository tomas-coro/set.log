import { test, expect } from "@playwright/test";

const CDN_RE = /esm\.sh|cdn\.jsdelivr|unpkg\.com|skypack/;

test("boot online: soglia montata, niente CDN, niente errori", async ({ page }) => {
  const errors = [];
  const cdnHits = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("request", (r) => { if (CDN_RE.test(r.url())) cdnHits.push(r.url()); });

  await page.goto("/");
  // Sessione assente → soglia "Boot CLI" al posto del muro di login.
  await expect(page.getByText(/prova la demo/)).toBeVisible();
  await expect(page).toHaveTitle("set.log");
  expect(cdnHits, "nessuna richiesta a CDN").toEqual([]);
  expect(errors, "nessun errore console/page").toEqual([]);
});

test("boot offline: la soglia fa boot dalla cache del SW", async ({ page, context }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800); // margine: l'install ha già cachato gli ASSETS

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/prova la demo/)).toBeVisible();
  expect(errors, "nessun errore offline").toEqual([]);
  await context.setOffline(false);
});

test("demo: la soglia entra in demo, l'app mostra il seed e persiste al reload", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("/");
  // "prova la demo" → enterDemo + reload → bootDemo.
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#threshold-screen")).toBeHidden();
  // Il seed ha una scheda → niente empty-state (prova che i dati finti sono caricati).
  await expect(page.locator("#emptyState")).toBeHidden();

  // Reload: il flag demo persiste → si rientra nella demo coi dati.
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#emptyState")).toBeHidden();
  expect(errors, "nessun errore nel flusso demo").toEqual([]);
});
