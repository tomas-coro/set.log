# Fase 6 — Fisarmonica + Commenti veloci + Amber — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il modello "un esercizio in focus + lista prossimi" con una lista a fisarmonica a ordine fisso, aggiungere commenti veloci per-serie gestibili dalle impostazioni, e ricolorare l'app in Amber.

**Architecture:** App PWA vanilla JS, nessun build. Logica pura testabile in `store.js`/`session.js` (gate `node --test`), rendering DOM in `app.js`, stile in `style.css`, markup statico in `index.html`. Sync stato via `GitHubStore` su `data.json`. Si implementa in sequenza: prima il data layer dei commenti (TDD), poi palette (CSS), poi il markup, poi il rewrite del rendering a fisarmonica, poi i chip commenti nell'editor, infine la sezione impostazioni e la verifica Playwright.

**Tech Stack:** JavaScript ES modules nel browser, `node:test` + `node:assert/strict` per i test, CSS custom properties.

Spec di riferimento: `docs/superpowers/specs/2026-05-26-fase6-fisarmonica-commenti-veloci-design.md`. Prototipo visivo: `.superpowers/brainstorm/.../content/prototype-amber.html`.

---

## File Structure

- `store.js` — aggiunge `comments: string[]` a `normalizeSet`; nuova funzione pura `toggleComment`.
- `session.js` — nessuna modifica alla logica metriche; le funzioni esistenti ignorano già `comments`.
- `app.js` — `focusIndex` → `openIndex`; `render()` produce un'unica lista; editor (`renderFocusNormal`/`renderFocusSuperset`/`trackBlock`/`persist`) parametrizzati su `idx`; nuova `buildQuickCommentChips`; `setRow` mostra i commenti; helper `getQuickComments`/`setQuickComments`; sezione impostazioni; rimozione `renderUpNext`.
- `style.css` — variabili `:root` Amber; stili lista/card fisarmonica, chip commenti, riga commento, barretta laterale.
- `index.html` — `#focus` + `#upnext` → singolo `#list`; markup sezione "Commenti veloci" nel dialog impostazioni.
- `tests/store.test.js` — test `normalizeSet.comments`, `toggleComment`.

---

## Task 1: Data layer — `comments` su `normalizeSet`

**Files:**
- Modify: `store.js:61-64` (`normalizeSet`)
- Test: `tests/store.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/store.test.js` aggiungi:

```js
test("normalizeSet: comments di default è array vuoto", () => {
  assert.deepEqual(normalizeSet({ reps: "8", kg: "50", done: true }).comments, []);
});

test("normalizeSet: preserva array di commenti, trim e scarta vuoti/non-stringhe", () => {
  const s = normalizeSet({ reps: "6", kg: "55", comments: [" alzare 1kg ", "", 5, "sporca"] });
  assert.deepEqual(s.comments, ["alzare 1kg", "sporca"]);
});

test("normalizeSet: deduplica i commenti mantenendo l'ordine", () => {
  const s = normalizeSet({ comments: ["a", "a", "b"] });
  assert.deepEqual(s.comments, ["a", "b"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (PowerShell, dalla root del repo): `node --test`
Expected: i 3 nuovi test FALLISCONO (`comments` è `undefined`).

- [ ] **Step 3: Implement**

In `store.js`, sostituisci `normalizeSet`:

```js
export function normalizeSet(s) {
  const feel = FEELS.has(s?.feel) ? s.feel : "";
  const raw = Array.isArray(s?.comments) ? s.comments : [];
  const comments = [];
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t && !comments.includes(t)) comments.push(t);
  }
  return { reps: String(s?.reps ?? ""), kg: String(s?.kg ?? ""), done: !!s?.done, feel, warmup: !!s?.warmup, comments };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: tutti verdi (97 esistenti + 3 nuovi).

- [ ] **Step 5: Commit**

```
git add store.js tests/store.test.js
git commit -F <messaggio>  (feat(store): campo comments per-serie in normalizeSet)
```

---

## Task 2: Data layer — `toggleComment`

