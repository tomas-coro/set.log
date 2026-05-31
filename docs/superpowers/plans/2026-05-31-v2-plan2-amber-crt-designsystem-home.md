# V2 Piano 2 — Design system Amber CRT + Home pilota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicare il design system "Amber CRT" (palette + monospace + chrome da terminale) all'app-shell e alla schermata Home come pilota, con due toggle effetti (glow/scanline) off di default, validando il tema su device reale prima di rifare le altre schermate (Piano 3).

**Architecture:** La palette attuale è già scura+ambra: il cambio d'identità è (a) font monospace globale, (b) ri-mappatura dei *valori* delle CSS custom property su `:root` mantenendo i *nomi* (così ogni schermata si ri-colora con churn minimo), (c) chrome da terminale sulla Home (status bar, prompt `$`, box telemetria), (d) un layer effetti CRT opzionale. Gli effetti glow/scanline sono gestiti da un modulo puro `fx.js` (testabile) che commuta due classi (`fx-glow`/`fx-scan`) sul `body`. Default = "sobrio" (nessuna classe). Le schermate non ancora ridisegnate (focus/logging, timer, editor, calendario, impostazioni, progressione, nutrizione) restano funzionanti ed ereditano i nuovi colori; la loro rifinitura di layout è Piano 3.

**Tech Stack:** Vanilla JS (ESM), CSS custom properties, `node --test` (ESM, `node:assert/strict`), service worker cache versionata. Nessuna libreria nuova, nessun web-font (PWA offline → stack monospace di sistema).

**Riferimenti:**
- Spec: `docs/superpowers/specs/2026-05-31-v2-terminal-restyle-design.md` (§3 design system, §4 schermate, §12 build sequence — questo piano = passo 2).
- Mockup approvati: `mockups/v2-amber-crt/home.html` (Home + Esercizio), `mockups/v2-amber-crt/compare.html` (default sobrio = variante B).

**Server di anteprima per la verifica visiva:** un server statico è già attivo su `http://localhost:8123/` con root `C:\Users\TomasCoro\gym-schedule`. Se non risponde, riavviarlo: `Start-Process -WindowStyle Hidden python -ArgumentList "-m","http.server","8123"` dalla cartella del progetto. L'app reale richiede login Supabase: per la verifica visiva della *Home* si usa il mockup come riferimento e si controlla l'app reale dove possibile; la verifica E2E mobile completa resta a carico dell'utente.

---

## File Structure

- **Create `fx.js`** — modulo puro preferenze effetti CRT (glow/scanline). Una sola responsabilità: leggere/scrivere le due pref booleane e applicarne le classi su un root. Nessun import. Testabile in isolamento.
- **Create `tests/fx.test.js`** — test del modulo `fx.js`.
- **Modify `index.html`** — togliere il `<link>` Google Fonts; aggiungere la status bar in cima a `#homeMain`; aggiungere due righe toggle (glow/scanline) nel dialog impostazioni; spostare `#status` dentro la status bar.
- **Modify `style.css`** — ri-mappa `:root` su palette Amber CRT (nomi invariati), font monospace globale, layer effetti CRT (`body.fx-glow`/`body.fx-scan`), componente `.sbar`, restyle componenti Home (kicker/h1/day-tabs/week-row/prog/.item/.volcard).
- **Modify `app.js`** — import `fx.js`; `applyFx` al boot; nel dialog impostazioni: caricare lo stato dei due toggle in apertura e applicarli live al `change`.
- **Modify `sw.js`** — bump versione cache (asset cambiati).

Ogni task produce un cambiamento autocontenuto e committabile.

---

## Task 1: Modulo `fx.js` (preferenze effetti CRT) — TDD

**Files:**
- Create: `fx.js`
- Test: `tests/fx.test.js`

Pattern di storage = identico alle altre impostazioni locali (`gymsched_bar`, `gymsched_plates`, `gymsched_notify` in `app.js:528-532`): chiavi `localStorage` globali, valori `"1"`/`"0"`. Default assente ⇒ `false` (sobrio).

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/fx.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getFx, setFx, applyFx, FX } from "../fx.js";

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
function fakeRoot() {
  const set = new Set();
  return {
    classList: {
      toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
      contains: (c) => set.has(c),
    },
    _set: set,
  };
}

