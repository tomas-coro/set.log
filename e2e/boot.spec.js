import { test, expect } from "@playwright/test";

const CDN_RE = /esm\.sh|cdn\.jsdelivr|unpkg\.com|skypack/;

test("boot online: shell montata, niente CDN, niente errori", async ({ page }) => {
  const errors = [];
  const cdnHits = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("request", (r) => { if (CDN_RE.test(r.url())) cdnHits.push(r.url()); });

  await page.goto("/");
  await expect(page.getByText("autenticazione richiesta")).toBeVisible();
  await expect(page).toHaveTitle("set.log");
  expect(cdnHits, "nessuna richiesta a CDN").toEqual([]);
  expect(errors, "nessun errore console/page").toEqual([]);
});

test("boot offline: l'app fa boot dalla cache del SW", async ({ page, context }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800); // margine: l'install ha già cachato gli ASSETS

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("autenticazione richiesta")).toBeVisible();
  expect(errors, "nessun errore offline").toEqual([]);
  await context.setOffline(false);
});
