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
  // Task 10: la barra demo persistente è visibile in demo.
  await expect(page.locator("#demo-bar")).toBeVisible();

  // Reload: il flag demo persiste → si rientra nella demo coi dati.
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#emptyState")).toBeHidden();
  await expect(page.locator("#demo-bar")).toBeVisible();
  expect(errors, "nessun errore nel flusso demo").toEqual([]);
});

test("demo: la barra demo 'registrati' porta all'auth su signup", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#demo-bar")).toBeVisible();

  // "registrati ›" nella barra → nascondi app, mostra auth-screen su tab registrati.
  await page.locator("#demoSignup").click();
  await expect(page.locator("#auth-screen")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();
  expect(errors, "nessun errore nel passaggio demo→signup").toEqual([]);
});

test("demo: Impostazioni mostra il blocco demo e nasconde quello account (Task 11)", async ({ page }) => {
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  // Apri Impostazioni e verifica la VISIBILITÀ REALE (non solo l'attributo hidden:
  // .sv-line ha display:flex che vince su [hidden], quindi serve la classe .hidden).
  await page.evaluate(() => document.getElementById("settingsDialog").showModal());
  await expect(page.locator("#svDemoLine")).toBeVisible();
  await expect(page.locator("#svAccountLine")).toBeHidden();
  await expect(page.locator("#svRecovery")).toBeHidden();
});

test("demo: 'esci dalla demo' su demo pristina torna alla soglia (Task 12)", async ({ page }) => {
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  // Apri Impostazioni e premi "esci": demo == seed (pristina) → esce diretto, niente sheet.
  await page.evaluate(() => document.getElementById("settingsDialog").showModal());
  await page.locator("#btnDemoExit").click();
  await expect(page.getByText(/prova la demo/)).toBeVisible(); // tornati alla soglia
});

test("focus: apre l'esercizio, sheet Altro sale e blocca lo sfondo", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  await page.locator("#list .row").first().click();
  await expect(page.locator("#focusOverlay")).toBeVisible();
  // riga recupero read-only + CTA presenti nel footer
  await expect(page.locator("#focusOverlay .restline")).toBeVisible();
  // apre lo sheet "Altro"
  await page.locator("#focusOverlay .rl-more").click();
  await expect(page.locator("#focusSheet")).toBeVisible();
  await expect(page.locator("#focusScrim")).toBeVisible();
  // chiude toccando lo scrim in alto (lo sheet copre il centro: tap sull'area scura sopra)
  await page.locator("#focusScrim").click({ position: { x: 20, y: 20 } });
  await expect(page.locator("#focusSheet")).toBeHidden();
  expect(errors, "nessun errore nel focus").toEqual([]);
});

test("focus normale: il corpo non scrolla (4 serie da compilare, viewport iPhone)", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  // Il prompt "nuova settimana" si accetta col valore di default (settimana vuota).
  page.on("dialog", (d) => d.accept());

  // Il fit "una videata" si misura sul telefono, non sul desktop 1280x720 di default.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  // Settimana nuova vuota → caso peggiore: pannello + 4 serie da compilare (il seed è già loggato).
  await page.locator("#newWeekBtn").click();

  // Primo esercizio (Panca piana, 4 × 6 → 4 serie target).
  await page.locator("#list .row").first().click();
  await expect(page.locator("#focusOverlay")).toBeVisible();
  // Il corpo deve stare nel viewport: scrollHeight ~ clientHeight (tolleranza 4px).
  const overflow = await page.locator("#focusOverlay .focus-body").evaluate(
    (el) => el.scrollHeight - el.clientHeight
  );
  expect(overflow, "il corpo focus non deve scrollare").toBeLessThanOrEqual(4);
  expect(errors, "nessun errore").toEqual([]);
});

test("focus: lo sfondo (home) resta fermo con il focus aperto", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  // Viewport iPhone: la home è più alta del viewport (scrollabile dietro l'overlay).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  // Lo sfondo dev'essere scrollabile PRIMA di aprire il focus (precondizione del test).
  const docOverflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(docOverflow, "la home deve essere più alta del viewport").toBeGreaterThan(0);

  await page.locator("#list .row").first().click();
  await expect(page.locator("#focusOverlay")).toBeVisible();
  // Con il focus aperto, un tentativo di scroll non deve muovere lo sfondo.
  await page.evaluate(() => window.scrollTo(0, 500));
  const y = await page.evaluate(() => window.scrollY);
  expect(y, "lo sfondo non deve scrollare a focus aperto").toBe(0);

  // Alla chiusura, lo scroll dello sfondo torna libero (nessun blocco residuo).
  await page.locator("#focusBack").click();
  await expect(page.locator("#focusOverlay")).toBeHidden();
  const overflowRestored = await page.evaluate(() => getComputedStyle(document.body).position);
  expect(overflowRestored, "il body non deve restare fixed dopo la chiusura").not.toBe("fixed");
  expect(errors, "nessun errore").toEqual([]);
});

test("focus: durante il recupero pannello e footer si nascondono e il corpo non scrolla", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("dialog", (d) => d.accept());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  await page.locator("#newWeekBtn").click(); // settimana vuota → 4 serie da compilare

  await page.locator("#list .row").first().click();
  await expect(page.locator("#focusOverlay")).toBeVisible();
  // Prima del recupero: il pannello HUD pieno è visibile.
  await expect(page.locator("#focusOverlay .focus-body .panel")).toBeVisible();

  // Avvia il recupero (registra la 1ª serie).
  await page.locator("#focusFoot .cta").click();
  await expect(page.locator("#timerBar")).toBeVisible();

  // Durante il recupero: pannello e footer del focus nascosti (la barra recupero li sostituisce).
  await expect(page.locator("#focusOverlay .focus-body .panel")).toBeHidden();
  await expect(page.locator("#focusFoot")).toBeHidden();
  // E il corpo non sfora (è il caso che prima scrollava).
  const overflow = await page.locator("#focusOverlay .focus-body").evaluate(
    (el) => el.scrollHeight - el.clientHeight
  );
  expect(overflow, "il corpo non deve scrollare durante il recupero").toBeLessThanOrEqual(4);
  expect(errors, "nessun errore").toEqual([]);
});

test("focus superset: tap su traccia ridotta la rende attiva (viewport iPhone)", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("dialog", (d) => d.accept());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText(/prova la demo/).click();
  await expect(page.locator("#app")).toBeVisible();
  await page.locator("#newWeekBtn").click(); // settimana vuota → tracce da compilare

  // Riga del superset (badge "superset"): Day A, "Alzate laterali + Pushdown".
  await page.locator("#list .row", { has: page.locator(".ssbadge") }).first().click();
  await expect(page.locator("#focusOverlay")).toBeVisible();

  // Traccia attiva = A (blocco intero); l'altra è una .trackmini.
  await expect(page.locator("#focusOverlay .track .tA")).toHaveText("A");
  const mini = page.locator("#focusOverlay .trackmini");
  await expect(mini).toHaveCount(1);
  // Il corpo del superset (1 blocco + 1 mini) non scrolla.
  const overflow = await page.locator("#focusOverlay .focus-body").evaluate(
    (el) => el.scrollHeight - el.clientHeight
  );
  expect(overflow, "il corpo superset non deve scrollare").toBeLessThanOrEqual(4);

  // Tap sulla riga ridotta → la traccia B diventa attiva.
  await mini.click();
  await expect(page.locator("#focusOverlay .track .tA")).toHaveText("B");
  expect(errors, "nessun errore").toEqual([]);
});