**Files:**
- Modify: `store.js` (dopo `normalizeSet`)
- Test: `tests/store.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test("toggleComment: aggiunge se assente", () => {
  assert.deepEqual(toggleComment([], "alzare 1kg"), ["alzare 1kg"]);
  assert.deepEqual(toggleComment(["a"], "b"), ["a", "b"]);
});

test("toggleComment: rimuove se presente", () => {
  assert.deepEqual(toggleComment(["a", "b"], "a"), ["b"]);
});

test("toggleComment: trim e niente duplicati", () => {
  assert.deepEqual(toggleComment(["a"], " a "), []);          // 'a' già presente → rimuove
  assert.deepEqual(toggleComment([], "  x  "), ["x"]);
});

test("toggleComment: input vuoto non cambia nulla", () => {
  assert.deepEqual(toggleComment(["a"], "   "), ["a"]);
});
```

Assicurati che l'import in cima al test includa `toggleComment`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL (`toggleComment` non esportata).

- [ ] **Step 3: Implement**

In `store.js` dopo `normalizeSet`:

```js
// Toggle immutabile di un commento in una lista: aggiunge se assente, rimuove se presente.
// Trim; ignora stringa vuota; nessun duplicato.
export function toggleComment(comments, text) {
  const arr = Array.isArray(comments) ? comments.slice() : [];
  const t = String(text ?? "").trim();
  if (!t) return arr;
  const i = arr.indexOf(t);
  if (i === -1) { arr.push(t); return arr; }
  arr.splice(i, 1);
  return arr;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test` → tutti verdi.

- [ ] **Step 5: Commit**

`feat(store): toggleComment helper`

---

## Task 3: Palette Amber (solo CSS)

**Files:**
- Modify: `style.css:1-6` (`:root`) e i punti col verde hardcoded.

- [ ] **Step 1: Sostituisci le variabili `:root`**

```css
:root{
  --bg:#100E0A; --surf:#181511; --surf2:#1E1A14; --line:#2A2620;
  --ink:#EFEBE3; --dim:#938B7B; --faint:#6F685B;
  --acc:#E8A93C; --acc-ink:#241803; --ok:#E8A93C; --down:#E0843F;
  --field:#221D14;
}
```

- [ ] **Step 2: Ricondurre i verdi hardcoded all'ambra**

Cerca in `style.css` i letterali del vecchio accento verde e sostituiscili:
- bordi `#1e4a3b` (usati su `.status.ok`, `.ssbadge`) → `#4a3a1e`.
- sfondo soft `#13352a` (se presente, es. chip/rpe) → `#352815`.

Run: `Select-String -Path style.css -Pattern "#1e4a3b|#13352a|#3FE0A8|3fe0a8"` e sostituisci ogni occorrenza con l'equivalente ambra (`#4a3a1e`, `#352815`, `var(--acc)`).

- [ ] **Step 3: Barretta laterale sull'esercizio aperto**

Aggiungerla nel Task 5 insieme agli stili `.item.open` (quando esiste la lista). Qui solo le variabili e i verdi.

- [ ] **Step 4: Verifica visiva rapida**

Apri `index.html` nel browser: l'app deve apparire interamente ambra, nessun verde residuo.

- [ ] **Step 5: Commit**

`style(ui): palette Amber`

---

## Task 4: Markup — `#list` unico in `index.html`

**Files:**
- Modify: `index.html` (zona `#focus` + `#upnext`, e il dialog impostazioni)

- [ ] **Step 1: Sostituisci i contenitori focus/upnext**

Trova nel body i nodi `#focus`, `#upnextLabel`, `#upnext` (la sezione "prossimi"). Sostituiscili con un singolo contenitore:

```html
<div id="list"></div>
<div id="volRow"></div>
```

(`#volRow` ospita la riga volume unica renderizzata in fondo.)

- [ ] **Step 2: Aggiungi il markup "Commenti veloci" nel dialog impostazioni**

Dentro `#settingsDialog`, prima dei bottoni di chiusura, aggiungi:

```html
<fieldset class="setblock">
  <legend>Commenti veloci</legend>
  <div id="qcList"></div>
  <div class="qc-add">
    <input id="qcInput" type="text" placeholder="nuovo commento…" autocomplete="off">
    <button type="button" id="qcAdd">+</button>
  </div>
</fieldset>
```

- [ ] **Step 3: Verifica**

Apri `index.html`: la pagina carica senza errori in console (la lista sarà vuota finché Task 5 non ridisegna). Il dialog impostazioni mostra la sezione commenti veloci (vuota).

- [ ] **Step 4: Commit**

