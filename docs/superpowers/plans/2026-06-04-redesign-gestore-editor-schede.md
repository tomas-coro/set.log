# Redesign gestore schede (B-terminale) + editor (tab evolute) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riallineare gli overlay "Schede" e "Modifica scheda" al linguaggio CRT/terminale (varianti approvate: gestore B-terminale ad accordion, editor 1-tab-evolute), senza alcun cambio al modello dati.

**Architecture:** Helper puri additivi in `sheets.js` (dayLines, ordinamento, slug, date) ed `editor.js` (tabMiniLabel), testati con `node --test`; poi re-render di `renderSheets`/`renderPlanEditor`/`buildPlanRow` in `app.js` e restyle CSS con i soli token semantici (entrambi i temi gratis). Mutazioni, drag, dialog e history restano intatti.

**Tech Stack:** Vanilla JS (ES modules), `node --test`, CSS custom properties. Niente dipendenze nuove.

**Spec:** `docs/superpowers/specs/2026-06-04-redesign-gestore-editor-schede-design.md`
**Mockup approvato:** `.superpowers/brainstorm/30021-1780580444/content/design-finale-gestore-editor.html`

**Branch:** lavorare su `feat/redesign-gestore-editor` (da `main`).

**Convenzioni repo:** commit conventional in italiano; MAI here-string con `@` nei messaggi (usare `-m` semplice); test con `npm test` dalla root.

---

### Task 1: `sheets.js` — campo `dayLines` in `sheetSummaries`

**Files:**
- Modify: `sheets.js` (funzione `sheetSummaries`, righe ~165-189)
- Test: `tests/sheets.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In `tests/sheets.test.js` (in fondo al file; `sheetSummaries` è già importato in testa al file):

```js
test("sheetSummaries: dayLines con day/title/count per scheda", () => {
  const blob = {
    schema: 6, activeSheetId: "s1",
    sheets: [{
      id: "s1", name: "Focus alto",
      plan: [
        { day: "A", title: "Petto · Tricipiti", exercises: [{ id: "e1", name: "Panca" }, { id: "e2", name: "Dips" }] },
        { day: "B", title: "", exercises: [] },
      ],
      weeks: {},
    }],
  };
  const [s] = sheetSummaries(blob);
  assert.deepEqual(s.dayLines, [
    { day: "A", title: "Petto · Tricipiti", count: 2 },
    { day: "B", title: "B", count: 0 },
  ]);
});

