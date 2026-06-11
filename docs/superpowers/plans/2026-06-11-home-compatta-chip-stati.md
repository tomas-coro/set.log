# Home compatta + chip sessione "accesa/spenta" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compattare la home (controlli su una riga sola + bottone Avvia a tutta larghezza) e rendere inconfondibili gli stati della chip sessione (in corso ambra con pallino pulsante vs in pausa grigia spenta), senza toccare la logica del cronometro.

**Architecture:** Puro restyle DOM/CSS + ritocco di rendering in `app.js`. La logica pura (`timer.js`: `normalizeSessionEntry`/`elapsedMs`/`sessionState`) NON cambia, quindi la suite Node esistente è la rete di sicurezza di regressione. `renderSessionControl` marca lo stato corrente su `#sessClock.dataset.state`; `tickSessionDisplays` ricostruisce lo slot solo al cambio di stato (così l'animazione del pallino non si resetta a ogni secondo) e altrimenti aggiorna solo il testo del tempo.

**Tech Stack:** Vanilla JS ESM, `node --test`, CSS con token semantici (`var(--…)`), Service Worker con cache versionata.

**Spec di riferimento:** `docs/superpowers/specs/2026-06-11-home-compatta-chip-stati-design.md`

---

## File Structure

| File | Responsabilità in questo piano |
|---|---|
| `index.html` | Avvolge `.day-tabs` + `#weekSelect` + `#newWeekBtn` in `.ctl-row`; `#newWeekBtn` testo `+ Sett.` → `+`. |
| `style.css` | `.ctl-row` (riga unica), `.btn-add` (bottone `+` quadrato), Avvia full-width su `.sessclock.ready`, `.sessclock.paused` (grigio spento), `.sc-dot` + keyframes pulse + reduced-motion. |
| `app.js` | `renderSessionControl` (classi stato `running`/`paused`, pallino come elemento, `dataset.state`, tempo isolato in `#sessClockText`); helper `clockText`; `tickSessionDisplays` (guardia di stato, aggiorna solo il tempo); `renderFocusOverlay` usa `clockText`. |
| `sw.js` | Bump `CACHE` `gymsched-v72` → `gymsched-v73`. |

**Nessun test puro nuovo:** le modifiche sono DOM/CSS in `app.js` (entry non sotto test unitario) + CSS. Ogni task usa `npm test` come **regressione** (la suite deve restare verde, 416) + verifica manuale finale (Task 5).

---

## Task 1: Home compatta — riga di controllo unica + Avvia full-width

**Files:**
- Modify: `index.html:99-108`
- Modify: `style.css:609` (`.sessclock.ready`), e aggiunta dopo `style.css:1031`

- [ ] **Step 1: `index.html` — avvolgi i controlli in `.ctl-row`**

`index.html:99-108`, sostituisci:

```html
    <div class="day-tabs" id="dayTabs">
      <button data-day="A" class="on">A</button>
      <button data-day="B">B</button>
      <button data-day="C">C</button>
    </div>

    <div class="week-row">
      <select id="weekSelect" aria-label="Settimana"></select>
      <button id="newWeekBtn" class="btn-soft">+ Sett.</button>
    </div>
```

con:

```html
    <div class="ctl-row">
      <div class="day-tabs" id="dayTabs">
        <button data-day="A" class="on">A</button>
        <button data-day="B">B</button>
        <button data-day="C">C</button>
      </div>
      <select id="weekSelect" aria-label="Settimana"></select>
      <button id="newWeekBtn" class="btn-soft btn-add" aria-label="Aggiungi settimana">+</button>
    </div>
```

(L'`id` `newWeekBtn` resta: l'handler `newWeek` in `wireApp` non si tocca. `btn-soft` resta per ereditare i colori; `btn-add` aggiunge solo la forma quadrata.)

- [ ] **Step 2: `style.css` — Avvia a tutta larghezza nello stato PRONTO**

`style.css:609`, sostituisci:

```css
.sessclock.ready{background:none;border:none;padding:0;}
```

con:

```css
.sessclock.ready{background:none;border:none;padding:0;display:block;width:100%;}
```

E nella regola `.sc-start` (riga ~610-611), aggiungi `width:100%;` in fondo alle dichiarazioni:

```css
.sc-start{font-family:"JetBrains Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.04em;
  color:var(--acc-ink);background:var(--acc);border:none;border-radius:9px;padding:10px 18px;cursor:pointer;min-height:42px;width:100%;}
```

- [ ] **Step 3: `style.css` — regole `.ctl-row` + `.btn-add`**

In `style.css`, **dopo la riga 1031** (fine del blocco skin `/* ===== Home: week-row ===== */`, ovvero dopo `color:var(--acc); }` di `.btn-soft`), aggiungi:

```css
/* ===== Home: riga di controllo unica (giorni · settimana · aggiungi) ===== */
.ctl-row{display:flex;align-items:stretch;gap:7px;margin-top:12px;}
.ctl-row .day-tabs{flex:1 1 auto;margin-top:0;}
.ctl-row .day-tabs button{flex:1 1 0;min-width:0;padding:8px 0;}
.ctl-row #weekSelect{flex:1 1 auto;min-width:0;margin-top:0;}
.ctl-row #newWeekBtn{flex:0 0 42px;}
.btn-add{padding:0;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;}
```

(`.ctl-row .day-tabs button` ha specificità 0,2,1 → vince sullo skin `.day-tabs button` di riga 1017; i 3 tab diventano flex-uguali e sottili. Il `<select>` e i tab si dividono lo spazio ~50/50, il `+` resta 42px. Rapporti affinabili in verifica.)

- [ ] **Step 4: Verifica regressione + JS intatto**

Run: `npm test`
Expected: PASS — suite verde (416). Conferma che nulla in `app.js`/import si è rotto (nessun test importa `index.html`/`style.css`).

- [ ] **Step 5: Commit**

```bash
git add index.html style.css
git commit -m "feat(home): controlli su una riga + Avvia a tutta larghezza"
```

---

## Task 2: Chip "accesa vs spenta" — pallino pulsante + stato pausa grigio

**Files:**
- Modify: `app.js:1450` (branch empty), `app.js:1455-1456` (classi), `app.js:1468-1474` (indicatore)
- Modify: `style.css` (dopo riga 617, fine blocco `.sc-toggle`)

- [ ] **Step 1: `app.js` — marca `dataset.state` anche nel branch piano-vuoto**

`app.js:1450`, sostituisci:

```js
  if (planIsEmpty(data)) { el.replaceChildren(); el.classList.add("hidden"); return; }
```

con:

```js
  if (planIsEmpty(data)) { el.replaceChildren(); el.classList.add("hidden"); el.dataset.state = "EMPTY"; return; }
```

- [ ] **Step 2: `app.js` — classi di stato + `dataset.state`**

`app.js:1455-1456`, sostituisci:

```js
  el.classList.toggle("ended", state === "FINITO");
  el.classList.toggle("ready", state === "PRONTO");
```

con:

```js
  el.classList.toggle("ended", state === "FINITO");
  el.classList.toggle("ready", state === "PRONTO");
  el.classList.toggle("running", state === "IN_CORSO");
  el.classList.toggle("paused", state === "IN_PAUSA");
  el.dataset.state = state;
```

- [ ] **Step 3: `app.js` — indicatore come elemento, tempo isolato in `#sessClockText`**

`app.js:1468-1474`, sostituisci:

```js
  const secs = elapsedMs(entry, Date.now()) / 1000;
  const prefix = state === "FINITO" ? "⏱ allenamento " : state === "IN_PAUSA" ? "⏸ in pausa · " : "● in corso · ";
  const txt = document.createElement("span");
  txt.className = "sc-t";
  txt.id = "sessClockText";
  txt.textContent = prefix + fmtDuration(secs);
  el.replaceChildren(txt);
```

con:

```js
  const secs = elapsedMs(entry, Date.now()) / 1000;
  const txt = document.createElement("span");
  txt.className = "sc-t";
  txt.id = "sessClockText";
  txt.textContent = fmtDuration(secs); // SOLO il tempo: il tick aggiorna questo nodo
  const kids = [];
  if (state === "IN_CORSO") {
    const dot = document.createElement("span");
    dot.className = "sc-dot";
    kids.push(dot, document.createTextNode("in corso · "), txt);
  } else if (state === "IN_PAUSA") {
    const ico = document.createElement("span");
    ico.className = "sc-ico";
    ico.textContent = "⏸";
    kids.push(ico, document.createTextNode("in pausa · "), txt);
  } else { // FINITO
    kids.push(document.createTextNode("⏱ allenamento "), txt);
  }
  el.replaceChildren(...kids);
```

(Le righe successive — bottone `toggle` ⏸/▶ e `x` ✕, poi `el.append(toggle, x)` — restano invariate.)

- [ ] **Step 4: `style.css` — stato pausa grigio + pallino pulsante**

In `style.css`, **dopo la riga 617** (`.sc-toggle:hover,.sc-toggle:focus-visible{opacity:1;}`), aggiungi:

```css
/* In corso: pallino ambra che pulsa. In pausa: chip grigia spenta. */
.sc-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);
  display:inline-block;margin-right:7px;flex:0 0 auto;animation:scpulse 1.3s ease-in-out infinite;}
.sc-ico{margin-right:6px;}
.sessclock.paused{color:var(--dim);border-color:var(--line);}
@keyframes scpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.3;transform:scale(.7);}}
@media (prefers-reduced-motion:reduce){.sc-dot{animation:none;}}
```

- [ ] **Step 5: Verifica regressione**

Run: `npm test`
Expected: PASS — suite verde (416). (Nessuna logica pura toccata; conferma niente errori di sintassi in `app.js`.)

> Nota: a questo punto il pallino pulsa ma `tickSessionDisplays` ricostruisce ancora lo slot ogni secondo (animazione che si resetta). Lo risolve il Task 3. L'app resta comunque funzionante.

- [ ] **Step 6: Commit**

```bash
git add app.js style.css
git commit -m "feat(sessione): chip accesa (pallino pulsante) vs in pausa grigia"
```

---

## Task 3: Tick fluido (guardia di stato) + helper `clockText`

**Files:**
- Modify: `app.js:1439` (aggiunta helper dopo `fmtDuration`), `app.js:1504-1513` (`tickSessionDisplays`), `app.js:3131` (`renderFocusOverlay`)

- [ ] **Step 1: `app.js` — helper `clockText` dopo `fmtDuration`**

`app.js`, subito **dopo** la riga 1439 (la `}` di chiusura di `fmtDuration`) e **prima** del commento `// Annulla il cronometro…` (riga 1440), inserisci:

```js
// Testo del cronometro per la status bar dell'overlay: "" se PRONTO, altrimenti
// "⏱ MM:SS · ". Centralizzato (usato da renderFocusOverlay e tickSessionDisplays).
function clockText(entry, now) {
  return sessionState(entry) === "PRONTO" ? "" : "⏱ " + fmtDuration(elapsedMs(entry, now) / 1000) + " · ";
}
```

- [ ] **Step 2: `app.js` — `renderFocusOverlay` usa `clockText`**

`app.js:3131`, sostituisci:

```js
    clk.textContent = sessionState(entry) === "PRONTO" ? "" : "⏱ " + fmtDuration(elapsedMs(entry, Date.now()) / 1000) + " · ";
```

con:

```js
    clk.textContent = clockText(entry, Date.now());
```

- [ ] **Step 3: `app.js` — `tickSessionDisplays` con guardia di stato**

`app.js:1504-1513`, sostituisci l'intera funzione:

```js
function tickSessionDisplays() {
  renderSessionControl();
  if (openIndex !== null) {
    const clk = document.getElementById("focusSbarClock");
    if (clk) {
      const entry = getSessionMap()[sessClockKey()];
      clk.textContent = sessionState(entry) === "PRONTO" ? "" : "⏱ " + fmtDuration(elapsedMs(entry, Date.now()) / 1000) + " · ";
    }
  }
}
```

con:

```js
function tickSessionDisplays() {
  const el = document.getElementById("sessClock");
  const entry = getSessionMap()[sessClockKey()];
  const target = planIsEmpty(data) ? "EMPTY" : sessionState(entry);
  // Rebuild completo SOLO al cambio di stato (così il pallino .sc-dot non si
  // resetta a ogni secondo). A stato invariato aggiorna solo il testo del tempo.
  if (!el || el.dataset.state !== target) {
    renderSessionControl();
  } else if (target === "IN_CORSO" || target === "IN_PAUSA" || target === "FINITO") {
    const t = document.getElementById("sessClockText");
    if (t) t.textContent = fmtDuration(elapsedMs(entry, Date.now()) / 1000);
  }
  if (openIndex !== null) {
    const clk = document.getElementById("focusSbarClock");
    if (clk) clk.textContent = clockText(entry, Date.now());
  }
}
```

- [ ] **Step 4: Verifica regressione**

Run: `npm test`
Expected: PASS — suite verde (416).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "perf(sessione): tick ricostruisce solo al cambio stato (pulse fluido) + helper clockText"
```

---

## Task 4: Bump Service Worker v72 → v73

**Files:**
- Modify: `sw.js:5`

- [ ] **Step 1: Bump cache**

`sw.js:5`, sostituisci:

```js
const CACHE = "gymsched-v72";
```

con:

```js
const CACHE = "gymsched-v73";
```

(`app.js`/`style.css`/`index.html` sono già negli `ASSETS`: nessun asset nuovo, solo invalidazione cache.)

- [ ] **Step 2: Verifica regressione**

Run: `npm test`
Expected: PASS — suite verde (416).

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "chore(sw): bump cache v72 -> v73"
```

---

## Task 5: Verifica manuale end-to-end (browser, cache SW svuotata)

> **Trappola nota del repo:** svuotare la cache del Service Worker prima di verificare, altrimenti gira codice stantio.

- [ ] **Step 1: Avvia il server e apri l'app**

`python -m http.server 8777` (se non già attivo), poi apri `http://127.0.0.1:8777/`.
In DevTools → Application: **Unregister** il SW e **Clear storage**, poi ricarica (per servire `app.js`/`style.css`/`sw.js` v73 freschi).

- [ ] **Step 2: Checklist comportamentale**

- [ ] Home: i controlli `[A][B][C]  [2026-W24 ▾]  [+]` stanno su **una sola riga**, senza overflow; nessun vuoto a destra.
- [ ] Tap `+` → aggiunge una settimana (stessa funzione di prima); i tab A/B/C cambiano giorno; il select cambia settimana.
- [ ] Stato PRONTO: **▶ Avvia allenamento** a **tutta larghezza**.
- [ ] Avvia → chip **● in corso** ambra con **pallino che pulsa** in modo fluido (non a scatti ogni secondo), tempo che scorre.
- [ ] ⏸ → chip **grigia spenta** (niente ambra, niente pallino), tempo congelato; ▶ riprende e torna ambra/pulsante.
- [ ] Apri un esercizio (overlay): `⏱ MM:SS · ex NN/NN` scorre fluido, niente flicker.
- [ ] Completa il giorno → chip **⏱ allenamento MM:SS** (FINITO, grigio congelato).
- [ ] (Opzionale) con SO/`prefers-reduced-motion: reduce`: il pallino non pulsa (resta fisso) ma resta ambra.

- [ ] **Step 3: Niente da committare** (solo verifica). Se emergono bug → `superpowers:systematic-debugging`.

> Verifica device iPhone (icona/safe-area invariate, riga senza overflow su schermo stretto, pulse visibile) → a cura dell'utente dopo il merge+push.

---

## Self-Review (eseguito in fase di scrittura)

**1. Copertura spec:**
- Home A (riga unica + Avvia largo) → Task 1. ✓
- `+ Sett.` → `+` ambra → Task 1 Step 1 (`btn-soft btn-add`) + Step 3 (`.btn-add`). ✓
- Chip in corso ambra + pallino pulsante → Task 2 (Step 3 dot element, Step 4 keyframes). ✓
- Chip in pausa grigia spenta → Task 2 (Step 2 classe `paused`, Step 4 `.sessclock.paused`). ✓
- Finito invariato → Task 2 Step 3 (branch FINITO mantiene "⏱ allenamento "). ✓
- Tick fluido (rebuild solo al cambio stato) → Task 3 Step 3. ✓
- Helper `clockText` centralizzato (chiude duplicazione) → Task 3 Step 1-2-3. ✓
- id `sessClockText` ora usato dal tick (chiude id morto) → Task 2 Step 3 + Task 3 Step 3. ✓
- SW bump → Task 4. ✓
- Logica pura invariata / suite verde → regressione in ogni task. ✓
- Verifica manuale → Task 5. ✓

**2. Placeholder:** nessuno — ogni step ha codice esatto e comando con output atteso.

**3. Coerenza tipi/nomi:** `dataset.state` scritto in `renderSessionControl` (Task 2: `"EMPTY"`/`state`) e letto in `tickSessionDisplays` (Task 3: confronto con `target`); valori coerenti con `sessionState` (`PRONTO`/`IN_CORSO`/`IN_PAUSA`/`FINITO`) + `EMPTY`. `#sessClockText` creato in `renderSessionControl` e aggiornato in `tickSessionDisplays`. `clockText(entry, now)` definito (Task 3 Step 1) e usato in `renderFocusOverlay` (Step 2) e `tickSessionDisplays` (Step 3). Classi `running`/`paused`/`ready`/`ended` coerenti tra JS (toggle) e CSS.

**Rischio chiave:** tra Task 2 e Task 3 il pulse non è ancora fluido (tick ricostruisce ogni secondo) — non bloccante, l'app funziona; risolto al Task 3. Ordine 2→3 da rispettare.