test("getFx default è false (sobrio) quando nulla è salvato", () => {
  const s = fakeStorage();
  assert.equal(getFx(s, "glow"), false);
  assert.equal(getFx(s, "scan"), false);
});

test("setFx persiste '1'/'0' e getFx lo rilegge", () => {
  const s = fakeStorage();
  setFx(s, "glow", true);
  assert.equal(s.getItem(FX.glow.key), "1");
  assert.equal(getFx(s, "glow"), true);
  setFx(s, "glow", false);
  assert.equal(s.getItem(FX.glow.key), "0");
  assert.equal(getFx(s, "glow"), false);
});

test("getFx con nome sconosciuto è false e setFx è no-op", () => {
  const s = fakeStorage();
  assert.equal(getFx(s, "bogus"), false);
  setFx(s, "bogus", true); // non deve lanciare
  assert.equal(s._map.size, 0);
});

test("applyFx aggiunge solo le classi delle pref attive", () => {
  const s = fakeStorage({ gymsched_fx_scan: "1" });
  const root = fakeRoot();
  applyFx(root, s);
  assert.equal(root.classList.contains("fx-scan"), true);
  assert.equal(root.classList.contains("fx-glow"), false);
});

test("applyFx rimuove le classi quando le pref tornano false", () => {
  const s = fakeStorage({ gymsched_fx_glow: "1" });
  const root = fakeRoot();
  applyFx(root, s);
  assert.equal(root.classList.contains("fx-glow"), true);
  setFx(s, "glow", false);
  applyFx(root, s);
  assert.equal(root.classList.contains("fx-glow"), false);
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisce**

Run: `node --test tests/fx.test.js`
Expected: FAIL — `Cannot find module '../fx.js'` (il modulo non esiste ancora).

- [ ] **Step 3: Implementare il modulo minimale**

Create `fx.js`:

```js
// fx.js — preferenze effetti visivi CRT (glow, scanline).
// Off di default (look "sobrio", deciso nei mockup v2-amber-crt/compare.html).
// Persistite su localStorage globale, stesso pattern delle altre impostazioni
// locali (gymsched_bar / gymsched_plates / gymsched_notify in app.js).

export const FX = {
  glow: { key: "gymsched_fx_glow", cls: "fx-glow" },
  scan: { key: "gymsched_fx_scan", cls: "fx-scan" },
};

// Legge una preferenza fx; default false (sobrio) se assente o nome ignoto.
export function getFx(storage, name) {
  const def = FX[name];
  if (!def) return false;
  return storage.getItem(def.key) === "1";
}

// Scrive una preferenza fx (bool). No-op su nome ignoto.
export function setFx(storage, name, on) {
  const def = FX[name];
  if (!def) return;
  storage.setItem(def.key, on ? "1" : "0");
}

// Applica/rimuove le classi fx sul root in base alle preferenze salvate.
export function applyFx(root, storage) {
  for (const name of Object.keys(FX)) {
    root.classList.toggle(FX[name].cls, getFx(storage, name));
  }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passa**

Run: `node --test tests/fx.test.js`
Expected: PASS — 5 test verdi.

- [ ] **Step 5: Commit**

```bash
git add fx.js tests/fx.test.js
git commit -m "feat(fx): modulo preferenze effetti CRT (glow/scanline) off di default"
```

---

## Task 2: Tokens design system Amber CRT in `style.css` + drop web-font

Ri-mappa i *valori* delle custom property mantenendo i *nomi* (churn minimo: ogni schermata si ri-colora) e passa al monospace di sistema. Questo task è solo "fondamenta" — la Home prende forma nei Task 3-4.

**Files:**
- Modify: `style.css:1-13` (blocco `:root` + `body`)
- Modify: `index.html:8-10` (rimozione `<link>` Google Fonts)

- [ ] **Step 1: Sostituire il blocco `:root` (style.css:1-6)**

Rimpiazza le righe 1-6 (`:root{ ... }`) con:

```css
:root{
  /* Amber CRT — palette V2 (mockups/v2-amber-crt). Nomi invariati per churn minimo. */
  --bg:#0c0a06;        /* near-black caldo            */
  --surf:#16120a;      /* superfici / box             */
  --surf2:#1a150c;     /* superfici alternate         */
  --line:#2a2012;      /* bordi                       */
  --ink:#cdb27a;       /* testo base (sobrio)         */
  --tx:#f0dca0;        /* testo in evidenza / titoli  */
  --dim:#6a5733;       /* meta / attenuato            */
  --faint:#5a4a2a;     /* molto attenuato             */
  --acc:#ffd36b;       /* accento azioni (giallo-oro) */
  --acc-ink:#1a1305;   /* testo su accento            */
  --ac2:#e0a04a;       /* accento dati / telemetria   */
  --ok:#9fd08a;        /* serie ok / done             */
  --down:#e0705a;      /* warn / errori (rosso caldo) */
  --field:#100c06;     /* sfondi input / stepper      */
  --ctb:#2a1f08;       /* sfondo CTA                  */
  --ctc:#4a3712;       /* bordo CTA                   */
  --mono:ui-monospace,"SF Mono","Cascadia Mono",Consolas,"JetBrains Mono",monospace;
  --glow1:none;        /* attivato da body.fx-glow (Task 4) */
}
```

(I nomi `--acc`, `--ink`, `--dim`, `--line`, `--surf`, `--surf2`, `--field`, `--acc-ink`, `--ok`, `--down`, `--faint` esistono già ovunque: cambiarne il valore aggiorna tutta l'app. `--tx`, `--ac2`, `--ctb`, `--ctc`, `--mono`, `--glow1` sono nuovi, usati dai Task 3-4.)

- [ ] **Step 2: Impostare il font monospace globale (style.css:9-10)**

Sostituisci la regola `body{...}` (righe 9-10) con:

```css
body{background:#000;color:var(--ink);font-family:var(--mono);
  display:flex;justify-content:center;min-height:100vh;font-size:15px;line-height:1.45;}
```

(Le numerose regole `font-family:"JetBrains Mono",monospace` esistenti continuano a funzionare: JetBrains non viene più scaricato e ricade sul monospace di sistema — stessa famiglia del resto dell'app. Nessun'altra modifica font necessaria.)

- [ ] **Step 3: Rimuovere il web-font da index.html (index.html:8-10)**

Cancella le tre righe (8-10):

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Aggiorna anche `<meta name="theme-color" content="#100E0A">` (riga 6) in:

```html
  <meta name="theme-color" content="#0c0a06">
```

- [ ] **Step 4: Verifica test invariati**

Run: `node --test`
Expected: PASS — tutti i test verdi (nessun test dipende dai colori; conferma che non si è rotto nulla a livello di modulo). Atteso ~254 test (249 preesistenti + 5 di Task 1).

- [ ] **Step 5: Verifica visiva rapida (no regressioni strutturali)**

Apri `http://localhost:8123/mockups/v2-amber-crt/home.html` per riferimento. La verifica reale della Home avviene nei Task 3-4; qui basta confermare che l'app reale carica senza errori console e che testo/sfondi sono ora ambra su near-black con font monospace. Annota eventuali contrasti illeggibili.

- [ ] **Step 6: Commit**

```bash
git add style.css index.html
git commit -m "feat(theme): tokens Amber CRT + monospace di sistema, drop Google Fonts"
```

---

## Task 3: Layer effetti CRT (glow/scanline) + wiring boot/impostazioni

Aggiunge il layer effetti gated dalle classi `body.fx-glow`/`body.fx-scan`, li collega al boot e a due nuovi toggle in Impostazioni. Default = nessuna classe = sobrio.

**Files:**
- Modify: `style.css` (append: regole `body.fx-glow` / `body.fx-scan`)
- Modify: `index.html` (due righe toggle dopo la card "Notifica a fine recupero", ~riga 147)
- Modify: `app.js` (import `fx.js`; `applyFx` al boot vicino a `new ProfileStorage(...)` riga ~2278; load+change nei dintorni di `openSettings`/notifyToggle, righe 2093-2127)

- [ ] **Step 1: Aggiungere il CSS del layer effetti (append in fondo a style.css)**

```css
/* ===== Effetti CRT — off di default, gestiti da fx.js (classi su body) ===== */
body.fx-glow{ --glow1:0 0 5px #ffd36b44; }
body.fx-glow .kicker b,
body.fx-glow h1::before,
body.fx-glow .day-tabs button.on,
body.fx-glow .sbar .l{ text-shadow:var(--glow1); }

body.fx-scan::after{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:60;
  background:repeating-linear-gradient(to bottom,#0000 0 2px,#00000012 2px 3px);
}
```

(`h1::before` è il prompt `$` introdotto nel Task 4; la regola glow lo copre già.)

- [ ] **Step 2: Aggiungere i due toggle in Impostazioni (index.html)**

Dopo la `<section class="sv-card sv-toggle-card">` della notifica (che termina alla riga 147 con `</section>`), e *prima* di `<details class="sv-card sv-details">` (riga 149), inserisci:

```html
          <section class="sv-card sv-toggle-card">
            <label class="sv-toggle">
              <span class="sv-toggle-ic">✦</span>
              <span class="sv-toggle-lbl">Bagliore (glow)</span>
              <span class="sv-switch">
                <input type="checkbox" id="fxGlowToggle">
                <span class="sv-switch-track"></span>
              </span>
            </label>
          </section>

          <section class="sv-card sv-toggle-card">
            <label class="sv-toggle">
              <span class="sv-toggle-ic">▤</span>
              <span class="sv-toggle-lbl">Scanline CRT</span>
              <span class="sv-switch">
                <input type="checkbox" id="fxScanToggle">
                <span class="sv-switch-track"></span>
              </span>
            </label>
          </section>
```

(Riusa lo stile esistente `.sv-toggle`/`.sv-switch` del toggle notifica — nessun CSS nuovo per i toggle.)

- [ ] **Step 3: Importare fx.js e applicarlo al boot (app.js)**

In cima a `app.js`, accanto agli altri import ESM, aggiungi:

```js
import { getFx, setFx, applyFx } from "./fx.js";
```

Subito dopo la riga `profileStorage = new ProfileStorage(localStorage, session.user.id);` (riga ~2278), aggiungi:

```js
    applyFx(document.body, localStorage);
```

- [ ] **Step 4: Caricare lo stato dei toggle all'apertura impostazioni (app.js)**

Dentro `openSettings = () => { ... }` (righe 2093-2103), dopo la riga
`document.getElementById("notifyToggle").checked = notifyOn();` (riga 2097), aggiungi:

```js
    document.getElementById("fxGlowToggle").checked = getFx(localStorage, "glow");
    document.getElementById("fxScanToggle").checked = getFx(localStorage, "scan");
```

- [ ] **Step 5: Applicare i toggle live al change (app.js)**

Dopo il blocco `document.getElementById("notifyToggle").addEventListener("change", ...)` (che termina alla riga 2127), aggiungi:

```js
  document.getElementById("fxGlowToggle").addEventListener("change", (e) => {
    setFx(localStorage, "glow", e.target.checked);
    applyFx(document.body, localStorage);
  });
  document.getElementById("fxScanToggle").addEventListener("change", (e) => {
    setFx(localStorage, "scan", e.target.checked);
    applyFx(document.body, localStorage);
  });
```

(Applicazione immediata: l'utente vede l'effetto senza dover salvare/chiudere, come il toggle notifiche. La persistenza è già su `localStorage` via `setFx`, indipendente dal `save` del dialog.)

- [ ] **Step 6: Verifica test invariati**

Run: `node --test`
Expected: PASS — tutti verdi (le modifiche app.js sono DOM-side, non coperte da unit test; i 5 test fx restano verdi).

- [ ] **Step 7: Verifica visiva degli effetti**

Con il server attivo, apri l'app reale e Impostazioni: attiva "Bagliore" → gli accenti devono prendere un alone; attiva "Scanline" → righe orizzontali leggerissime sopra l'app; disattiva entrambi → look sobrio identico a prima. Ricaricando la pagina lo stato deve persistere. (Se non puoi loggare nell'app reale, verifica almeno che `applyFx` non lanci e che le classi compaiano su `document.body` via DevTools toggle manuale `document.body.classList.add('fx-scan')`.)

- [ ] **Step 8: Commit**

```bash
git add style.css index.html app.js
git commit -m "feat(fx): layer CRT glow/scanline + toggle Impostazioni + apply al boot"
```

---

## Task 4: Chrome da terminale + restyle Home (pilota)

Status bar in cima alla Home, prompt `$` sul titolo, day-tabs come chip, righe esercizio come box telemetria, volume come cella telemetria. Solo CSS + piccoli ritocchi di markup; **nessuna modifica ai builder JS** (`renderList`/`renderProgress`/`buildVolumeRow` restano invariati: si re-skinnano le classi esistenti). Riferimento: `mockups/v2-amber-crt/home.html` (sinistra).

**Files:**
- Modify: `index.html` (status bar in cima a `#homeMain`; spostare `#status` nella status bar)
- Modify: `style.css` (componente `.sbar`; restyle `.kicker`/`h1`/`.day-tabs`/`.week-row`/`#weekSelect`/`.prog`/`.item`/`.volcard`)

- [ ] **Step 1: Aggiungere la status bar e spostare #status (index.html)**

In `#homeMain` (che inizia a riga 72), subito dopo `<div id="homeMain">` inserisci come **primo figlio**:

```html
    <div class="sbar" id="homeSbar">
      <span class="l">◈ HOME</span>
      <span class="r"><span id="status" class="status">—</span></span>
    </div>
```

Poi **rimuovi** `#status` dalla sua posizione attuale dentro `.week-row` (riga 85): cancella la riga
`<span id="status" class="status">—</span>`.
(L'`id="status"` è preservato nella nuova posizione: tutti i riferimenti JS `getElementById("status")` continuano a funzionare.)

- [ ] **Step 2: CSS componente status bar (append in style.css)**

```css
/* ===== Status bar (chrome terminale) ===== */
.sbar{
  display:flex; justify-content:space-between; align-items:center;
  font-family:var(--mono); font-size:10px; letter-spacing:.08em;
  color:var(--dim); padding:7px 10px; margin:-4px -4px 12px;
  border:1px solid var(--line); border-radius:8px; background:#0e0b07;
}
.sbar .l{ color:var(--ac2); }
.sbar .r{ display:flex; align-items:center; gap:8px; }
```

- [ ] **Step 3: Restyle kicker + titolo con prompt (append in style.css)**

```css
/* ===== Home: header con prompt ===== */
.kicker{ color:var(--dim); }
.kicker b{ color:var(--acc); }
h1{ font-family:var(--mono); font-size:22px; font-weight:700; letter-spacing:0;
  color:var(--tx); margin:6px 0 0; }
h1::before{ content:"$ "; color:var(--ac2); font-weight:700; }
```

(Override mirati: vincono per ordine/cascade essendo in fondo al file. `h1` esistente — riga 20 — resta ma viene sovrascritto.)

- [ ] **Step 4: Restyle day-tabs come chip (append in style.css)**

```css
/* ===== Home: day-tabs come chip ===== */
.day-tabs button{
  flex:0 1 auto; min-width:48px; border-radius:7px; padding:7px 14px;
  background:transparent; border:1px solid var(--line); color:var(--ink);
  font-size:13px; font-weight:500;
}
.day-tabs button.on{
  background:var(--ctb); border-color:var(--ctc); color:var(--acc);
}
```

- [ ] **Step 5: Restyle week-row + select (append in style.css)**

```css
/* ===== Home: week-row ===== */
.week-row{ gap:8px; }
#weekSelect{ flex:0 1 auto; border-radius:7px; background:var(--surf);
  border-color:var(--line); color:var(--tx); padding:7px 12px; }
.btn-soft{ border-radius:7px; background:var(--ctb); border-color:var(--ctc);
  color:var(--acc); }
```

- [ ] **Step 6: Restyle progress bar (append in style.css)**

```css
/* ===== Home: progress ===== */
.prog .seg{ height:4px; background:var(--line); }
.prog .seg.done{ background:var(--ac2); }
.prog .seg.cur{ background:var(--acc); }
.prog .lbl{ color:var(--dim); }
```

- [ ] **Step 7: Restyle righe esercizio come box (append in style.css)**

Le righe sono `.item > .r > (.id, .mid > (.nm, .sub), .right > (.best/.bl|.chk), .caret)` (vedi `renderList` app.js:1883-1934).

```css
/* ===== Home: righe esercizio come box telemetria ===== */
#list{ margin-top:12px; }
.item{ background:var(--surf); border:1px solid var(--line); border-radius:8px;
  margin-bottom:9px; }
.item.open{ border-color:var(--ctc); }
.item .r{ display:flex; align-items:center; gap:10px; padding:11px 12px; cursor:pointer; }
.item .r .id{ font-family:var(--mono); font-size:12px; color:var(--dim); min-width:20px; }
.item .mid{ flex:1; min-width:0; }
.item .nm{ color:var(--tx); font-size:14px; }
.item .sub{ font-family:var(--mono); font-size:11px; color:var(--ink); margin-top:4px; }
.item .sub .ult{ color:var(--ac2); }
.item .right{ text-align:right; font-family:var(--mono); }
.item .right .best{ color:var(--tx); font-size:13px; }
.item .right .bl{ color:var(--dim); font-size:9px; letter-spacing:.1em; text-transform:uppercase; }
.item .right .chk{ color:var(--ok); font-size:16px; }
.item .caret{ color:var(--dim); font-size:12px; }
.item.done{ opacity:.85; }
```

- [ ] **Step 8: Restyle riga volume come telemetria (append in style.css)**

La riga è `.volcard > (.vl, .vright > (.vv, .vsub?, .vcaret))` (vedi `buildVolumeRow` app.js:899-925).

```css
/* ===== Home: volume telemetria ===== */
.volcard{ display:flex; justify-content:space-between; align-items:center;
  background:var(--surf); border:1px solid var(--line); border-radius:8px;
  padding:10px 12px; margin-top:12px; cursor:pointer; }
.volcard .vl{ font-family:var(--mono); font-size:9px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--dim); }
.volcard .vv{ font-family:var(--mono); font-size:16px; color:var(--tx); }
.volcard .vsub{ font-family:var(--mono); font-size:10px; color:var(--dim); margin-left:8px; }
.volcard .vsub .acc{ color:var(--ok); }
.volcard .vsub .neg{ color:var(--down); }
.volcard .vcaret{ color:var(--ac2); margin-left:8px; }
```

- [ ] **Step 9: Verifica test invariati**

Run: `node --test`
Expected: PASS — tutti verdi (solo CSS + markup statico; nessun modulo toccato).

- [ ] **Step 10: Verifica visiva contro il mockup**

Con il server attivo: apri il mockup `http://localhost:8123/mockups/v2-amber-crt/home.html` e l'app reale affiancati. La Home reale deve mostrare: status bar `◈ HOME` + pill sync a destra; kicker `DAY A · …`; titolo con prompt `$`; chip giorni A/B/C (attivo = box accento); selettore settimana a box; barra avanzamento ambra; righe esercizio come box (numero · nome · target/ult · best/✓); cella volume telemetria. Confronta proporzioni e leggibilità. Annota differenze e correggi i valori CSS finché coerente col mockup (lo *spirito* del mockup, non pixel-perfect; sparkline e bottone `› log` per-riga sono volutamente rimandati al Piano 3).

- [ ] **Step 11: Commit**

```bash
git add index.html style.css
git commit -m "feat(home): chrome terminale (status bar, prompt) + restyle box telemetria"
```

---

## Task 5: Bump cache SW + verifica finale + push

**Files:**
- Modify: `sw.js` (versione cache)

- [ ] **Step 1: Bump della versione cache**

Apri `sw.js`, individua la costante della versione cache (attualmente `gymsched-v43`):

Run (per localizzare): `Select-String -Path sw.js -Pattern "gymsched-v"`

Cambia `gymsched-v43` → `gymsched-v44`.

- [ ] **Step 2: Suite completa verde**

Run: `node --test`
Expected: PASS — 0 fail. Atteso ~254 test (249 preesistenti + 5 fx). Annota il numero esatto.

- [ ] **Step 3: Verifica console pulita**

Con il server attivo, ricarica l'app reale: nessun errore in console (in particolare nessun 404 da Google Fonts rimosso, nessun errore di import `fx.js`).

- [ ] **Step 4: Commit + push**

```bash
git add sw.js
git commit -m "chore(sw): bump cache v44 per Piano 2 V2 (design system Amber CRT + Home)"
git fetch origin
git pull --ff-only
git push
```

- [ ] **Step 5: Aggiornare la memoria di progetto**

Aggiorna `gym-schedule-v2-restyle.md` nella memory: Piano 2 (design system Amber CRT + Home pilota + toggle glow/scanline) FATTO; resta Piano 3 (restyle schermo-per-schermo: focus/logging, timer, editor, calendario, impostazioni, progressione, nutrizione) + verifica E2E mobile. Segna il nuovo HEAD e cache v44.

---

## Self-Review

**Spec coverage (§ della spec → task):**
- §3 palette/custom property → Task 2 (`:root`). ✓
- §3 monospace di sistema, no web-font → Task 2 (font + drop `<link>`). ✓
- §3 default sobrio + glow/scanline via custom property/classe, `prefers-reduced-motion` → Task 1+3 (`fx.js`, layer CSS). ✓ (reduced-motion: nessuna animazione introdotta in questo piano — niente cursori animati; nota esplicita.)
- §3 componente status bar → Task 4 (`.sbar`). ✓
- §4.2 Home (selettore settimana, tab giorni, righe esercizio, sparkline volume) → Task 4. ✓ (sparkline per-riga e bottone `› log` rimandati a Piano 3 — annotato nel mockup/Task 4.10.)
- §4.9 due toggle scanline/glow off di default, persistiti, applicati via classe app-shell → Task 1+3. ✓ (Nota: la spec suggeriva `ProfileStorage`; il piano segue invece il pattern *reale* delle altre impostazioni locali — `localStorage` globale come `gymsched_bar/plates/notify` — per coerenza col codice esistente. Discrepanza voluta e documentata in Task 1.)
- §6 `sw.js` bump cache → Task 5. ✓
- §12 build sequence passo 2 (design system su app-shell + 1 schermata pilota Home) → questo piano nel suo insieme. ✓
- Schermate 3-10 (focus, timer, note, sessione, progressione, calendario, impostazioni piene, editor) → **fuori da questo piano**, sono Piano 3. Ereditano i nuovi colori (Task 2) ma non il layout. Coerente con la build sequence.

**Placeholder scan:** nessun TBD/TODO; ogni step di codice contiene il codice reale; comandi con output atteso. ✓

**Type/nomi consistency:** `FX`, `getFx`, `setFx`, `applyFx` coerenti tra `fx.js`, test e wiring app.js. Classi `fx-glow`/`fx-scan` coerenti tra `fx.js`, CSS (`body.fx-glow`/`body.fx-scan`) e `applyFx`. Chiavi `gymsched_fx_glow`/`gymsched_fx_scan` coerenti tra modulo e test (via `FX.glow.key`). Id DOM `fxGlowToggle`/`fxScanToggle` coerenti tra index.html e app.js. `#status` spostato ma id invariato. ✓

**Rischi noti:** (1) cambiare `--ink` da quasi-bianco ad ambra ricolora TUTTO il testo dell'app — è l'effetto voluto, ma le schermate non ridisegnate (Piano 3) potrebbero avere contrasti da rifinire; verifica leggibilità nel Task 2.5. (2) Gli override Home in fondo al file vincono per cascade — se una regola non si applica, controllare specificità vs regole originali (righe 17-42). (3) Il `font-size` body passa 16→15px (densità terminale): se troppo piccolo su mobile, alzare a 15.5/16 nel Task 2.2.
