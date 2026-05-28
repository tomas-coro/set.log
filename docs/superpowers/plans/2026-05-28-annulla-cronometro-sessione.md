# Annulla cronometro sessione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una ✕ esplicita (con conferma) al pill del cronometro sessione che annulla solo il cronometro del giorno corrente, lasciando intatte le serie loggate.

**Architecture:** La cancellazione è una rimozione immutabile di una chiave dalla mappa `gymsched_session` in `localStorage`. La trasformazione pura vive in `timer.js` (testata con `node --test`); il wiring DOM (bottone ✕ + `confirm` + re-render) sta in `app.js`; lo stile in `style.css`.

**Tech Stack:** Vanilla JS (ES modules), `node:test` per la logica pura, CSS puro. Nessuna dipendenza nuova.

---

### Task 1: Funzione pura `withoutSession` (timer.js)

**Files:**
- Modify: `timer.js` (append in fondo, dopo `remainingSeconds`)
- Test: `tests/timer.test.js` (aggiorna l'import esistente + appendi i test)

- [ ] **Step 1: Aggiorna l'import del test e scrivi i test falliti**

In `tests/timer.test.js`, cambia la riga di import esistente:

```js
import { formatTime, remainingSeconds } from "../timer.js";
```

in:

```js
import { formatTime, remainingSeconds, withoutSession } from "../timer.js";
```

Poi appendi in fondo al file:

```js
test("withoutSession rimuove una chiave in modo immutabile", () => {
  const map = {
    "2026-W23-A": { start: "x", end: null },
    "2026-W23-B": { start: "y", end: null },
  };
  const out = withoutSession(map, "2026-W23-A");
  assert.deepEqual(out, { "2026-W23-B": { start: "y", end: null } });
  assert.ok("2026-W23-A" in map, "l'input non deve essere mutato");
});

test("withoutSession: chiave assente -> copia invariata", () => {
  const map = { "2026-W23-A": { start: "x", end: null } };
  assert.deepEqual(withoutSession(map, "nope"), { "2026-W23-A": { start: "x", end: null } });
});

test("withoutSession: input non-oggetto -> {}", () => {
  assert.deepEqual(withoutSession(null, "k"), {});
  assert.deepEqual(withoutSession(undefined, "k"), {});
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `node --test tests/timer.test.js`
Expected: FAIL — `withoutSession is not a function` (o export mancante).

- [ ] **Step 3: Implementa `withoutSession` in timer.js**

Appendi in fondo a `timer.js`:

```js
// Ritorna una nuova mappa-sessione (gymsched_session) senza `key`, senza mutare
// l'input. Robusta a `map` null/non-oggetto (ritorna {}).
export function withoutSession(map, key) {
  const out = {};
  if (map && typeof map === "object") {
    for (const k of Object.keys(map)) if (k !== key) out[k] = map[k];
  }
  return out;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `node --test tests/timer.test.js`
Expected: PASS (tutti i test del file, vecchi e nuovi).

- [ ] **Step 5: Commit**

```bash
git add timer.js tests/timer.test.js
git commit -m "feat(timer): withoutSession — rimozione immutabile dalla mappa sessione"
```

---

### Task 2: Wiring DOM — ✕ sul pill + `cancelSessionClock` (app.js)

**Files:**
- Modify: `app.js:21` (import)
- Modify: `app.js:488-498` (`renderSessClock`)
- Modify: `app.js` blocco "Cronometro sessione" (nuova `cancelSessionClock`, dopo `endSessionClock`)

- [ ] **Step 1: Aggiorna l'import di timer.js**

In `app.js:21`, cambia:

```js
import { RestTimer, formatTime } from "./timer.js";
```

in:

```js
import { RestTimer, formatTime, withoutSession } from "./timer.js";
```

- [ ] **Step 2: Aggiungi `cancelSessionClock`**

Subito dopo la funzione `endSessionClock()` (≈ `app.js:480`), inserisci:

```js
// Annulla il cronometro del giorno corrente (es. sessione avviata per sbaglio).
// Rimuove SOLO la voce gymsched_session: le serie loggate (in `data`) restano intatte.
function cancelSessionClock() {
  setSessionMap(withoutSession(getSessionMap(), sessClockKey()));
  renderSessClock();
}
```

- [ ] **Step 3: Riscrivi `renderSessClock` per costruire testo + bottone ✕**

Sostituisci l'intera funzione `renderSessClock` (`app.js:488-498`):

```js
function renderSessClock() {
  const el = document.getElementById("sessClock");
  if (!el) return;
  const c = getSessionMap()[sessClockKey()];
  if (!c || !c.start) { el.classList.add("hidden"); return; }
  const startMs = Date.parse(c.start);
  const endMs = c.end ? Date.parse(c.end) : Date.now();
  el.textContent = (c.end ? "⏱ allenamento " : "⏱ in corso · ") + fmtDuration((endMs - startMs) / 1000);
  el.classList.toggle("ended", !!c.end);
  el.classList.remove("hidden");
}
```

con:

```js
function renderSessClock() {
  const el = document.getElementById("sessClock");
  if (!el) return;
  const c = getSessionMap()[sessClockKey()];
  if (!c || !c.start) { el.classList.add("hidden"); return; }
  const startMs = Date.parse(c.start);
  const endMs = c.end ? Date.parse(c.end) : Date.now();
  const txt = document.createElement("span");
  txt.className = "sc-t";
  txt.textContent = (c.end ? "⏱ allenamento " : "⏱ in corso · ") + fmtDuration((endMs - startMs) / 1000);
  const x = document.createElement("button");
  x.type = "button";
  x.className = "sc-x";
  x.textContent = "✕";
  x.setAttribute("aria-label", "Annulla cronometro");
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm("Annullare il cronometro di questo allenamento? Le serie loggate restano salvate.")) {
      cancelSessionClock();
    }
  });
  el.replaceChildren(txt, x);
  el.classList.toggle("ended", !!c.end);
  el.classList.remove("hidden");
}
```

- [ ] **Step 4: Verifica che la suite resti verde (nessuna regressione)**

Run: `node --test`
Expected: PASS (le modifiche a `app.js` non sono coperte da unit test; il comando conferma solo che nulla di esistente si è rotto).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat(session): tasto annulla (X) sul pill del cronometro"
```

---

### Task 3: Stile della ✕ (style.css)

**Files:**
- Modify: `style.css:520-524` (blocco `.sessclock`, aggiungi `.sc-x` dopo)

- [ ] **Step 1: Aggiungi le regole `.sc-x`**

Subito dopo `.sessclock.hidden{display:none;}` (`style.css:524`), inserisci:

```css
.sc-x{margin-left:8px;display:inline-flex;align-items:center;justify-content:center;
  min-width:24px;min-height:24px;padding:2px 4px;border:0;background:none;cursor:pointer;
  color:inherit;font-size:13px;line-height:1;opacity:.75;}
.sc-x:hover,.sc-x:focus-visible{opacity:1;}
```

`color:inherit` fa seguire alla ✕ il colore del pill (acceso quando corre, attenuato quando `.ended`).

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "style(session): stile X annulla cronometro"
```

---

### Task 4: Verifica manuale in browser + bump cache SW

**Files:**
- Modify: `sw.js` (bump della costante `CACHE`, per far comparire il banner "nuova versione" sul telefono)

- [ ] **Step 1: Bump della cache del service worker**

In `sw.js:5`, cambia:

```js
const CACHE = "gymsched-v41";
```

in:

```js
const CACHE = "gymsched-v42";
```

Serve a rendere `sw.js` byte-diverso così il telefono rileva l'aggiornamento e mostra il banner "nuova versione".

- [ ] **Step 2: Avvia un server statico locale**

Run: `python -m http.server 8000`
(oppure qualunque static server). Apri `http://localhost:8000` nel browser.

- [ ] **Step 3: Verifica il flusso (checklist manuale)**

1. Tocca "Serie fatta · avvia recupero" su un esercizio → compare il pill `⏱ in corso · …` con una ✕ a destra.
2. Tap sulla ✕ → compare la conferma. **Premi Annulla** → il cronometro continua a correre.
3. Tap sulla ✕ → **conferma** → il pill sparisce; le serie loggate restano visibili e invariate.
4. Tocca di nuovo "Serie fatta" → il cronometro riparte da `0:00`.
5. Completa tutti gli esercizi del giorno → il pill passa a `⏱ allenamento …` (attenuato) → la ✕ è ancora presente e lo rimuove.

- [ ] **Step 4: Commit del bump + push**

```bash
git add sw.js
git commit -m "chore(sw): bump cache per release annulla cronometro"
git push
```

---

## Note per chi esegue

- Il progetto è ESM (`"type": "module"`). I test importano dal modulo (`../timer.js`).
- `app.js` non è importabile in Node (ha side-effect DOM + `boot()`): per questo la logica testata sta in `timer.js`, non in `app.js`.
- Non toccare `data`, `sessionVolume`, le note né il timer di recupero: fuori scope.