`refactor(ui): contenitore lista unico + sezione impostazioni commenti`

---

## Task 5: Rendering a fisarmonica (`app.js`)

**Files:**
- Modify: `app.js` (stato, `render`, `renderFocus*`, `renderUpNext`, `persist`, `changeWeek`/`changeDay`, CTA di completamento)
- Modify: `style.css` (stili lista/card/barretta)

- [ ] **Step 1: Stato `openIndex`**

Sostituisci `let focusIndex = 0;` con `let openIndex = null;`. Tutte le occorrenze di `focusIndex` come "esercizio su cui operare" diventano l'indice passato esplicitamente (vedi step seguenti). `changeWeek` e `changeDay` impostano `openIndex = null;` (rimuovi le righe `focusIndex = activeExerciseIndex(...)`).

- [ ] **Step 2: Parametrizza l'editor su `idx`**

Cambia le firme:
- `renderFocusNormal(ex, idx, container)` e `renderFocusSuperset(ex, idx, container)` — usano `idx` al posto di `focusIndex` ovunque (negli `getEntry`, `setEntry`, `withSet`, `prefillSets`, `buildNoteField`, `previousSetInSession`, ecc.) e renderizzano dentro `container` invece di `document.getElementById("focus")`.
- `trackBlock(trackKey, trackName, trackEntry, tgtTrack, prevSets, state, idx)` — usa `idx`.
- `buildNoteField(superset, idx)` — usa `idx`.
- `persist(idx)` — bufferizza l'entry di `idx` (`bufferEdit(currentWeek, currentDay, idx, getEntry(...))`).

Negli handler che oggi fanno `if (isComplete(focusIndex)) focusIndex = activeExerciseIndex(...)`, sostituisci con la logica del prossimo aperto (Step 4).

- [ ] **Step 3: Nuova `render()` a lista**

Sostituisci `renderFocus()` + `renderUpNext()` con una funzione che popola `#list`:

```js
function renderList() {
  const root = document.getElementById("list");
  root.textContent = "";
  const dp = dayPlan();
  dp.exercises.forEach((ex, i) => {
    const item = document.createElement("div");
    item.className = "item" + (isComplete(i) ? " done" : "") + (i === openIndex ? " open" : "");

    const r = document.createElement("div");
    r.className = "r";
    r.addEventListener("click", () => { openIndex = (openIndex === i ? null : i); render(); });

    const id = document.createElement("span"); id.className = "id"; id.textContent = String(i + 1).padStart(2, "0");
    const mid = document.createElement("div"); mid.className = "mid";
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = ex.name;
    if (ex.superset) { const b = document.createElement("span"); b.className = "ssbadge"; b.textContent = "superset"; nm.appendChild(b); }
    const sub = document.createElement("div"); sub.className = "sub";
    sub.textContent = `${ex.setsReps} · rec ${getRest(currentDay, i, ex.restSeconds)}″`;
    mid.append(nm, sub);

    const right = document.createElement("div"); right.className = "right";
    if (isComplete(i)) { const c = document.createElement("span"); c.className = "chk"; c.textContent = "✓"; right.appendChild(c); }
    else if (ex.superset) { const best = document.createElement("div"); best.className = "best"; best.textContent = "A·B"; const bl = document.createElement("div"); bl.className = "bl"; bl.textContent = "2 tracce"; right.append(best, bl); }
    else { const bk = bestKg(data, currentDay, i); const best = document.createElement("div"); best.className = "best"; best.textContent = bk === null ? "—" : bk + " kg"; const bl = document.createElement("div"); bl.className = "bl"; bl.textContent = "best"; right.append(best, bl); }

    const caret = document.createElement("span"); caret.className = "caret"; caret.textContent = "▾";
    r.append(id, mid, right, caret);
    item.appendChild(r);

    const body = document.createElement("div"); body.className = "body";
    if (i === openIndex) {
      if (ex.superset) renderFocusSuperset(ex, i, body);
      else renderFocusNormal(ex, i, body);
    }
    item.appendChild(body);
    root.appendChild(item);
  });
}
```

E la riga volume, unica, in `#volRow`:

```js
function renderVolRow() {
  const root = document.getElementById("volRow");
  root.textContent = "";
  const vol = sessionVolume(data, currentWeek, currentDay, dayPlan());
  const prevVol = sessionVolume(data, prevWeekKey(), currentDay, dayPlan());
  root.appendChild(buildVolumeRow(vol, prevVol));
}
```