test("sheetSummaries: dayLines di una scheda senza plan è []", () => {
  const blob = { schema: 6, activeSheetId: "s1", sheets: [{ id: "s1", name: "X", plan: [], weeks: {} }] };
  assert.deepEqual(sheetSummaries(blob)[0].dayLines, []);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm test`
Expected: FAIL — `dayLines` è `undefined` (deepEqual fallisce).

- [ ] **Step 3: Implementazione minima**

In `sheets.js`, dentro il `return` di `sheetSummaries` (dopo `lastDate,`):

```js
      dayLines: plan.map((d) => ({
        day: d.day,
        title: (d.title && String(d.title).trim()) || d.day,
        count: Array.isArray(d.exercises) ? d.exercises.length : 0,
      })),
```

- [ ] **Step 4: Verifica che passino**

Run: `npm test`
Expected: PASS, 334 test verdi (332 esistenti + 2 nuovi).

- [ ] **Step 5: Commit**

```bash
git add sheets.js tests/sheets.test.js
git commit -m "feat(sheets): dayLines nei riepiloghi del gestore"
```

---

### Task 2: `sheets.js` — `sortSheetSummaries`

**Files:**
- Modify: `sheets.js` (nuova funzione esportata, dopo `sheetSummaries`)
- Test: `tests/sheets.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In `tests/sheets.test.js`, aggiungi `sortSheetSummaries` all'import da `../sheets.js`, poi:

```js
test("sortSheetSummaries: attiva prima, archivio per lastDate desc, null in fondo", () => {
  const sums = [
    { id: "a", active: false, lastDate: "2026-05-26" },
    { id: "b", active: false, lastDate: null },
    { id: "c", active: true, lastDate: "2026-01-01" },
    { id: "d", active: false, lastDate: "2026-06-01" },
  ];
  assert.deepEqual(sortSheetSummaries(sums).map((s) => s.id), ["c", "d", "a", "b"]);
});

test("sortSheetSummaries: non muta l'input e regge input nullo", () => {
  const sums = [{ id: "a", active: false, lastDate: null }, { id: "b", active: true, lastDate: null }];
  const before = sums.map((s) => s.id);
  sortSheetSummaries(sums);
  assert.deepEqual(sums.map((s) => s.id), before);
  assert.deepEqual(sortSheetSummaries(null), []);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm test`
Expected: FAIL — `sortSheetSummaries is not a function` (export mancante).

- [ ] **Step 3: Implementazione minima**

In `sheets.js`, dopo `sheetSummaries`:

```js
// Ordinamento per il gestore: la scheda attiva sempre prima, poi l'archivio per
// ultima sessione decrescente; le mai usate (lastDate null) in fondo. Non muta
// l'input. Le date ISO (YYYY-MM-DD) si confrontano come stringhe.
export function sortSheetSummaries(sums) {
  return [...(sums ?? [])].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.lastDate === b.lastDate) return 0;
    if (a.lastDate === null) return 1;
    if (b.lastDate === null) return -1;
    return a.lastDate < b.lastDate ? 1 : -1;
  });
}
```

- [ ] **Step 4: Verifica che passino**

Run: `npm test`
Expected: PASS (336 verdi).

- [ ] **Step 5: Commit**

```bash
git add sheets.js tests/sheets.test.js
git commit -m "feat(sheets): ordinamento riepiloghi (attiva prima, lastDate desc)"
```

---

### Task 3: `sheets.js` — `sheetSlug` + `fmtSheetDate`

**Files:**
- Modify: `sheets.js` (due nuove funzioni esportate, in fondo al file)
- Test: `tests/sheets.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In `tests/sheets.test.js`, aggiungi `sheetSlug, fmtSheetDate` all'import, poi:

```js
test("sheetSlug: minuscole, accenti, separatore '-', taglio a 24", () => {
  assert.equal(sheetSlug("Focus alto"), "focus-alto");
  assert.equal(sheetSlug("Forza & Massa — über"), "forza-massa-uber");
  assert.equal(sheetSlug("Una scheda con nome davvero lungo"), "una-scheda-con-nome-davv");
});

test("sheetSlug: vuoto/garbage/null → 'scheda'", () => {
  assert.equal(sheetSlug(""), "scheda");
  assert.equal(sheetSlug("⚡⚡⚡"), "scheda");
  assert.equal(sheetSlug(null), "scheda");
});

test("fmtSheetDate: oggi / anno corrente / anno diverso / null", () => {
  assert.equal(fmtSheetDate("2026-06-04", "2026-06-04"), "oggi");
  assert.equal(fmtSheetDate("2026-05-26", "2026-06-04"), "26.05");
  assert.equal(fmtSheetDate("2025-12-31", "2026-06-04"), "31.12.25");
  assert.equal(fmtSheetDate(null, "2026-06-04"), "mai usata");
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm test`
Expected: FAIL — export mancanti.

- [ ] **Step 3: Implementazione minima**

In fondo a `sheets.js`:

```js
// Slug display-only del nome scheda, stile directory ("Focus alto" → "focus-alto").
// Analogo a goSlug (timer.js) ma con separatore "-" e fallback "scheda".
// Il nome reale nel modello resta invariato.
export function sheetSlug(name) {
  const s = String(name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24).replace(/-+$/, "");
  return s || "scheda";
}

// Data breve per il gestore: "oggi", "DD.MM" (anno corrente), "DD.MM.YY",
// o "mai usata" se null. todayIso ("YYYY-MM-DD") iniettato per testabilità.
export function fmtSheetDate(iso, todayIso) {
  if (!iso) return "mai usata";
  if (iso === todayIso) return "oggi";
  const [y, m, d] = String(iso).split("-");
  return y === String(todayIso).slice(0, 4) ? `${d}.${m}` : `${d}.${m}.${y.slice(2)}`;
}
```

- [ ] **Step 4: Verifica che passino**

Run: `npm test`
Expected: PASS (339 verdi).

- [ ] **Step 5: Commit**

```bash
git add sheets.js tests/sheets.test.js
git commit -m "feat(sheets): sheetSlug e fmtSheetDate display-only"
```

---

### Task 4: `editor.js` — `tabMiniLabel`

**Files:**
- Modify: `editor.js` (nuova funzione esportata, in fondo al file)
- Test: `tests/editor.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In `tests/editor.test.js`, aggiungi `tabMiniLabel` all'import da `../editor.js`, poi:

```js
test("tabMiniLabel: split su separatori, tronca a 5, join '·'", () => {
  assert.equal(tabMiniLabel("Petto · Tricipiti · Laterali"), "petto·trici·later");
  assert.equal(tabMiniLabel("Dorso/Bicipiti"), "dorso·bicip");
  assert.equal(tabMiniLabel("Gambe"), "gambe");
});

test("tabMiniLabel: vuoto/assente → stringa vuota", () => {
  assert.equal(tabMiniLabel(""), "");
  assert.equal(tabMiniLabel(null), "");
  assert.equal(tabMiniLabel("  "), "");
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm test`
Expected: FAIL — export mancante.

- [ ] **Step 3: Implementazione minima**

In fondo a `editor.js`:

```js
// Mini-etichetta per le tab dell'editor: titolo giorno abbreviato, una riga.
// "Petto · Tricipiti · Laterali" → "petto·trici·later". Display-only;
// l'ellipsis CSS copre i casi ancora troppo lunghi.
export function tabMiniLabel(title) {
  const t = String(title ?? "").trim().toLowerCase();
  if (!t) return "";
  return t.split(/[/·,+]/).map((p) => p.trim()).filter(Boolean)
    .map((p) => p.slice(0, 5)).join("·");
}
```

- [ ] **Step 4: Verifica che passino**

Run: `npm test`
Expected: PASS (341 verdi).

- [ ] **Step 5: Commit**

```bash
git add editor.js tests/editor.test.js
git commit -m "feat(editor): tabMiniLabel per le tab dell'editor"
```

---

### Task 5: gestore schede B-terminale (`renderSheets` + CSS)

**Files:**
- Modify: `app.js` — import da `./sheets.js` (righe 8-10), `openSheets` (~riga 254), `renderSheets` (~righe 275-341), `mkBtn` (~righe 343-350)
- Modify: `style.css` — blocco "Gestore schede multiple" (righe ~809-823: da `.sheet-card` a `.sheet-newrow .dup` inclusi; NON toccare `.sheets-body`, la regola `#sheetsOverlay .sheets-body` e `.sheets-inner`)

Nessun nuovo test unit (solo DOM); i 341 esistenti devono restare verdi.

- [ ] **Step 1: Estendi l'import e lo stato**

In `app.js` righe 8-10, l'import diventa:

```js
import {
  hydrate, dehydrate, addSheet, importSheet, renameSheet, deleteSheet, setActiveSheet, sheetSummaries,
  sortSheetSummaries, sheetSlug, fmtSheetDate,
} from "./sheets.js";
```

Sotto `let sheetsPending = null;` (~riga 252) aggiungi:

```js
let sheetsExpandedId = null; // id scheda espansa nell'accordion (null → default: l'attiva)
```

In `openSheets()` aggiungi il reset prima di `renderSheets()`:

```js
function openSheets() {
  sheetsOpen = true;
  sheetsExpandedId = null; // a ogni apertura riparte con l'attiva espansa
  history.pushState({ gymSheets: true }, "");
  renderSheets();
}
```

- [ ] **Step 2: Sostituisci `renderSheets` e `mkBtn`**

Sostituisci integralmente le funzioni `renderSheets` e `mkBtn` con:

```js
function renderSheets() {
  const ov = document.getElementById("sheetsOverlay");
  if (!sheetsOpen) { ov.classList.add("hidden"); ov.setAttribute("aria-hidden", "true"); return; }
  ov.classList.remove("hidden"); ov.setAttribute("aria-hidden", "false");
  const body = document.getElementById("sheetsBody");
  body.innerHTML = "";
  const sums = sortSheetSummaries(sheetSummaries(dehydrate(data)));
  document.getElementById("sheetsSub").textContent =
    `${sums.length} scheda${sums.length === 1 ? "" : "e"} · attiva + archivio`;
  const todayIso = new Date().toISOString().slice(0, 10);
  const ultTxt = (s) => (s.lastDate ? `ult ${fmtSheetDate(s.lastDate, todayIso)}` : fmtSheetDate(null, todayIso));
  // null → default (attiva espansa); "" → tutte chiuse; altrimenti id della scheda espansa.
  const expandedId = sheetsExpandedId ?? (sums.find((s) => s.active) || {}).id;

  const inner = document.createElement("div");
  inner.className = "sheets-inner";
  inner.appendChild(mkPrompt("$", "ls schede/ --sort=ultima"));

  for (const s of sums) {
    const open = s.id === expandedId;
    const blk = document.createElement("div");
    blk.className = "sh-blk" + (s.active ? " active" : "") + (open ? " open" : "");
    blk.addEventListener("click", () => { sheetsExpandedId = open ? "" : s.id; renderSheets(); });

    const h = document.createElement("div");
    h.className = "sh-h";
    const ar = document.createElement("span"); ar.className = "sh-ar"; ar.textContent = open ? "▸" : "▹";
    const nm = document.createElement("span"); nm.className = "sh-nm"; nm.textContent = sheetSlug(s.name) + "/";
    h.append(ar, nm);
    if (s.active) {
      const tag = document.createElement("span"); tag.className = "sh-tag"; tag.textContent = "attiva";
      h.appendChild(tag);
    } else if (!open) {
      const mt = document.createElement("span"); mt.className = "sh-mt";
      mt.textContent = `${s.days}g · ${s.exercises} es · ${ultTxt(s)}`;
      h.appendChild(mt);
    }
    blk.appendChild(h);

    if (open) {
      const x = document.createElement("div");
      x.className = "sh-x";

      const days = document.createElement("div");
      days.className = "sh-days";
      for (const dl of s.dayLines) {
        const ln = document.createElement("div");
        const L = document.createElement("span"); L.className = "L"; L.textContent = dl.day;
        const n = document.createElement("span"); n.className = "n"; n.textContent = ` ${dl.count} es`;
        ln.append(L, document.createTextNode(dl.title.toLowerCase()), n);
        days.appendChild(ln);
      }
      x.appendChild(days);

      const meta = document.createElement("div");
      meta.className = "sh-meta";
      meta.textContent =
        `${ultTxt(s)} · ${s.weeks} settiman${s.weeks === 1 ? "a" : "e"} loggat${s.weeks === 1 ? "a" : "e"}`;
      x.appendChild(meta);

      const acts = document.createElement("div");
      acts.className = "sh-acts";
      if (s.active) {
        acts.appendChild(mkBtn("✎ modifica", "p", () => { sheetsPending = openPlanEditor; closeSheets(); }));
      } else {
        acts.appendChild(mkBtn("↪ attiva", "p", () => mutateSheets((b) => setActiveSheet(b, s.id))));
      }
      acts.appendChild(mkBtn("rinomina", "", () => renameSheetPrompt(s)));
      acts.appendChild(mkBtn("⧉ duplica", "", () =>
        mutateSheets((b) => s.active
          ? addSheet(b, { duplicateActive: true })
          : addSheet(setActiveSheet(b, s.id), { duplicateActive: true }))));
      if (sums.length > 1) acts.appendChild(mkBtn("rm", "r", () => deleteSheetConfirm(s)));
      x.appendChild(acts);
      blk.appendChild(x);
    }
    inner.appendChild(blk);
  }

  inner.appendChild(mkPrompt("›", "tap su una scheda per aprirla"));

  const newrow = document.createElement("div");
  newrow.className = "sh-newrow";
  newrow.appendChild(mkNew("nuova", () => mutateSheets((b) => addSheet(b, { duplicateActive: false }))));
  newrow.appendChild(mkNew("duplica", () => mutateSheets((b) => addSheet(b, { duplicateActive: true }))));
  newrow.appendChild(mkNew("importa", importSheetPrompt));
  inner.appendChild(newrow);
  body.appendChild(inner);
}

// Bottone azione dei blocchi scheda. stopPropagation: il tap sul bottone non
// deve far collassare/espandere il blocco (il click-handler è sul blocco).
function mkBtn(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sh-bb" + (cls ? " " + cls : "");
  b.textContent = label;
  b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
  return b;
}

// Riga prompt stile terminale ("$ comando" / "› hint").
function mkPrompt(sym, text) {
  const p = document.createElement("div");
  p.className = "sh-prompt";
  const d = document.createElement("span"); d.className = "d"; d.textContent = sym;
  p.append(d, document.createTextNode(" " + text));
  return p;
}

// Bottone della riga nuova in fondo ("$ nuova" / "$ duplica" / "$ importa").
function mkNew(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sh-new";
  const d = document.createElement("span"); d.className = "d"; d.textContent = "$";
  b.append(d, document.createTextNode(" " + label));
  b.addEventListener("click", onClick);
  return b;
}
```

- [ ] **Step 3: Sostituisci il CSS del gestore**

In `style.css`, sostituisci il blocco da `.sheet-card{` a `.sheet-newrow .dup{...}` inclusi (righe ~809-823) con:

```css
.sh-prompt{font-size:12px;color:var(--dim);padding:2px 1px;font-family:"JetBrains Mono",monospace;margin-bottom:7px;}
.sh-prompt .d{color:var(--acc);font-weight:700;}
.sh-blk{background:var(--surf);border:1px solid var(--line);border-radius:11px;margin-bottom:9px;cursor:pointer;}
.sh-blk.active.open{border-color:var(--acc);
  background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 8%,transparent),transparent 55%),var(--surf);}
.sh-h{display:flex;align-items:baseline;gap:8px;padding:13px 12px;}
.sh-blk.open .sh-h{padding-bottom:0;}
.sh-ar{color:var(--faint);font-size:12px;flex:none;}
.sh-blk.open .sh-ar{color:var(--acc);}
.sh-nm{font-weight:800;font-size:15px;color:var(--tx);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sh-tag{font:700 9px var(--mono);color:var(--acc);border:1px solid var(--line-acc);border-radius:5px;
  padding:2px 6px;letter-spacing:.1em;text-transform:uppercase;flex:none;}
.sh-mt{color:var(--faint);font-size:10px;flex:none;white-space:nowrap;}
.sh-x{padding:0 12px 12px;}
.sh-days{margin:10px 0 8px;font-size:11.5px;line-height:1.85;color:var(--ink);}
.sh-days .L{color:var(--acc);font-weight:800;margin-right:8px;}
.sh-days .n{color:var(--faint);font-size:10px;}
.sh-meta{font-size:10px;color:var(--faint);border-top:1px dashed var(--line);padding-top:8px;margin-bottom:9px;}
.sh-acts{display:flex;gap:7px;flex-wrap:wrap;}
.sh-bb{background:var(--field);border:1px solid var(--line);color:var(--ink);font:600 10.5px var(--mono);
  padding:8px 11px;border-radius:7px;cursor:pointer;min-height:34px;}
.sh-bb.p{background:var(--acc);color:var(--acc-ink);border-color:var(--acc);font-weight:700;}
.sh-bb.r{color:var(--down);border-color:color-mix(in srgb,var(--down) 40%,var(--line));}
.sh-newrow{display:flex;gap:8px;margin-top:13px;}
.sh-new{flex:1;background:var(--field);border:1px dashed var(--line);border-radius:9px;color:var(--dim);
  font:600 10.5px var(--mono);padding:11px 4px;text-align:center;cursor:pointer;}
.sh-new .d{color:var(--acc);font-weight:700;}
```

Verifica con Grep che non restino riferimenti a `sheet-card|sheet-nm|sheet-name|sheet-badge|sheet-meta|sheet-acts|sheet-btn|sheet-newrow` né in `app.js` né in `style.css`.

- [ ] **Step 4: Verifica regressioni**

Run: `npm test`
Expected: PASS (341 verdi, nessuna regressione).

- [ ] **Step 5: Commit**

```bash
git add app.js style.css
git commit -m "feat(ui): gestore schede in stile terminale (accordion variante B)"
```

---

### Task 6: editor — sub-header con slug, tab evolute, barra giorno, empty-state

**Files:**
- Modify: `app.js` — import da `./editor.js` (riga 2), `renderPlanEditor` (~righe 119-183)
- Modify: `style.css` — blocco "Editor scheda" (righe ~676-685: `.plan-tabs` … `.pe-empty-hint`)

- [ ] **Step 1: Estendi l'import**

In `app.js` riga 2, aggiungi `tabMiniLabel` all'import:

```js
import { migrate, backfillMuscles, patchPlanV4, patchPlanV5, addExercise, removeExercise, reorderExercise, updateExercise, keepLocalPlan, addDay, renameDay, removeDay, tabMiniLabel } from "./editor.js";
```

- [ ] **Step 2: Modifica `renderPlanEditor`**

Dentro `renderPlanEditor`, sostituisci il ciclo tab (da `for (const d of plan) {` fino a `tabs.appendChild(b); }`) con:

```js
  for (const d of plan) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.day = d.day;
    const L = document.createElement("span"); L.className = "pt-L"; L.textContent = d.day;
    b.appendChild(L);
    const mm = tabMiniLabel(d.title);
    if (mm && mm !== String(d.day).toLowerCase()) {
      const m = document.createElement("span"); m.className = "pt-mm"; m.textContent = mm;
      b.appendChild(m);
    }
    if (d.day === planEditDay) b.classList.add("on");
    b.addEventListener("click", () => { planEditDay = d.day; renderPlanEditor(); });
    tabs.appendChild(b);
  }
```

Sostituisci la riga del sottotitolo (`document.getElementById("planSub").textContent = dp ? ...`) con:

```js
  const totEx = plan.reduce((n, d) => n + (Array.isArray(d.exercises) ? d.exercises.length : 0), 0);
  const sheetName = ((data.sheets || []).find((s) => s.id === data.activeSheetId) || {}).name || "scheda";
  document.getElementById("planSub").textContent =
    `${sheetSlug(sheetName)} · ${plan.length} giorn${plan.length === 1 ? "o" : "i"} · ${totEx} es`;
```

Sostituisci la toolbar del giorno (da `// Toolbar rinomina/elimina...` fino a `body.appendChild(bar);`) con:

```js
    // Barra giorno: titolo intero + rinomina/elimina compatti.
    const bar = document.createElement("div");
    bar.className = "pe-daybar";
    const ttl = document.createElement("div");
    ttl.className = "pe-daytitle";
    const bL = document.createElement("b"); bL.textContent = dp.day;
    ttl.append(bL, document.createTextNode(` — ${dp.title || dp.day}`));
    const ren = document.createElement("button");
    ren.type = "button"; ren.className = "pe-daybtn"; ren.textContent = "✎";
    ren.setAttribute("aria-label", "Rinomina giorno");
    ren.addEventListener("click", renamePlanDay);
    const del = document.createElement("button");
    del.type = "button"; del.className = "pe-daybtn pe-daybtn-del"; del.textContent = "🗑";
    del.setAttribute("aria-label", "Elimina giorno");
    del.addEventListener("click", deletePlanDay);
    bar.append(ttl, ren, del);
    body.appendChild(bar);
```

Sostituisci il ramo empty-state (da `const hint = document.createElement("p");` a `body.appendChild(hint);`) con:

```js
    const hint = document.createElement("p");
    hint.className = "pe-empty-hint";
    const d = document.createElement("span"); d.className = "d"; d.textContent = "$";
    hint.append(d, document.createTextNode(" nessun giorno — tocca ＋ per aggiungerne uno"));
    body.appendChild(hint);
```

- [ ] **Step 3: Aggiorna il CSS di tab/daybar/empty**

In `style.css`, sostituisci il blocco da `.plan-tabs{` a `.pe-empty-hint{...}` (righe ~676-685) con:

```css
.plan-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;}
.plan-tabs button{flex:1 1 auto;min-width:44px;min-height:44px;padding:7px 4px 6px;border-radius:10px;
  border:1px solid var(--line);background:var(--surf);color:var(--dim);cursor:pointer;
  font-family:"JetBrains Mono",monospace;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px;}
.plan-tabs button .pt-L{font-size:14px;font-weight:800;color:var(--ink);line-height:1.1;}
.plan-tabs button .pt-mm{font-size:8px;color:var(--faint);letter-spacing:.02em;max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.plan-tabs button.on{background:var(--acc);border-color:var(--acc);}
.plan-tabs button.on .pt-L{color:var(--acc-ink);}
.plan-tabs button.on .pt-mm{color:var(--acc-ink);opacity:.75;}
.plan-tabs .pe-tab-add{flex:0 0 auto;width:44px;min-width:44px;color:var(--acc);font-size:16px;font-weight:700;}
.pe-daybar{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.pe-daytitle{flex:1;font-size:11px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pe-daytitle b{color:var(--tx);}
.pe-daybtn{flex:none;font-size:12px;color:var(--dim);border:1px solid var(--line);border-radius:7px;
  padding:6px 10px;background:var(--field);cursor:pointer;min-height:34px;}
.pe-daybtn-del{color:var(--down);}
.pe-empty-hint{color:var(--dim);font-size:12px;font-family:"JetBrains Mono",monospace;padding:18px 4px;}
.pe-empty-hint .d{color:var(--acc);font-weight:700;}
```

- [ ] **Step 4: Verifica regressioni**

Run: `npm test`
Expected: PASS (341 verdi).

- [ ] **Step 5: Commit**

```bash
git add app.js style.css
git commit -m "feat(ui): editor con slug nel sub-header, tab evolute e barra giorno compatta"
```

---

### Task 7: editor — righe esercizio numerate (badge SS, `+` accent, rec da restSeconds)

**Files:**
- Modify: `app.js` — `buildPlanRow` (~righe 872-894)
- Modify: `style.css` — `.pe-row`/`.pe-badge` e nuove classi `.pe-ix`/`.pe-ssb` (righe ~687-699)

- [ ] **Step 1: Sostituisci `buildPlanRow`**

```js
// Riga esercizio nell'editor: numero, grip drag, nome+sub, modifica, elimina.
function buildPlanRow(ex, i, count) {
  const row = document.createElement("div");
  row.className = "pe-row" + (ex.superset ? " ss" : "");
  row.dataset.idx = String(i);
  const ix = document.createElement("span"); ix.className = "pe-ix";
  ix.textContent = String(i + 1).padStart(2, "0");
  const grip = document.createElement("span"); grip.className = "pe-grip"; grip.textContent = "⠿";
  const meta = document.createElement("div"); meta.className = "pe-meta";
  const nm = document.createElement("div"); nm.className = "pe-name";
  // Superset: il "+" nel nome è renderizzato in accent ("Pushdown ＋ Curl").
  if (ex.superset && String(ex.name).includes("+")) {
    String(ex.name).split("+").map((p) => p.trim()).forEach((p, k) => {
      if (k > 0) { const sep = document.createElement("span"); sep.className = "pe-ssb"; sep.textContent = " ＋ "; nm.appendChild(sep); }
      nm.appendChild(document.createTextNode(p));
    });
  } else {
    nm.textContent = ex.name;
  }
  if (ex.superset) { const b = document.createElement("span"); b.className = "pe-badge"; b.textContent = "SS"; nm.appendChild(b); }
  const sub = document.createElement("div"); sub.className = "pe-sub";
  // rec sempre da restSeconds (m:ss); fallback recText per piani importati senza
  // restSeconds numerico; se mancano entrambi il segmento è omesso.
  const rec = Number.isFinite(ex.restSeconds) ? `rec ${formatTime(ex.restSeconds)}`
    : (ex.recText ? `rec ${ex.recText}` : "");
  sub.textContent = [
    ex.setsReps, rec,
    ex.bar ? `bilanciere ${ex.bar}kg` : "",
    isDumbbell(ex.name) ? "vol ×2" : "",
    (ex.unit === "sec" || ex.unitB === "sec") ? "a tempo" : "",
  ].filter(Boolean).join(" · ");
  meta.append(nm, sub);
  const edit = document.createElement("button"); edit.type = "button"; edit.className = "pe-ic"; edit.textContent = "✎";
  edit.addEventListener("click", () => openExDialog(planEditDay, ex.id));
  const del = document.createElement("button"); del.type = "button"; del.className = "pe-ic del"; del.textContent = "🗑";
  del.addEventListener("click", () => deletePlanExercise(planEditDay, ex.id, ex.name));
  row.append(ix, grip, meta, edit, del);
  attachDragHandle(row, grip, planEditDay);
  return row;
}
```

Nota: `formatTime` è già importato in `app.js` da `./timer.js` (riga 29) — nessun nuovo import.

- [ ] **Step 2: Aggiorna il CSS delle righe**

In `style.css`, dopo la regola `.pe-row.dragging{...}` aggiungi:

```css
.pe-ix{color:var(--faint);font-size:10px;width:18px;text-align:right;flex:none;font-family:"JetBrains Mono",monospace;}
.pe-row.ss{border-color:var(--line-acc);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 6%,transparent),transparent 60%),var(--surf);}
.pe-ssb{color:var(--acc);}
```

E sostituisci la regola `.pe-badge{...}` con:

```css
.pe-badge{font-size:8px;color:var(--acc);background:transparent;border:1px solid var(--line-acc);
  border-radius:4px;padding:1px 4px;margin-left:6px;letter-spacing:.08em;font-weight:700;vertical-align:2px;}
```

- [ ] **Step 3: Verifica regressioni**

Run: `npm test`
Expected: PASS (341 verdi).

- [ ] **Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat(ui): righe editor numerate, badge SS e rec da restSeconds"
```

---

### Task 8: mockup di riferimento nel repo

**Files:**
- Create: `mockups/gestore-editor-rev1.html` (copia di `.superpowers/brainstorm/30021-1780580444/content/design-finale-gestore-editor.html`)

- [ ] **Step 1: Copia il mockup**

```powershell
Copy-Item ".superpowers\brainstorm\30021-1780580444\content\design-finale-gestore-editor.html" "mockups\gestore-editor-rev1.html"
```

- [ ] **Step 2: Commit**

```bash
git add mockups/gestore-editor-rev1.html
git commit -m "docs(mockups): mockup consolidato gestore+editor rev1"
```

---

### Task 9: bump cache service worker

**Files:**
- Modify: `sw.js:5`

- [ ] **Step 1: Bump della versione**

In `sw.js` riga 5: `const CACHE = "gymsched-v62";` → `const CACHE = "gymsched-v63";`

- [ ] **Step 2: Verifica e commit**

Run: `npm test`
Expected: PASS (341 verdi).

```bash
git add sw.js
git commit -m "chore(sw): bump cache v63 per rollout redesign gestore/editor"
```

---

### Task 10: verifica visiva reale (entrambi i temi)

Nessun file da modificare: solo verifica. Da fare nella sessione principale (serve il browser MCP Playwright).

- [ ] **Step 1: Servi l'app**

```powershell
npx http-server -p 8123
```

(in background; al termine della verifica terminare il processo)

- [ ] **Step 2: Verifica gestore + editor su Graphite e Carta**

Con Playwright (viewport 390×844) su `http://localhost:8123`:
- NB: prima del login `#app` è nascosto — per ispezionare senza login, da console:
  `document.getElementById("auth-screen").hidden = true; document.getElementById("app").style.display = "";`
  (oppure fare login reale se disponibile).
- Aprire il menu → Schede: verificare prompt `$ ls schede/`, blocco attivo espanso con
  giorni/meta/azioni, archivio collassato con meta compatta, accordion al tap,
  riga `$ nuova · $ duplica · $ importa`.
- Aprire `✎ modifica`: verificare sub-header `slug · giorni · es`, tab con lettera+mini-label,
  barra giorno col titolo intero, righe numerate `01..`, badge `SS` sulle righe superset,
  sub-riga con `rec m:ss`.
- Ripetere il giro nel tema Carta (Impostazioni → tema) e screenshot di confronto.
- Console del browser pulita (nessun errore).

- [ ] **Step 3: Suite completa**

Run: `npm test`
Expected: PASS — 341 test verdi.

---

## Self-review (fatto in scrittura)

- Spec coverage: prompt/accordion/azioni/ordinamento/slug/date (Task 5), dayLines (Task 1),
  ordinamento (Task 2), slug+date (Task 3), tab evolute+sub-header+daybar+empty (Task 4+6),
  righe numerate/SS/rec (Task 7), mockup in mockups/ (Task 8), bump SW (Task 9),
  verifica visiva due temi (Task 10). Nessun gap.
- Placeholder: nessuno; ogni step ha codice o comando completo.
- Coerenza nomi: `sortSheetSummaries`/`sheetSlug`/`fmtSheetDate` importati in Task 5 e usati
  in Task 5-6; `tabMiniLabel` importato in Task 6; `formatTime` già presente (riga 29).
