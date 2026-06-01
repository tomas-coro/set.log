# Esercizio "in una pagina" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far stare la vista esercizio (focus a schermo intero) in una sola schermata su telefono medio, tenendo sempre visibili gli essenziali e spostando le azioni secondarie in una barra di icone con cassetto "⋯ Altro".

**Architecture:** Layout B dello spec `docs/superpowers/specs/2026-06-01-esercizio-una-pagina-design.md`. Il `#focusBody` diventa una colonna flex con un gruppo azioni ancorato in fondo (`.focus-actions` = cassetto `.drawer` + barra `.actbar`). La composizione dei pulsanti barra è decisa da una funzione pura testabile (`focus-ui.js`); tutto il resto è ricomposizione DOM in `app.js` + CSS, senza toccare dati/store/sync.

**Tech Stack:** Vanilla JS ES-modules, `node --test` (niente DOM nei test — coerente col codebase: la logica pura sta in moduli, `app.js` è glue non testato), CSS con token Amber CRT esistenti, service worker con precache versionata.

**Nota sui test:** Il codebase NON ha un harness DOM (jsdom/happy-dom): i test (`tests/*.test.js`) coprono solo moduli puri (`store.js`, `plan.js`, `sync.js`, …). Questo piano resta fedele a quel pattern: l'unico test automatico nuovo è sulla funzione pura `actionBarSpec` (Task 1). La ricomposizione DOM (Task 3–6) si verifica con (a) suite esistente verde — nessuna regressione — e (b) una checklist di verifica manuale nell'app reale (Task 7). Non si introduce jsdom.

---

### Task 1: `focus-ui.js` — funzione pura `actionBarSpec` (TDD)

Decide quali pulsanti compaiono nella barra azioni. Normalmente 4 (recupero, commenti, fail, altro); a esercizio completato (`allDone`) solo 2 (recupero, altro), perché commenti/fail agiscono sulla serie in corso che non esiste più.

**Files:**
- Create: `focus-ui.js`
- Test: `tests/focus-ui.test.js`

- [ ] **Step 1: Scrivi il test che fallisce**

`tests/focus-ui.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { actionBarSpec } from "../focus-ui.js";

test("actionBarSpec: serie in corso → 4 pulsanti nell'ordine giusto", () => {
  const keys = actionBarSpec({ allDone: false, drawerOpen: false }).map((b) => b.key);
  assert.deepEqual(keys, ["rest", "comment", "fail", "more"]);
});

test("actionBarSpec: esercizio completato → solo recupero e altro", () => {
  const keys = actionBarSpec({ allDone: true, drawerOpen: false }).map((b) => b.key);
  assert.deepEqual(keys, ["rest", "more"]);
});

test("actionBarSpec: drawerOpen marca attivo il pulsante 'more'", () => {
  const open = actionBarSpec({ allDone: false, drawerOpen: true });
  const closed = actionBarSpec({ allDone: false, drawerOpen: false });
  assert.equal(open.find((b) => b.key === "more").active, true);
  assert.equal(closed.find((b) => b.key === "more").active, false);
});

test("actionBarSpec: ogni pulsante ha glyph e label non vuoti", () => {
  for (const b of actionBarSpec({ allDone: false, drawerOpen: false })) {
    assert.ok(b.glyph && b.label, `manca glyph/label per ${b.key}`);
  }
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisce**

Run: `node --test tests/focus-ui.test.js`
Expected: FAIL con `Cannot find module '../focus-ui.js'`.

- [ ] **Step 3: Implementa il minimo per far passare**

`focus-ui.js`:
```js
// Composizione della barra azioni del focus esercizio (layout "una pagina").
// Pura e testabile: app.js mappa questa spec su veri <button> con i suoi handler.
// `comment` e `fail` agiscono sulla serie in corso → assenti quando allDone.
export function actionBarSpec({ allDone, drawerOpen }) {
  const spec = [{ key: "rest", glyph: "⏱", label: "recupero" }];
  if (!allDone) {
    spec.push({ key: "comment", glyph: "💬", label: "commenti" });
    spec.push({ key: "fail", glyph: "✗", label: "fail" });
  }
  spec.push({ key: "more", glyph: "⋯", label: "altro", active: !!drawerOpen });
  return spec;
}
```

- [ ] **Step 4: Esegui il test e verifica che passa**

Run: `node --test tests/focus-ui.test.js`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add focus-ui.js tests/focus-ui.test.js
git commit -m "feat(focus): actionBarSpec pura per la barra azioni esercizio"
```