Rimuovi la `card.appendChild(buildVolumeRow(...))` da dentro `renderFocusNormal`/`renderFocusSuperset` (ora è in `renderVolRow`). Le funzioni editor renderizzano dentro `container` (il `body`), non più creando la `.focus` card in `#focus`: il loro nodo radice diventa `container` e gli `append` vanno su `container`.

- [ ] **Step 4: Auto-apertura del prossimo dopo completamento**

Nelle due CTA "Serie fatta" (normale e superset), dopo `persist(idx)` e `startRest(...)`:

```js
render();  // prima ridisegna lo stato della serie
if (isEntryComplete(getEntry(data, currentWeek, currentDay, idx), ex)) {
  openIndex = activeExerciseIndex(data, currentWeek, currentDay, dayPlan());
  render();
}
```

(`activeExerciseIndex` ritorna il primo non completo; se tutti completi ritorna 0 — accettabile.)

- [ ] **Step 5: Aggiorna `render()` e `renderProgress`**

```js
function render() {
  renderHeader();
  renderProgress();
  renderList();
  renderVolRow();
}
```

In `renderProgress`, il segmento in accento è quello con `i === openIndex` (salta l'evidenziazione se `openIndex === null`); l'etichetta: se `openIndex !== null` mostra `String(openIndex+1)/total`, altrimenti `<completati>/total`.

- [ ] **Step 6: Stili lista/card (style.css)**

Aggiungi:

```css
.list{margin-top:16px;display:flex;flex-direction:column;gap:10px;}
.item{background:var(--surf);border:1px solid var(--line);border-radius:16px;overflow:hidden;position:relative;}
.item.open{border-color:var(--acc);}
.item.open::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--acc);}
.item .r{display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;}
.item .r .id{font-family:"JetBrains Mono",monospace;color:var(--acc);font-size:13px;width:20px;}
.item .r .mid{flex:1;min-width:0;}
.item .r .nm{font-size:16px;font-weight:700;letter-spacing:-.01em;}
.item .r .sub{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--dim);margin-top:2px;}
.item .r .right{text-align:right;font-family:"JetBrains Mono",monospace;}
.item .r .best{font-size:14px;font-weight:700;} .item .r .bl{font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.1em;}
.item.done .nm{color:var(--dim);} .item .chk{color:var(--acc);font-size:16px;}
.item .caret{color:var(--faint);font-size:13px;transition:transform .15s;}
.item.open .caret{transform:rotate(180deg);color:var(--acc);}
.item .body{display:none;padding:0 14px 16px;border-top:1px solid var(--line);}
.item.open .body{display:block;}
```

Nota: l'editor dentro `.body` riusa gli stili esistenti (`.sets`, `.srow`, `.editblock`, `.stepper`, `.rpebar`, `.cta`, `.noteblock`). Verifica che non dipendano dall'essere figli di `.focus`; se qualche selettore è `.focus .xxx`, allentalo (rimuovi il prefisso `.focus`).

- [ ] **Step 7: Verifica manuale**

Apri `index.html`. Atteso: 7 esercizi in ordine fisso, tutti chiusi; tap apre/chiude; uno solo aperto; ri-tap chiude tutto; "Serie fatta" su un esercizio completato apre il prossimo; cambio giorno/settimana chiude tutto; console pulita.

- [ ] **Step 8: Commit**

`feat(ui): lista esercizi a fisarmonica (openIndex)`

---

## Task 6: Chip commenti nell'editor + visualizzazione su `setRow`

**Files:**
- Modify: `app.js` (`buildQuickCommentChips`, `renderFocusNormal`, `trackBlock`, `setRow`, draft state)
- Modify: `style.css` (chip, riga commento)

- [ ] **Step 1: Helper presets in `app.js`**

```js
const QC_KEY = "gymsched_quickcomments";
const QC_DEFAULT = ["alzare 1kg", "diminuire leggermente", "ultima reps forzata/sporca"];
function getQuickComments() {
  try { const v = JSON.parse(localStorage.getItem(QC_KEY)); if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()); } catch (_) {}
  return QC_DEFAULT.slice();
}
function setQuickComments(arr) { localStorage.setItem(QC_KEY, JSON.stringify(arr)); }
```

Importa `toggleComment` da `./store.js` in cima a `app.js`.

- [ ] **Step 2: `buildQuickCommentChips`**

```js
// Riga di chip commenti per la serie corrente. `selected` = array commenti già scelti.
// onToggle(text) e onWrite() (chip "+ scrivi").
function buildQuickCommentChips(selected, onToggle, onWrite) {
  const wrap = document.createElement("div"); wrap.className = "chips";
  for (const text of getQuickComments()) {
    const c = document.createElement("span");
    c.className = "chip" + (selected.includes(text) ? " on" : "");
    c.textContent = text;
    c.addEventListener("click", () => onToggle(text));
    wrap.appendChild(c);
  }
  const w = document.createElement("span"); w.className = "chip write"; w.textContent = "+ scrivi";
  w.addEventListener("click", onWrite);
  wrap.appendChild(w);
  return wrap;
}
```

- [ ] **Step 3: Bozza commenti + chip in `renderFocusNormal`**

Aggiungi `comments: []` a `draft` quando lo inizializzi:
```js
draft = { kg: prev[curIdx]?.kg ?? "", reps: prev[curIdx]?.reps ?? repsLow(tgt.reps), comments: (entry.sets[curIdx]?.comments ?? []).slice() };
```
Dopo `buildRpeBar(...)` aggiungi un'etichetta + i chip:
```js
const qcLabel = document.createElement("div"); qcLabel.className = "editlabel"; qcLabel.textContent = "commento veloce";
container.appendChild(qcLabel);
const chips = buildQuickCommentChips(draft.comments,
  (text) => { draft.comments = toggleComment(draft.comments, text); render(); },
  () => { const t = prompt("Commento:"); if (t && t.trim()) { draft.comments = toggleComment(draft.comments, t.trim()); render(); } });
container.appendChild(chips);
```
Nella CTA "Serie fatta", includi i commenti nel patch:
```js
withSet(v, curIdx, { reps: draft.reps, kg: draft.kg, done: true, feel: entry.sets[curIdx]?.feel ?? "", comments: draft.comments })
```

- [ ] **Step 4: Stesso nei superset (`trackBlock`)**

Aggiungi `comments` allo `state` della traccia, i chip dopo la `buildRpeBar` della traccia, e includi `comments: state.comments` nel patch della CTA superset per A e B (usa `draftA.comments`/`draftB.comments`).

- [ ] **Step 5: Visualizza i commenti su `setRow`**

In `setRow`, dopo aver gestito feel, se `set.done && set.comments?.length`, aggiungi un nodo a tutta riga:
```js
if (set.done && Array.isArray(set.comments) && set.comments.length) {
  const c = document.createElement("div"); c.className = "cmt";
  c.textContent = set.comments.join(" · ");
  if (onFeel) { c.title = "Tocca per modificare"; c.style.cursor = "pointer";
    c.addEventListener("click", (e) => { e.stopPropagation(); onEditComments && onEditComments(); }); }
  row.appendChild(c);
}
```
Aggiungi un parametro `onEditComments` a `setRow`. Per una serie fatta, `onEditComments` apre un `prompt` semplice che mostra i commenti separati da `;`, li ri-parsa e li salva via `withSet(v, i, { comments: [...] })` → `persist(idx); render();`. (Editing rapido sufficiente; il picker inline completo è fuori scope.)

`.cmt` ha `flex-basis:100%` quindi va a capo sotto i numeri.

- [ ] **Step 6: Stili chip + commento (style.css)**

```css
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px;}
.chip{background:var(--surf2);border:1px solid var(--line);border-radius:999px;padding:8px 13px;font-size:13px;color:var(--ink);cursor:pointer;}
.chip.on{background:#352815;border-color:var(--acc);color:var(--acc);font-weight:700;}
.chip.write{color:var(--acc);border-style:dashed;}
.srow{flex-wrap:wrap;}
.srow .cmt{flex-basis:100%;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--dim);margin:2px 0 0 27px;}
```

- [ ] **Step 7: Verifica manuale**

Esercizio aperto: i chip compaiono sotto facile/giusta/dura; tap aggancia (diventa ambra), ri-tap stacca; "+ scrivi" chiede testo. Dopo "Serie fatta" il commento appare sotto la serie. Verifica che il volume NON cambi aggiungendo commenti.

- [ ] **Step 8: Commit**

`feat(ui): commenti veloci per serie con chip`

---

## Task 7: Gestione commenti veloci nelle Impostazioni

**Files:**
- Modify: `app.js` (`wireSettings`)

- [ ] **Step 1: Render della lista nel dialog**

In `wireSettings`, all'apertura del dialog, popola `#qcList`:
```js
function renderQcList() {
  const root = document.getElementById("qcList"); root.textContent = "";
  getQuickComments().forEach((text, i) => {
    const row = document.createElement("div"); row.className = "qc";
    const t = document.createElement("span"); t.className = "txt"; t.textContent = text;
    const del = document.createElement("span"); del.className = "del"; del.textContent = "✕";
    del.addEventListener("click", () => { const arr = getQuickComments(); arr.splice(i, 1); setQuickComments(arr); renderQcList(); });
    row.append(t, del); root.appendChild(row);
  });
}
```
Chiama `renderQcList()` nel click di `settingsBtn` (dove già imposti token/bar/plates).

- [ ] **Step 2: Aggiunta**

```js
document.getElementById("qcAdd").addEventListener("click", () => {
  const inp = document.getElementById("qcInput"); const t = inp.value.trim();
  if (!t) return;
  const arr = getQuickComments(); if (!arr.includes(t)) arr.push(t);
  setQuickComments(arr); inp.value = ""; renderQcList();
});
```
(Collega l'handler una sola volta, in `wireSettings`, non a ogni apertura.)

- [ ] **Step 3: Stili sezione (style.css)**

```css
.setblock{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:14px;}
.setblock legend{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:.1em;padding:0 6px;}
.qc{display:flex;align-items:center;gap:10px;background:var(--surf2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-top:8px;}
.qc .txt{flex:1;font-size:14px;} .qc .del{color:var(--down);cursor:pointer;font-family:"JetBrains Mono",monospace;}
.qc-add{display:flex;gap:8px;margin-top:10px;}
.qc-add input{flex:1;background:var(--field);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);}
.qc-add button{background:var(--acc);color:var(--acc-ink);border:none;border-radius:10px;padding:0 16px;font-weight:800;cursor:pointer;}
```

- [ ] **Step 4: Verifica manuale**

Apri ⚙: la lista mostra i 3 default; aggiungi un commento → appare; eliminane uno → sparisce; riapri la sessione → i chip riflettono la lista aggiornata.

- [ ] **Step 5: Commit**

`feat(settings): gestione commenti veloci`

---

## Task 8: Verifica end-to-end + gate completo

- [ ] **Step 1: `node --test`** → tutti verdi (97 + nuovi).

- [ ] **Step 2: Playwright (browser reale)**

Servi la cartella (`python -m http.server` o equivalente) e verifica:
- lista a fisarmonica: ordine fisso, tutto chiuso all'avvio, uno aperto alla volta, chiusura a zero;
- "Serie fatta" che completa un esercizio apre il prossimo attivo;
- chip commenti: aggancio/stacco, "+ scrivi", commento visibile sulla serie, modifica via tap;
- impostazioni: aggiungi/elimina commento riflesso nei chip;
- palette ambra ovunque, nessun verde residuo;
- console pulita.

- [ ] **Step 3: Commit finale eventuale** e push (richiede OK utente per push diretto su main).

---

## Self-Review (esito)

- **Spec coverage:** Parte 1 (fisarmonica) → Task 4,5; Parte 2 (commenti) → Task 1,2,6,7; Parte 3 (Amber) → Task 3 (+ stili nei task UI). Comportamenti decisi (tutto chiuso all'avvio → Task 5 Step 1; apre il prossimo → Task 5 Step 4) coperti.
- **Placeholder scan:** nessun TODO/TBD; ogni step UI ha codice reale. Le verifiche DOM sono manuali/Playwright per scelta (no unit test DOM in questo stack).
- **Type consistency:** `comments: string[]` coerente tra `normalizeSet`, `toggleComment`, `withSet` patch, `setRow`, draft state; `openIndex` (null|number) coerente in `render`/`renderList`/`renderProgress`/`changeWeek`/`changeDay`; firme `renderFocusNormal(ex, idx, container)` / `renderFocusSuperset(ex, idx, container)` / `trackBlock(...idx)` / `persist(idx)` usate uniformemente.