---

### Task 2: CSS barra azioni + cassetto (Amber CRT)

**Files:**
- Modify: `style.css` (sezione focus, dopo le regole `.focus-body` esistenti)

- [ ] **Step 1: Aggiungi le regole CSS**

In `style.css`, subito dopo il blocco `.focus-body .track-h{...}` (intorno a riga 581), incolla:
```css
/* ---- Layout "una pagina": body a colonna, azioni ancorate in fondo ---- */
.focus-body{display:flex;flex-direction:column;}
.focus-actions{margin-top:auto;display:flex;flex-direction:column;gap:9px;padding-top:10px;}

/* Cassetto collassabile con i blocchi secondari (recupero/nota/volume/add) */
.focus-actions .drawer{display:none;flex-direction:column;gap:10px;
  border:1px solid var(--ctc);border-radius:9px;padding:10px;background:var(--surf2);}
.focus-actions .drawer.open{display:flex;}
.focus-actions .drawer .addrow{display:flex;gap:8px;}
.focus-actions .drawer .addrow .addset{flex:1;margin-left:0;text-align:center;padding:8px;}

/* Barra azioni: 2–4 pulsanti uguali, sempre visibile in fondo */
.actbar{display:flex;gap:7px;align-items:stretch;}
.actbtn{flex:1;min-height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  background:var(--surf2);border:1px solid var(--line);border-radius:9px;color:var(--ink);
  font-family:var(--mono);font-size:15px;cursor:pointer;}
.actbtn .lbl{font-size:8.5px;color:var(--dim);letter-spacing:.05em;text-transform:uppercase;}
.actbtn:active{background:var(--acc);color:var(--acc-ink);}
.actbtn.fail .ab-g{color:var(--down);}
.actbtn.more.open{background:var(--acc);color:var(--acc-ink);border-color:var(--acc);}
.actbtn.more.open .lbl{color:var(--acc-ink);}
```

- [ ] **Step 2: Verifica che nulla si rompa**

Run: `node --test`
Expected: PASS (nessun test tocca il CSS; la suite resta verde).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat(focus): CSS barra azioni + cassetto (layout una pagina)"
```

---

### Task 3: Stato cassetto + rimozione recupero dalla cima

**Files:**
- Modify: `app.js` (stato modulo ~riga 36; `openFocus` ~52; `changeWeek`/`changeDay` ~2095/2103; `renderFocusOverlay` ~2055)

- [ ] **Step 1: Aggiungi lo stato modulo**

In `app.js`, dopo la riga `let supersetTab = "a";` (riga 36) aggiungi:
```js
let focusDrawerOpen = false; // cassetto "⋯ Altro" del focus esercizio (UI effimera, non persistita)
```

- [ ] **Step 2: Reset del cassetto all'apertura esercizio**

In `openFocus(i)` (riga 52), aggiungi `focusDrawerOpen = false;` dopo `supersetTab = "a";`:
```js
function openFocus(i) {
  openIndex = i;
  supersetTab = "a";
  focusDrawerOpen = false;
  history.pushState({ gymFocus: true }, "");
  render();
}
```

- [ ] **Step 3: Reset anche al cambio giorno/settimana**

In `changeWeek(key)` aggiungi `focusDrawerOpen = false;` accanto a `openIndex = null;`. Idem in `changeDay(day)`. Esempio per `changeDay`:
```js
function changeDay(day) {
  currentDay = day;
  openIndex = null;
  focusDrawerOpen = false;
  volExpanded = false;
  render();
}
```
(stessa aggiunta della riga `focusDrawerOpen = false;` in `changeWeek`, accanto a `openIndex = null;`)

- [ ] **Step 4: Togli l'editor recupero dalla cima dell'overlay**

In `renderFocusOverlay()` rimuovi la riga (2055):
```js
  body.appendChild(buildRestEditor(openIndex, ex));
```
Il recupero verrà rimesso dentro il cassetto in Task 5/6. Lascia invariate le righe attorno (`foot.appendChild(buildNextStrip(...))` e il branch superset/normal).

- [ ] **Step 5: Helper di stato (toggle/open) + verifica suite**

Subito prima di `function buildRestEditor(` (riga 1977) aggiungi:
```js
// Apre/chiude il cassetto "⋯ Altro" del focus. Passa da render() così lo stato
// (focusDrawerOpen) sopravvive alla ricostruzione del DOM.
function toggleFocusDrawer() { focusDrawerOpen = !focusDrawerOpen; render(); }
function openFocusDrawer() { focusDrawerOpen = true; render(); }
```

Run: `node --test`
Expected: PASS (suite invariata). L'app a questo punto NON mostra più il recupero finché Task 5 non lo rimette nel cassetto — è uno stato intermedio atteso, si committa lo stesso (la barra/cassetto arrivano nei task seguenti).

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat(focus): stato cassetto focusDrawerOpen + rimuovi recupero dalla cima"
```

---

### Task 4: Helper `buildActionBar` + `buildSecondaryDrawer`

**Files:**
- Modify: `app.js` (import in cima; nuovi helper vicino a `buildRestEditor`)

- [ ] **Step 1: Importa `actionBarSpec`**

In cima a `app.js`, tra gli import esistenti, aggiungi:
```js
import { actionBarSpec } from "./focus-ui.js";
```

- [ ] **Step 2: Aggiungi i due helper**

Subito dopo `function openFocusDrawer()` (creato in Task 3), aggiungi:
```js
// Barra azioni in fondo al focus. `handlers` mappa key→funzione (rest/comment/
// fail/more); comment e fail possono mancare (esercizio completato). `restValue`
// è l'etichetta del pulsante recupero (es. "90s").
function buildActionBar({ allDone, restValue, handlers }) {
  const bar = document.createElement("div");
  bar.className = "actbar";
  actionBarSpec({ allDone, drawerOpen: focusDrawerOpen }).forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "actbtn"
      + (s.key === "fail" ? " fail" : "")
      + (s.key === "more" ? " more" + (s.active ? " open" : "") : "");
    const g = document.createElement("span"); g.className = "ab-g"; g.textContent = s.glyph;
    const l = document.createElement("span"); l.className = "lbl";
    l.textContent = s.key === "rest" && restValue ? restValue : s.label;
    b.append(g, l);
    const fn = handlers[s.key];
    if (fn) b.addEventListener("click", fn);
    bar.appendChild(b);
  });
  return bar;
}

// Gruppo ancorato in fondo: cassetto (chiuso di default) + barra azioni.
function buildFocusActions(drawerChildren, barOpts) {
  const group = document.createElement("div");
  group.className = "focus-actions";
  const drawer = document.createElement("div");
  drawer.className = "drawer" + (focusDrawerOpen ? " open" : "");
  drawerChildren.filter(Boolean).forEach((c) => drawer.appendChild(c));
  group.append(drawer, buildActionBar(barOpts));
  return group;
}
```

- [ ] **Step 3: Verifica suite**

Run: `node --test`
Expected: PASS. (Gli helper non sono ancora chiamati: nessun cambiamento visibile, ma il file deve restare valido — niente errori di sintassi/import.)

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(focus): helper buildActionBar + buildFocusActions"
```

---

### Task 5: Ricomponi `renderFocusNormal`

Sposta nel cassetto: editor recupero, nota, volume, "+ riscald." / "+ serie". Sposta nella barra: commenti (💬) e fail (✗). Restano inline e visibili: trend, lista serie, editblock (kg+reps), chip ripeti, pallini.

**Files:**
- Modify: `app.js` `renderFocusNormal` (righe ~1579–1677)

- [ ] **Step 1: Rimuovi i blocchi inline ora spostati**

Dentro `renderFocusNormal`, nel ramo `if (!allDone) { ... }`, RIMUOVI:
- il blocco `let qcEl; const refreshQc = () => {...}; refreshQc();` (righe ~1584–1592);
- il blocco del link fail `const failLink = ...; container.appendChild(failLink);` (righe ~1602–1627).

Mantieni: `edit` (editblock) e il blocco `repChips` (chip ripeti).

- [ ] **Step 2: Togli i pulsanti add dalla riga pallini**

Sempre in `renderFocusNormal`, nella costruzione dei `dots` (righe ~1630–1656), RIMUOVI le righe che creano e appendono `addW` e `add` ai dots:
```js
  // RIMUOVI queste: creazione addW, add e i due dots.appendChild(addW/add)
```
Lascia solo i `dt` (pallini) e `container.appendChild(dots);`. I pulsanti add verranno ricreati nel cassetto allo Step 3.

- [ ] **Step 3: Sostituisci la coda della funzione (volume/note) con il gruppo azioni**

In fondo a `renderFocusNormal`, SOSTITUISCI le ultime righe:
```js
  const exVol = exerciseVolume(v, ex);
  if (exVol > 0) container.appendChild(buildVolLine(meta.factor === 2 ? "Volume esercizio · ×2 manubri" : "Volume esercizio", exVol));
  container.appendChild(buildNoteField(false, idx));
}
```
con:
```js
  // --- Cassetto secondario: recupero · nota · volume · add ---
  const restEditor = buildRestEditor(idx, ex);
  const noteField = buildNoteField(false, idx);
  const exVol = exerciseVolume(v, ex);
  const volLine = exVol > 0
    ? buildVolLine(meta.factor === 2 ? "Volume esercizio · ×2 manubri" : "Volume esercizio", exVol)
    : null;

  const addRow = document.createElement("div");
  addRow.className = "addrow";
  const addW = document.createElement("button");
  addW.className = "addset warm"; addW.textContent = "+ riscald.";
  addW.addEventListener("click", () => {
    data = setEntry(data, currentWeek, currentDay, exId, withSet(v, entry.sets.length, { reps: "", kg: "", done: false, warmup: true }), new Date().toISOString());
    persist(idx); render();
  });
  const addS = document.createElement("button");
  addS.className = "addset"; addS.textContent = "+ serie";
  addS.addEventListener("click", () => {
    data = setEntry(data, currentWeek, currentDay, exId, withSet(v, entry.sets.length, { reps: "", kg: "", done: false }), new Date().toISOString());
    persist(idx); render();
  });
  addRow.append(addW, addS);

  // --- Handler barra azioni ---
  const onComment = allDone ? null : () => openQcDialog(draft.comments, (next) => { draft.comments = next; render(); });
  const onFail = allDone ? null : () => {
    const curSet = entry.sets[curIdx] || {};
    openSetDialog({
      title: `Serie ${curIdx + 1} — non riuscita`,
      reps: draft.reps || curSet.reps || "",
      kg: draft.kg || curSet.kg || "",
      feel: curSet.feel || "", unit: meta.unit,
      failed: curSet.failed || false,
      failNote: curSet.failNote || "",
      done: false,
      onApply: (reps, kg, feel, failed, failNote) => {
        data = setEntry(data, currentWeek, currentDay, exId, withSet(v, curIdx, { reps, kg, feel, failed, failNote, ...(failed ? { done: true } : {}) }), new Date().toISOString());
        persist(idx); render();
      },
      onUndo: () => {},
      onDelete: () => {
        data = setEntry(data, currentWeek, currentDay, exId, withoutSet(v, curIdx), new Date().toISOString());
        persist(idx); render();
      },
    });
  };

  container.appendChild(buildFocusActions(
    [restEditor, noteField, volLine, addRow],
    {
      allDone,
      restValue: `${getRest(currentDay, exId, ex.restSeconds)}s`,
      handlers: { rest: openFocusDrawer, comment: onComment, fail: onFail, more: toggleFocusDrawer },
    }
  ));
}
```

- [ ] **Step 3b: Verifica che `draft.comments` resti vivo dopo render**

Il pulsante 💬 chiama `openQcDialog(draft.comments, … render())`. `draft` è tenuto in vita dal suo `_key` (riga ~1533): se la serie corrente non cambia, `render()` NON rigenera `draft`, quindi i commenti scelti restano. Nessuna modifica al keying necessaria — solo conferma leggendo le righe 1533–1541.

- [ ] **Step 4: Verifica suite + visivo**

Run: `node --test`
Expected: PASS (handler invariati nella sostanza; nessun test DOM toccato).

Verifica manuale: avvia un server statico (`python -m http.server 8000` dalla root del progetto) e apri `http://localhost:8000`. Apri un esercizio NORMALE:
- trend, serie, input kg+reps, chip ripeti, pallini visibili senza scroll;
- in fondo barra `⏱ 90s · 💬 · ✗ · ⋯`;
- tocca `⋯` → si apre il cassetto con recupero/nota/volume/+riscald/+serie;
- tocca `⏱` → apre il cassetto;
- registra una serie ("Serie fatta"): il flusso recupero/feel funziona come prima.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat(focus): renderFocusNormal in una pagina (barra azioni + cassetto)"
```

---

### Task 6: Ricomponi superset (`trackBlock` + `renderFocusSuperset`)

Stessa logica per le tracce A/B. `trackBlock` smette di appendere qc/fail/add inline e li espone come handler; `renderFocusSuperset` costruisce barra (sulla traccia attiva) + cassetto (recupero comune, volumi, nota, "+ serie" della traccia attiva).

**Files:**
- Modify: `app.js` `trackBlock` (~1684–1802) e `renderFocusSuperset` (~1804–1866)

- [ ] **Step 1: In `trackBlock`, rimuovi i blocchi inline e ritorna gli handler**

Dentro `trackBlock`:
1. RIMUOVI la costruzione `dots`/`add` (righe ~1740–1749) — `wrap.appendChild(dots)` incluso.
2. RIMUOVI il blocco `let qcEl; const refreshQc = …; refreshQc();` (~1756–1764).
3. RIMUOVI il blocco `const failLink = …; wrap.appendChild(failLink);` (~1772–1799).
4. Mantieni: header traccia, setsBox, editblock (`edit`), chip (`chips`).
5. SOSTITUISCI il `return { wrap, curIdx, allDone };` (riga 1801) con:
```js
  const onAddSet = () => {
    data = setEntry(data, currentWeek, currentDay, exId, withSupersetSet(getEntry(data, currentWeek, currentDay, exId), trackKey, trackEntry.sets.length, { reps: "", kg: "", done: false }), new Date().toISOString());
    persist(idx); render();
  };
  const onComment = allDone ? null : () => openQcDialog(state.comments, (next) => { state.comments = next; render(); });
  const onFail = allDone ? null : () => {
    const curSet = trackEntry.sets[curIdx] || {};
    openSetDialog({
      title: `${trackKey.toUpperCase()} · Serie ${curIdx + 1} — non riuscita`,
      reps: state.reps || curSet.reps || "",
      kg: state.kg || curSet.kg || "",
      feel: curSet.feel || "", unit: meta.unit,
      failed: curSet.failed || false,
      failNote: curSet.failNote || "",
      done: false,
      onApply: (reps, kg, feel, failed, failNote) => {
        const nv = withSupersetSet(getEntry(data, currentWeek, currentDay, exId), trackKey, curIdx, { reps, kg, feel, failed, failNote, ...(failed ? { done: true } : {}) });
        data = setEntry(data, currentWeek, currentDay, exId, nv, new Date().toISOString());
        persist(idx); render();
      },
      onUndo: () => {},
      onDelete: () => {
        const nv = withoutSupersetSet(getEntry(data, currentWeek, currentDay, exId), trackKey, curIdx);
        data = setEntry(data, currentWeek, currentDay, exId, nv, new Date().toISOString());
        persist(idx); render();
      },
    });
  };
  return { wrap, curIdx, allDone, onAddSet, onComment, onFail };
```
(Il blocco `if (!allDone) { const editLabel … wrap.appendChild(edit.block); … if (chips) wrap.appendChild(chips); }` resta, ma SENZA più qc e failLink al suo interno.)

- [ ] **Step 2: In `renderFocusSuperset`, sposta volumi/nota nel cassetto e aggiungi la barra**

In `renderFocusSuperset`, SOSTITUISCI la coda dopo il blocco CTA (dalle righe ~1859–1865, cioè da `// Volume per traccia…` fino a `container.appendChild(buildNoteField(true, idx));`) con:
```js
  // Volume per traccia + totale superset (con ×2 manubri; tracce a tempo escluse).
  const volA = e.a.sets.reduce((s, x) => s + setVolume(x, metaA), 0);
  const volB = e.b.sets.reduce((s, x) => s + setVolume(x, metaB), 0);
  const volNodes = [];
  if (volA > 0) volNodes.push(buildVolLine(`Volume A${metaA.factor === 2 ? " · ×2 manubri" : ""}`, volA));
  if (volB > 0) volNodes.push(buildVolLine(`Volume B${metaB.factor === 2 ? " · ×2 manubri" : ""}`, volB));
  if (volA + volB > 0) volNodes.push(buildVolLine("Totale superset", volA + volB));

  // "+ serie" della traccia attiva, dentro al cassetto.
  const addRow = document.createElement("div");
  addRow.className = "addrow";
  const addS = document.createElement("button");
  addS.className = "addset"; addS.textContent = `+ serie ${supersetTab.toUpperCase()}`;
  addS.addEventListener("click", active.onAddSet);
  addRow.appendChild(addS);

  const drawerChildren = [buildRestEditor(idx, ex), buildNoteField(true, idx), ...volNodes, addRow];
  container.appendChild(buildFocusActions(drawerChildren, {
    allDone: active.allDone,
    restValue: `${getRest(currentDay, exId, ex.restSeconds)}s`,
    handlers: { rest: openFocusDrawer, comment: active.onComment, fail: active.onFail, more: toggleFocusDrawer },
  }));
}
```
Nota: `active` è già definito sopra (riga 1835: `const active = supersetTab === "a" ? a : b;`). Serve `exId` (già in scope, riga 1805) per `getRest`.

- [ ] **Step 3: Verifica suite + visivo superset**

Run: `node --test`
Expected: PASS.

Verifica manuale (server statico già avviato): apri un esercizio SUPERSET:
- tab A/B in alto, trend, serie e input della traccia attiva, chip, senza scroll;
- barra `⏱ · 💬 · ✗ · ⋯` in fondo; `💬`/`✗` agiscono sulla traccia attiva;
- `⋯` apre cassetto con recupero, nota, "Volume A/B/Totale", "+ serie X";
- cambiando tab A↔B la barra/cassetto seguono la traccia attiva;
- "Serie fatta (A+B)" registra come prima.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(focus): superset in una pagina (barra azioni + cassetto su traccia attiva)"
```

---

### Task 7: Pulizia, service worker, regressione finale

**Files:**
- Modify: `app.js` (rimozione `buildQuickCommentButton` se non più usata), `sw.js` (precache + versione)

- [ ] **Step 1: Rimuovi codice morto**

Cerca usi di `buildQuickCommentButton` in `app.js`:
Run: `node -e "const s=require('fs').readFileSync('app.js','utf8');console.log((s.match(/buildQuickCommentButton/g)||[]).length)"`
Expected: `1` (solo la definizione). Se è 1, rimuovi l'intera funzione `function buildQuickCommentButton(selected, onOpen) { … }` (definizione ~851–870). Se è >1, NON rimuoverla e annota dove è ancora usata.

(Il CSS `.qc-btn` e `.fail-link` possono restare: innocui. Non rimuoverli per minimizzare il churn.)

- [ ] **Step 2: Aggiungi `focus-ui.js` alla precache del service worker e bumpa la versione**

In `sw.js`: nell'array `ASSETS` aggiungi `"./focus-ui.js",` (dopo `"./app.js",`) e cambia la versione cache:
```js
const CACHE = "gymsched-v46";
```
(da `v45` a `v46`.)

- [ ] **Step 3: Regressione completa**

Run: `node --test`
Expected: PASS — tutta la suite verde, inclusi i 4 nuovi test di `focus-ui.test.js`. Annota il conteggio totale (deve essere il precedente + 4).

- [ ] **Step 4: Verifica manuale finale (checklist una-pagina)**

Server statico attivo, su una finestra stretta tipo telefono (DevTools device ~390×844). Per un esercizio normale E uno superset, conferma **senza scrollare**:
- [ ] visibili: trend "ultima volta", lista serie, input kg+reps, (chip ripeti se presenti), pallini, barra azioni in fondo;
- [ ] cassetto chiuso all'apertura dell'esercizio;
- [ ] `⋯` e `⏱` aprono il cassetto; richiudibile con `⋯`;
- [ ] aprendo un altro esercizio il cassetto riparte chiuso;
- [ ] CTA "Serie fatta" sempre raggiungibile nel footer, recupero/feel invariati.

- [ ] **Step 5: Commit**

```bash
git add app.js sw.js
git commit -m "chore(focus): rimuovi codice morto + precache focus-ui.js, cache v46"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-review (compilata dall'autore del piano)

- **Copertura spec:** essenziali sempre visibili (Task 5/6), barra 4 tasti (Task 1+4+5), cassetto secondarie chiuso di default + reset su cambio esercizio/giorno/settimana (Task 3), superset (Task 6), nessun cambiamento dati/sync (verificato: solo composizione DOM + stato UI), CSS Amber CRT (Task 2), test (Task 1 pura + regressione Task 7). ✔ Tutte le sezioni dello spec hanno un task.
- **Placeholder:** nessun "TBD/TODO"; ogni step di codice mostra il codice reale derivato dalle funzioni esistenti.
- **Coerenza nomi:** `focusDrawerOpen`, `toggleFocusDrawer`, `openFocusDrawer`, `buildActionBar`, `buildFocusActions`, `actionBarSpec` usati in modo identico tra i task. Handler key `rest/comment/fail/more` coerenti tra Task 1, 4, 5, 6.
