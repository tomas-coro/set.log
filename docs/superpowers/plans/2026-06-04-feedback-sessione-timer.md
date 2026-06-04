# Feedback sessione: timer, suoni, feel-ask, PR reps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare i 7 interventi della spec `docs/superpowers/specs/2026-06-04-feedback-sessione-timer-design.md`: "dura" in rosso, rename "Croci ai cavi", PR a reps per corpo libero, suoni soft con volume regolabile, barra timer a due righe, stato GO "boot log" persistente, auto-chiusura feel-ask con avanzamento esercizio.

**Architecture:** Web app vanilla JS (no framework, no build). Logica pura nei moduli testabili (`session.js`, `catalog.js`, `timer.js`) con test `node --test`; DOM/wiring in `app.js` (3343 righe); stili in `style.css` con token semantici per i 2 temi (Carta default, Graphite via `:root[data-theme="graphite"]`).

**Tech Stack:** Vanilla JS ES modules, Web Audio API, node:test. Test: `npm test` (deve restare tutto verde, oggi 314 test).

**Ordine task:** dal più piccolo/sicuro al più invasivo. Ogni task è auto-contenuto e committabile.

---

### Task 1: "Dura" in rosso

**Files:**
- Modify: `style.css:28` e `style.css:46` (token `--rpe-hard`)

- [ ] **Step 1: Cambia i token colore**

In `style.css` riga 28 (tema Carta), sostituisci:

```css
  --rpe-hard:#b8642a;  --rpe-hard-bg:rgba(184,100,42,.12);
```

con:

```css
  --rpe-hard:#c0442e;  --rpe-hard-bg:rgba(192,68,46,.12);
```

Riga 46 (tema Graphite), sostituisci:

```css
  --rpe-hard:#FFB37F; --rpe-hard-bg:rgba(255,179,127,.07);
```

con:

```css
  --rpe-hard:#e0705a; --rpe-hard-bg:rgba(224,112,90,.07);
```

NON toccare `--line-warm` (resta il bordo caldo, il testo rosso basta a distinguere). NON toccare `--fail-bg` ("fallita" mantiene il suo stile barrato — resta distinguibile perché "dura" è testo/bordo rosso su chip, "fallita" è riga barrata con sfondo).

- [ ] **Step 2: Verifica visiva rapida**

Apri `index.html` nel browser (`npx serve .` o doppio click), apri un esercizio, marca una serie "dura": il chip e il bottone `dura` devono essere rossi e distinti da "ok" (ambra). Ripeti col tema Graphite dalle impostazioni.

- [ ] **Step 3: Run test suite (sanity)**

Run: `npm test`
Expected: tutti verdi (nessun test tocca i colori).

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "fix(ui): chip 'dura' in rosso, si distingue da 'ok'"
```

---

### Task 2: Rename "Croci ai cavi" → "Croci ai cavi in piedi" (seed + migrazione)

**Files:**
- Modify: `catalog.js` (seed riga 17 + nuova funzione pura `migrateExerciseName`)
- Modify: `plan.js:13` (seed legacy del piano)
- Modify: `app.js:3048-3050` (wiring post-seed)
- Test: `tests/catalog.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In coda a `tests/catalog.test.js` aggiungi (l'import in testa al file va esteso con `migrateExerciseName`):

```js
test("migrateExerciseName: rinomina nel catalogo (id invariato)", () => {
  const blob = { catalog: [{ id: "seed-2", name: "Croci ai cavi", muscle: "Petto", note: "" }], sheets: [] };
  const out = migrateExerciseName(blob, "Croci ai cavi", "Croci ai cavi in piedi");
  assert.equal(out.catalog[0].name, "Croci ai cavi in piedi");
  assert.equal(out.catalog[0].id, "seed-2");
});

test("migrateExerciseName: rinomina negli esercizi delle schede (match case-insensitive)", () => {
  const blob = { catalog: [], sheets: [{ name: "S1", plan: [{ day: "A", exercises: [
    { id: "e1", name: "croci AI cavi " }, { id: "e2", name: "Panca piana" },
  ] }] }] };
  const out = migrateExerciseName(blob, "Croci ai cavi", "Croci ai cavi in piedi");
  assert.equal(out.sheets[0].plan[0].exercises[0].name, "Croci ai cavi in piedi");
  assert.equal(out.sheets[0].plan[0].exercises[0].id, "e1");       // id intatto → log agganciato
  assert.equal(out.sheets[0].plan[0].exercises[1].name, "Panca piana"); // altri intatti
});

test("migrateExerciseName: nessun match → STESSO riferimento (niente save inutile)", () => {
  const blob = { catalog: [{ id: "c1", name: "Dips", muscle: "Petto", note: "" }], sheets: [] };
  assert.equal(migrateExerciseName(blob, "Croci ai cavi", "Croci ai cavi in piedi"), blob);
});

test("migrateExerciseName: idempotente (secondo run → stesso riferimento)", () => {
  const blob = { catalog: [{ id: "c1", name: "Croci ai cavi", muscle: "Petto", note: "" }], sheets: [] };
  const once = migrateExerciseName(blob, "Croci ai cavi", "Croci ai cavi in piedi");
  const twice = migrateExerciseName(once, "Croci ai cavi", "Croci ai cavi in piedi");
  assert.equal(twice, once);
});

test("migrateExerciseName: non muta l'input", () => {
  const blob = { catalog: [{ id: "c1", name: "Croci ai cavi", muscle: "Petto", note: "" }], sheets: [] };
  migrateExerciseName(blob, "Croci ai cavi", "Croci ai cavi in piedi");
  assert.equal(blob.catalog[0].name, "Croci ai cavi");
});
```

- [ ] **Step 2: Run i test → devono fallire**

Run: `npm test -- --test-name-pattern "migrateExerciseName"` (oppure `node --test tests/catalog.test.js`)
Expected: FAIL — `migrateExerciseName is not a function` / import error.

- [ ] **Step 3: Implementa `migrateExerciseName` in catalog.js**

In coda a `catalog.js`:

```js
// Migrazione one-shot di un nome esercizio: rinomina nel catalogo E in tutte le
// schede (match case-insensitive + trim). Gli id restano intatti → lo storico
// log resta agganciato. Ritorna lo STESSO riferimento se non c'è nulla da
// rinominare (confronto per riferimento a monte → niente save inutile).
export function migrateExerciseName(blob, from, to) {
  const f = norm(from);
  const hitCat = cat(blob).some((e) => norm(e.name) === f);
  const sheets = Array.isArray(blob.sheets) ? blob.sheets : [];
  const hitPlan = sheets.some((s) => (Array.isArray(s.plan) ? s.plan : []).some(
    (d) => (Array.isArray(d.exercises) ? d.exercises : []).some((ex) => norm(ex.name) === f)));
  if (!hitCat && !hitPlan) return blob;
  const out = clone(blob);
  out.catalog = cat(out).map((e) => (norm(e.name) === f ? { ...e, name: to } : e));
  for (const s of (Array.isArray(out.sheets) ? out.sheets : [])) {
    for (const d of (Array.isArray(s.plan) ? s.plan : [])) {
      for (const ex of (Array.isArray(d.exercises) ? d.exercises : [])) {
        if (norm(ex.name) === f) ex.name = to;
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Aggiorna i seed**

`catalog.js:17` — in `SEED_BY_GROUP.Petto` sostituisci `"Croci ai cavi"` con `"Croci ai cavi in piedi"`.

`plan.js:13` — sostituisci `name: "Croci ai cavi"` con `name: "Croci ai cavi in piedi"` (i nuovi utenti partono col nome giusto; gli esistenti li copre la migrazione).

- [ ] **Step 5: Wiring in app.js**

In `app.js` estendi l'import da `./catalog.js` (riga ~13) aggiungendo `migrateExerciseName`. Poi alle righe 3048-3050 sostituisci:

```js
    const _blob = dehydrate(data);
    const _maybe = seedCatalogIfAbsent(_blob);
    if (_maybe !== _blob) { data = hydrate(_maybe); scheduleSave(); }
```

con:

```js
    const _blob = dehydrate(data);
    let _maybe = seedCatalogIfAbsent(_blob);
    // Migrazione nome one-shot (2026-06: variante eseguita in piedi). Idempotente:
    // dopo il primo run non matcha più nulla e ritorna lo stesso riferimento.
    _maybe = migrateExerciseName(_maybe, "Croci ai cavi", "Croci ai cavi in piedi");
    if (_maybe !== _blob) { data = hydrate(_maybe); scheduleSave(); }
```

- [ ] **Step 6: Run tutta la suite**

Run: `npm test`
Expected: PASS tutti (i test esistenti in `tests/catalog.test.js` usano "Croci ai cavi" solo su blob costruiti a mano — non dipendono dal seed; se uno asserisce il contenuto del seed, aggiorna la stringa attesa a "Croci ai cavi in piedi").

- [ ] **Step 7: Commit**

```bash
git add catalog.js plan.js app.js tests/catalog.test.js
git commit -m "feat(catalog): rinomina 'Croci ai cavi' in 'Croci ai cavi in piedi' (seed + migrazione one-shot)"
```

---

### Task 3: PR a reps per esercizi a corpo libero

**Files:**
- Modify: `session.js:135-169` (nuove funzioni + `isWeekRecord`)
- Modify: `app.js:2113-2114` (toast live CTA normale)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In coda a `tests/session.test.js` (estendi l'import da `../session.js` con `historyIsBodyweight, bestReps, bestRepsBefore`):

```js
// helper locale: settimane → entry con sets [{reps, kg}]
function dataSets(weeksSets) {
  let d = emptyData();
  for (const [wk, sets] of Object.entries(weeksSets)) {
    d = setEntry(d, wk, "A", "dips1", { sets, note: "" });
  }
  return d;
}

test("historyIsBodyweight: true se tutti i working set sono senza kg (vuoto o 0)", () => {
  const d = dataSets({ "2026-W20": [{ reps: "8", kg: "", done: true }, { reps: "7", kg: "0", done: true }] });
  assert.equal(historyIsBodyweight(d, "A", "dips1"), true);
});

test("historyIsBodyweight: false appena esiste un kg > 0 storico", () => {
  const d = dataSets({ "2026-W20": [{ reps: "8", kg: "", done: true }], "2026-W21": [{ reps: "8", kg: "5", done: true }] });
  assert.equal(historyIsBodyweight(d, "A", "dips1"), false);
});

test("historyIsBodyweight: ignora warmup e failed con kg", () => {
  const d = dataSets({ "2026-W20": [
    { reps: "8", kg: "20", done: true, warmup: true },
    { reps: "8", kg: "10", done: true, failed: true },
    { reps: "8", kg: "", done: true },
  ] });
  assert.equal(historyIsBodyweight(d, "A", "dips1"), true);
});

test("bestReps / bestRepsBefore: max reps come bestKg ma su reps", () => {
  const d = dataSets({
    "2026-W20": [{ reps: "8", kg: "", done: true }, { reps: "10", kg: "", done: true }],
    "2026-W22": [{ reps: "9", kg: "", done: true }],
  });
  assert.equal(bestReps(d, "A", "dips1"), 10);
  assert.equal(bestRepsBefore(d, "A", "dips1", "2026-W22"), 10);
  assert.equal(bestRepsBefore(d, "A", "dips1", "2026-W20"), null);
});

test("isWeekRecord: corpo libero → record sul max reps", () => {
  const d = dataSets({
    "2026-W20": [{ reps: "8", kg: "", done: true }],
    "2026-W22": [{ reps: "9", kg: "", done: true }],
  });
  assert.equal(isWeekRecord(d, "A", "dips1", "2026-W22"), true);
});

test("isWeekRecord: corpo libero → niente record se non batte le reps", () => {
  const d = dataSets({
    "2026-W20": [{ reps: "10", kg: "", done: true }],
    "2026-W22": [{ reps: "10", kg: "", done: true }],
  });
  assert.equal(isWeekRecord(d, "A", "dips1", "2026-W22"), false);
});

test("isWeekRecord: appena compare un kg > 0 storico si torna alla metrica kg", () => {
  // W20 a corpo libero con 12 reps; W22 zavorrato 5kg x 8: record kg (prima nessun kg).
  const d = dataSets({
    "2026-W20": [{ reps: "12", kg: "", done: true }],
    "2026-W22": [{ reps: "8", kg: "5", done: true }],
  });
  assert.equal(isWeekRecord(d, "A", "dips1", "2026-W22"), true);
  // e le 12 reps storiche NON generano falsi PR reps in W23 a corpo libero
  const d2 = dataSets({
    "2026-W20": [{ reps: "12", kg: "", done: true }],
    "2026-W22": [{ reps: "8", kg: "5", done: true }],
    "2026-W23": [{ reps: "13", kg: "", done: true }],
  });
  assert.equal(isWeekRecord(d2, "A", "dips1", "2026-W23"), false); // metrica kg: top W23 = null
});
```

- [ ] **Step 2: Run i test → devono fallire**

Run: `node --test tests/session.test.js`
Expected: FAIL — `historyIsBodyweight is not a function`.

- [ ] **Step 3: Implementa in session.js**

Dopo `bestKgBefore` (riga ~148) aggiungi:

```js
// true se TUTTO lo storico working (no warmup/failed) dell'esercizio è senza
// kg (vuoto, non numerico o 0): esercizio "a corpo libero" per la logica PR.
// Vacuamente true senza storico (primo allenamento → primo PR, come per i kg).
export function historyIsBodyweight(data, day, exId, track = null) {
  for (const k of Object.keys(data?.weeks ?? {})) {
    const t = entryTrack(getEntry(data, k, day, exId), track);
    for (const s of t.sets) {
      if (s.warmup || s.failed) continue;
      const v = parseNum(s.kg);
      if (v !== null && v > 0) return false;
    }
  }
  return true;
}

// Max reps working su tutte le settimane (gemello di bestKg, metrica reps).
export function bestReps(data, day, exId, track = null) {
  let best = null;
  for (const k of Object.keys(data?.weeks ?? {})) {
    const t = entryTrack(getEntry(data, k, day, exId), track);
    for (const s of t.sets) {
      if (s.warmup || s.failed) continue;
      const v = parseNum(s.reps);
      if (v !== null && (best === null || v > best)) best = v;
    }
  }
  return best;
}

// Max reps working delle settimane precedenti a `weekKey` (gemello di bestKgBefore).
export function bestRepsBefore(data, day, exId, weekKey, track = null) {
  let best = null;
  for (const k of Object.keys(data?.weeks ?? {})) {
    if (k >= weekKey) continue;
    const t = entryTrack(getEntry(data, k, day, exId), track);
    for (const s of t.sets) {
      if (s.warmup || s.failed) continue;
      const v = parseNum(s.reps);
      if (v !== null && (best === null || v > best)) best = v;
    }
  }
  return best;
}
```

Poi sostituisci l'intera `isWeekRecord` (righe 151-162 originali) con:

```js
// true se il top-set working di `weekKey` supera STRETTAMENTE lo storico precedente.
// Metrica: kg di default; max reps se l'intero storico è a corpo libero (kg
// sempre vuoto/0) — così dips & co. senza zavorra generano PR sulle ripetizioni.
export function isWeekRecord(data, day, exId, weekKey, track = null) {
  const bw = historyIsBodyweight(data, day, exId, track);
  const t = entryTrack(getEntry(data, weekKey, day, exId), track);
  let top = null;
  for (const s of t.sets) {
    if (s.warmup || s.failed) continue;
    const v = parseNum(bw ? s.reps : s.kg);
    if (v !== null && (top === null || v > top)) top = v;
  }
  if (top === null) return false;
  const prev = bw
    ? bestRepsBefore(data, day, exId, weekKey, track)
    : bestKgBefore(data, day, exId, weekKey, track);
  return prev === null || top > prev;
}
```

- [ ] **Step 4: Run i test → devono passare**

Run: `node --test tests/session.test.js`
Expected: PASS tutti (anche i vecchi test isWeekRecord: usano kg numerici → `bw` è false).

- [ ] **Step 5: Toast live nel CTA (app.js)**

Estendi l'import da `./session.js` in testa ad `app.js` aggiungendo `historyIsBodyweight, bestReps`. Poi alle righe 2113-2114 sostituisci:

```js
      const _prevBest = bestKg(data, currentDay, exId);
      if (isSetRecord(_prevBest, draft.kg)) showRecordToast();
```

con:

```js
      // Corpo libero (storico senza kg E serie corrente senza kg) → PR su reps.
      const _kgNum = parseFloat(String(draft.kg).replace(",", "."));
      const _bw = historyIsBodyweight(data, currentDay, exId) && !(_kgNum > 0);
      const _prevBest = _bw ? bestReps(data, currentDay, exId) : bestKg(data, currentDay, exId);
      if (isSetRecord(_prevBest, _bw ? draft.reps : draft.kg)) showRecordToast();
```

(Il CTA superset alle righe 2325-2327 resta su kg: i superset della scheda sono tutti con carico; YAGNI.)

- [ ] **Step 6: Run tutta la suite**

Run: `npm test`
Expected: PASS tutti.

- [ ] **Step 7: Commit**

```bash
git add session.js app.js tests/session.test.js
git commit -m "feat(pr): record a reps per esercizi a corpo libero (dips senza zavorra)"
```

---

### Task 4: Suoni soft + volume regolabile nelle impostazioni

**Files:**
- Modify: `app.js:1137-1158` (tone + cue), `app.js:~1056` (pref), `app.js:2679-2692` (openSettings) e wiring vicino a `qcAdd`/`notifyToggle` (righe ~2694-2705)
- Modify: `index.html:165-169` (slider nel dialog impostazioni, sezione "interfaccia")

- [ ] **Step 1: Preferenza volume (app.js)**

Dopo il blocco `NOTIFY_KEY`/`notifyOn()` (riga ~1059) aggiungi:

```js
// Volume dei suoni timer: 0–40 (%), default 10. 0 = muto (resta la vibrazione).
const TIMERVOL_KEY = "gymsched_timervol";
function getTimerVol() {
  const n = parseInt(localStorage.getItem(TIMERVOL_KEY), 10);
  return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 10;
}
function setTimerVol(v) { localStorage.setItem(TIMERVOL_KEY, String(v)); }
```

- [ ] **Step 2: Retune di tone() e dei cue**

Sostituisci `tone()` (righe 1138-1152) con — cambi: gain dal volume utente, attacco 50ms lineare, early-return a volume 0:

```js
// Tono singolo WebAudio (sinusoide): freq Hz, durata s, ritardo s. Il volume
// viene dalla preferenza utente (getTimerVol, 0–40%): attacco dolce 50ms e
// coda esponenziale — pensato per non "sparare" in cuffia.
function tone(freq, dur = 0.18, after = 0) {
  const vol = getTimerVol() / 100;
  if (vol <= 0) return;
  try {
    ensureAudio();
    const t0 = audioCtx.currentTime + after;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (_) { /* audio unavailable; ignore */ }
}
```

Sostituisci le tre funzioni cue (righe 1153-1158) con:

```js
// Fine recupero: arpeggio do-mi-sol. Preavviso (−10s): doppio do5 morbido.
// Countdown (3-2-1): singolo mi5. Sinusoidi brevi e distinte, riconoscibili
// a orecchio anche con la musica nelle cuffie senza risultare stridule.
function beep() { tone(523, 0.22); tone(659, 0.22, 0.18); tone(784, 0.5, 0.36); }
function cueWarning() { tone(523, 0.25); tone(523, 0.25, 0.35); if (navigator.vibrate) navigator.vibrate(120); }
function cueCountdown() { tone(659, 0.18); }
```

ATTENZIONE: la vecchia firma era `tone(freq, dur, peak, after)` — la nuova è `tone(freq, dur, after)`. Cerca eventuali altri call-site: `grep -n "tone(" app.js` e aggiorna gli argomenti (al momento i soli chiamanti sono beep/cueWarning/cueCountdown).

Il guard "preavviso solo al passaggio per 10s" esiste già (`app.js:1182-1186`: `remaining === 10` con dedup via `lastTickSecond`) — nessuna modifica.

- [ ] **Step 3: Slider nelle impostazioni (index.html)**

Dopo la riga del toggle "notifica recupero" (`index.html:166-169`) aggiungi:

```html
          <label class="sv-line">
            <span class="k">volume timer</span>
            <span class="v"><input type="range" id="timerVolSlider" min="0" max="40" step="2" style="width:110px;vertical-align:middle;accent-color:var(--acc);"> <span id="timerVolPct" class="mono"></span></span>
          </label>
```

- [ ] **Step 4: Wiring slider (app.js)**

In `openSettings` (riga ~2679, dopo `document.getElementById("notifyToggle").checked = notifyOn();`) aggiungi:

```js
    document.getElementById("timerVolSlider").value = getTimerVol();
    document.getElementById("timerVolPct").textContent = getTimerVol() + "%";
```

Vicino al listener di `notifyToggle` (riga ~2701) aggiungi:

```js
  document.getElementById("timerVolSlider").addEventListener("input", (e) => {
    setTimerVol(parseInt(e.target.value, 10));
    document.getElementById("timerVolPct").textContent = getTimerVol() + "%";
    cueCountdown(); // anteprima live del volume scelto
  });
```

(`ensureAudio` dentro `tone` parte da un gesto utente — lo slider lo è: niente problemi di autoplay iOS.)

- [ ] **Step 5: Verifica manuale**

Browser: apri Impostazioni → slider "volume timer" presente, % aggiornata, suono di anteprima a ogni input, a 0% silenzio. Avvia un recupero da 13s (bottone −10 da 75s due volte + ⏸/▶ per regolare, o imposta recupero 13s nell'editor): a 10s doppio do5, a 3-2-1 tick, a 0 arpeggio. Ricarica la pagina: il volume scelto persiste.

- [ ] **Step 6: Run test suite**

Run: `npm test`
Expected: PASS (nessun test tocca i suoni — sono DOM-only).

- [ ] **Step 7: Commit**

```bash
git add app.js index.html
git commit -m "feat(timer): suoni sinusoidali soft + volume regolabile in impostazioni (default 10%)"
```

---

### Task 5: Barra timer a due righe

**Files:**
- Modify: `index.html:424-435` (markup barra)
- Modify: `style.css:199-210` (CSS barra)
- Modify: `app.js:1176-1186` (onTick: classe `.final` ultimi 3s)

- [ ] **Step 1: Nuovo markup (index.html righe 424-435)**

Sostituisci l'intero blocco `<div id="timerBar">…</div>` con:

```html
  <!-- Rest timer: riga 1 = nome esercizio + chiudi; riga 2 = tempo + controlli -->
  <div id="timerBar" class="timerbar hidden">
    <div id="timerRun">
      <div class="t-row1">
        <span id="timerLabel" class="t-label"></span>
        <button id="tStop" class="t-x">✕</button>
      </div>
      <div class="t-row2">
        <span id="timerTime" class="t-time">0:00</span>
        <div class="t-controls">
          <button id="tMinus" class="t-btn">−10</button>
          <button id="tToggle" class="t-btn">⏸</button>
          <button id="tPlus" class="t-btn">+10</button>
        </div>
      </div>
    </div>
  </div>
```

(Gli id `tMinus/tToggle/tPlus/tStop/timerTime/timerLabel` restano: `wireTimerControls` non cambia. Il `#timerGo` arriva nel Task 6.)

- [ ] **Step 2: Nuovo CSS (style.css righe 199-210)**

Sostituisci il blocco `/* timer bar */` con:

```css
/* timer bar — due righe: nome esercizio intero sopra, tempo + controlli sotto */
.timerbar{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:440px;
  background:var(--surf2);border-top:1px solid var(--line);
  padding:14px 18px 16px;backdrop-filter:blur(8px);}
.t-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
.t-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);}
.t-x{background:transparent;border:none;color:var(--dim);font-size:18px;line-height:1;cursor:pointer;
  padding:4px 8px;min-width:36px;min-height:36px;}
.t-row2{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.t-time{font-family:"JetBrains Mono",monospace;font-size:40px;font-weight:700;letter-spacing:1px;line-height:1;
  color:var(--acc);font-variant-numeric:tabular-nums;}
.t-time.final{color:var(--down);animation:t-tick .9s ease infinite;}
@keyframes t-tick{0%{transform:scale(1)}12%{transform:scale(1.14)}30%{transform:scale(1)}}
.t-controls{display:flex;gap:10px;}
.t-btn{background:transparent;border:1px solid var(--line);border-radius:10px;padding:11px 16px;
  font-family:"JetBrains Mono",monospace;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;min-height:44px;}
```

Nota: spariscono `.t-info` e `.t-stop` (il ✕ ora è testuale `.t-x`). Verifica che non restino altri usi: `grep -n "t-info\|t-stop" index.html style.css app.js` → se `t-stop` compare altrove, rimuovi solo la regola CSS orfana.

- [ ] **Step 3: Spazio sotto la pagina**

La barra ora è più alta (~110px). In `style.css:54` porta il padding-bottom di `.wrap` da `132px` a `168px`. Poi cerca eventuali regole legate a `timer-on` (`grep -n "timer-on" style.css`): se esiste un padding/margine compensativo, allinealo alla nuova altezza (+~36px).

- [ ] **Step 4: Ultimi 3 secondi in rosso (app.js onTick)**

In `app.js`, nel callback `onTick` (righe 1177-1186), dopo la riga che setta `timerLabel.textContent`, aggiungi:

```js
    document.getElementById("timerTime").classList.toggle("final", remaining > 0 && remaining <= 3);
```

- [ ] **Step 5: Verifica manuale**

Browser, telefono o devtools mobile: avvia un recupero. Nome esercizio intero (es. "PUSHDOWN + CURL PANCA MULTIPOWER") visibile senza "…", ✕ in alto a destra, tempo 40px, bottoni spaziati e comodi al tatto. Ultimi 3 secondi: tempo rosso che pulsa. La strip "Prossimo/Ultimo esercizio" non è coperta dalla barra (scroll fino in fondo).

- [ ] **Step 6: Run test suite + commit**

Run: `npm test` → Expected: PASS.

```bash
git add index.html style.css app.js
git commit -m "feat(timer): barra a due righe — nome intero, tempo 40px, countdown finale rosso"
```

---

### Task 6: Stato GO "boot log" persistente alla scadenza

**Files:**
- Modify: `timer.js` (nuova funzione pura `goSlug`)
- Modify: `index.html` (blocco `#timerGo` dentro `#timerBar`; rimozione `#restDoneBanner` riga 405)
- Modify: `style.css` (CSS `.t-go`; rimozione regola `.restdone`)
- Modify: `app.js` (onEnd, startRest, showTimerGo, dismiss, rimozione banner; CTA passano goInfo)
- Test: `tests/timer.test.js`

- [ ] **Step 1: Test per goSlug (fallisce)**

In coda a `tests/timer.test.js` (estendi l'import da `../timer.js` con `goSlug`):

```js
test("goSlug: minuscole, accenti normalizzati, non-alfanumerici → _", () => {
  assert.equal(goSlug("Pushdown + Curl panca"), "pushdown_curl_panca");
  assert.equal(goSlug("Più forza così"), "piu_forza_cosi");
});

test("goSlug: trim di _ ai bordi e taglio a 24 char", () => {
  assert.equal(goSlug("  Croci ai cavi in piedi (chiusura petto)  ").length <= 24, true);
  assert.equal(goSlug("---Dips---"), "dips");
});

test("goSlug: vuoto/garbage → fallback 'esercizio'", () => {
  assert.equal(goSlug(""), "esercizio");
  assert.equal(goSlug("→★"), "esercizio");
});
```

Run: `node --test tests/timer.test.js` → Expected: FAIL (`goSlug is not a function`).

- [ ] **Step 2: Implementa goSlug in timer.js**

In coda a `timer.js`:

```js
// Slug "da comando" per il boot-log della barra: minuscole, accenti rimossi,
// sequenze non alfanumeriche → "_", max 24 char. Fallback "esercizio".
export function goSlug(name) {
  const s = String(name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24).replace(/_+$/, "");
  return s || "esercizio";
}
```

Run: `node --test tests/timer.test.js` → Expected: PASS.

- [ ] **Step 3: Markup #timerGo (index.html)**

Dentro `#timerBar`, subito dopo la chiusura di `</div>` di `#timerRun` (dal Task 5), aggiungi:

```html
    <div id="timerGo" class="t-go hidden">
      <div class="g1"><span class="g-ok">[ ok ]</span> recupero completato · <span id="goRest"></span></div>
      <div class="g2"><span class="g-chev">&gt;</span> <span id="goVerb">vai</span> <span id="goPath" class="g-path"></span><span class="g-cursor"></span></div>
    </div>
```

Rimuovi la riga 405: `<div id="restDoneBanner" class="restdone hidden">RECUPERO FINITO</div>`.

- [ ] **Step 4: CSS .t-go (style.css)**

Dopo il blocco timer bar del Task 5 aggiungi:

```css
/* Stato GO a fine recupero: boot-log persistente, tocca per chiudere */
.timerbar.go-on{background:var(--field);border-top:2px solid var(--acc);position:relative;}
.t-go{cursor:pointer;font-family:"JetBrains Mono",monospace;-webkit-user-select:none;user-select:none;}
.t-go .g1{font-size:13px;color:var(--ink);}
.t-go .g1 .g-ok{color:var(--ok);font-weight:700;}
.t-go .g2{font-size:19px;font-weight:800;color:var(--acc);margin-top:4px;display:flex;align-items:baseline;gap:7px;}
.t-go .g2 .g-chev{color:var(--faint);font-weight:400;}
.t-go .g2 .g-path{font-weight:400;font-size:13px;color:var(--dim);}
.t-go .g2 .g-cursor{display:inline-block;width:11px;height:19px;background:var(--acc);
  align-self:center;animation:g-blink 1s steps(1) infinite;}
@keyframes g-blink{0%,100%{opacity:1}50%{opacity:0}}
/* Graphite: glow fosforo + scanline CRT leggera */
:root[data-theme="graphite"] .t-go .g2{text-shadow:0 0 8px rgba(240,167,60,.5),0 0 20px rgba(240,167,60,.22);}
:root[data-theme="graphite"] .t-go .g2 .g-path{text-shadow:none;}
:root[data-theme="graphite"] .t-go .g2 .g-cursor{box-shadow:0 0 8px rgba(240,167,60,.55);}
:root[data-theme="graphite"] .timerbar.go-on::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);}
```

Rimuovi la regola CSS `.restdone` (cerca `grep -n "restdone" style.css` e cancella il blocco).

- [ ] **Step 5: app.js — contesto recupero + showTimerGo + onEnd**

(a) Estendi l'import da `./timer.js` in testa ad app.js con `goSlug`.

(b) Sopra `const timer = new RestTimer({...})` (riga ~1175) aggiungi:

```js
// Contesto dell'ultimo recupero per lo stato GO: durata impostata + comando da
// mostrare allo 0:00 ({fine:true} | {slug, serie}). Settato da startRest.
let restCtx = null;
```

(c) Sostituisci l'intero callback `onEnd` (righe 1188-1204) con:

```js
  onEnd: (label) => {
    hideFeelAsk();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
    if (document.hidden && notifyOn() && swReg) {
      swReg.showNotification("Recupero finito", {
        body: (label ? label + " · " : "") + "prossima serie",
        tag: "rest-done", renotify: true, vibrate: [200, 100, 200], icon: "./icon.svg",
      }).catch(() => {});
    }
    showTimerGo(label); // persistente: si chiude solo col tap (anche tornando dall'app in background)
  },
```

(d) Dopo la definizione del timer aggiungi:

```js
// Trasforma la barra nello stato GO "boot log". Resta finché non viene toccata.
function showTimerGo(label) {
  const go = restCtx?.go;
  document.getElementById("goRest").textContent = formatTime(restCtx?.seconds ?? 0);
  if (go?.fine) {
    document.getElementById("goVerb").textContent = "fine";
    document.getElementById("goPath").textContent = "./sessione --done";
  } else {
    document.getElementById("goVerb").textContent = "vai";
    document.getElementById("goPath").textContent =
      `./${go?.slug ?? goSlug(label)} --serie ${go?.serie ?? 1}`;
  }
  document.getElementById("timerTime").classList.remove("final");
  document.getElementById("timerRun").classList.add("hidden");
  document.getElementById("timerGo").classList.remove("hidden");
  document.getElementById("timerBar").classList.add("go-on");
}

// Chiude lo stato GO e nasconde la barra (tap dell'utente).
function dismissTimerGo() {
  document.getElementById("timerGo").classList.add("hidden");
  document.getElementById("timerRun").classList.remove("hidden");
  document.getElementById("timerBar").classList.add("hidden");
  document.getElementById("timerBar").classList.remove("go-on");
  document.body.classList.remove("timer-on");
}
```

(e) Sostituisci `startRest` (righe ~1207-1215) con — cambi: terzo parametro `go`, reset dello stato GO a ogni avvio:

```js
function startRest(seconds, label, go = null) {
  ensureAudio(); // unlock audio within the user gesture
  startSessionIfAbsent(); // primo recupero del giorno → avvia il cronometro sessione
  wakeLock.enable();
  restCtx = { seconds, go };
  document.getElementById("timerGo").classList.add("hidden");
  document.getElementById("timerRun").classList.remove("hidden");
  document.getElementById("timerBar").classList.remove("go-on");
  document.body.classList.add("timer-on");
  document.getElementById("timerBar").classList.remove("hidden");
  document.getElementById("tToggle").textContent = "⏸";
  timer.start(seconds, label);
}
```

(f) In `wireTimerControls` (riga ~2811) aggiungi il dismiss e togli il banner:

```js
  document.getElementById("timerGo").addEventListener("click", dismissTimerGo);
```

e nel listener di `tStop` rimuovi la riga `hideRestDoneBanner();`.

(g) Rimuovi le funzioni `showRestDoneBanner` e `hideRestDoneBanner` (righe ~1161-1173) e ogni chiamata residua: `grep -n "RestDoneBanner" app.js` deve restituire zero risultati.

- [ ] **Step 6: goInfo dai CTA**

(a) CTA normale (riga ~2118). Il contesto disponibile: `idx`, `curIdx` (serie appena fatta, 0-based), `total`, `ex`. Sostituisci:

```js
      startRest(getRest(currentDay, exId, ex.restSeconds), ex.name);
```

con:

```js
      const _nx = nextExercisePreview(dayPlan().exercises, idx);
      const _go = (curIdx + 1 >= total)
        ? (_nx.last ? { fine: true } : { slug: goSlug(_nx.name), serie: 1 })
        : { slug: goSlug(ex.name), serie: curIdx + 2 };
      startRest(getRest(currentDay, exId, ex.restSeconds), ex.name, _go);
```

(b) CTA superset (riga ~2332). Contesto: `idx`, `a.curIdx`, `ex`, e dopo il `setEntry` l'entry aggiornata. Sostituisci:

```js
      startRest(getRest(currentDay, exId, ex.restSeconds), ex.name);
```

con:

```js
      const _doneAll = isEntryComplete(getEntry(data, currentWeek, currentDay, exId), ex);
      const _nx = nextExercisePreview(dayPlan().exercises, idx);
      const _go = _doneAll
        ? (_nx.last ? { fine: true } : { slug: goSlug(_nx.name), serie: 1 })
        : { slug: goSlug(ex.name), serie: a.curIdx + 2 };
      startRest(getRest(currentDay, exId, ex.restSeconds), ex.name, _go);
```

(Nota: la riga superset va inserita DOPO `data = setEntry(...)` e `persist(idx)`, al posto della vecchia startRest — `isEntryComplete` deve vedere i set appena scritti. `nextExercisePreview` è già importata? verifica gli import di app.js: è usata da `buildNextStrip`, quindi sì.)

- [ ] **Step 7: Verifica manuale completa**

Recupero corto (13s): a 0:00 la barra diventa `[ ok ] recupero completato · 0:13` / `> vai ./pushdown_ai_cavi --serie 2█` con cursore lampeggiante; resta lì indefinitamente; un tap la chiude. Ultima serie di un esercizio non ultimo → `> vai ./prossimo_esercizio --serie 1`. Ultima serie dell'ultimo esercizio → `> fine ./sessione --done`. Tema Graphite: glow + scanline. Tema Carta: fondo `--field`, bordo ambra. Avviare una nuova serie mentre GO è visibile: la barra torna in modalità countdown pulita.

- [ ] **Step 8: Run suite + commit**

Run: `npm test` → Expected: PASS.

```bash
git add timer.js index.html style.css app.js tests/timer.test.js
git commit -m "feat(timer): stato GO boot-log persistente alla scadenza (sostituisce il banner 1.5s)"
```

---

### Task 7: Auto-chiusura feel-ask + avanzamento esercizio

**Files:**
- Modify: `app.js:1842-1890` (showFeelAsk/hideFeelAsk), `app.js:2122` e `app.js:2336` (flag `last` dai CTA)

- [ ] **Step 1: Flag `last` dai CTA**

(a) CTA normale, riga ~2122 — sostituisci:

```js
      showFeelAsk({ idx, superset: false, setIndex: curIdx });
```

con:

```js
      showFeelAsk({ idx, superset: false, setIndex: curIdx, last: curIdx + 1 >= total });
```

(b) CTA superset, riga ~2336 — sostituisci:

```js
      showFeelAsk({ idx, superset: true, aIdx: a.curIdx, bIdx: b.curIdx });
```

con (riusa la `_doneAll` calcolata nel Task 6 step 6b):

```js
      showFeelAsk({ idx, superset: true, aIdx: a.curIdx, bIdx: b.curIdx, last: _doneAll });
```

- [ ] **Step 2: Auto-chiusura + avanzamento in showFeelAsk**

(a) Sopra `function showFeelAsk(info)` (riga ~1842) aggiungi:

```js
// Chiusura programmata del feel-ask (1.2s dopo il giudizio): si vede la
// conferma, poi il pannello sparisce da solo così il prossimo esercizio è
// visibile. Un secondo tap entro la finestra sostituisce il giudizio e
// riparte il timer. Sull'ultima serie chiude anche l'esercizio e avanza.
function scheduleFeelAskClose(info) {
  clearTimeout(scheduleFeelAskClose._t);
  scheduleFeelAskClose._t = setTimeout(() => {
    hideFeelAsk();
    if (info.last) advanceAfterExercise(info.idx);
  }, 1200);
}

// Esercizio finito e valutato: chiudi il focus corrente e apri il prossimo
// esercizio della sessione (se c'è; altrimenti torna alla lista).
function advanceAfterExercise(idx) {
  const exs = dayPlan().exercises;
  if (idx + 1 < exs.length) {
    openIndex = idx + 1;
    supersetTab = "a";
    render();
  } else {
    closeFocus();
  }
}
```

(b) Nel ramo NON superset di `showFeelAsk` (callback `buildRpeBar` alle righe 1873-1879), dopo `render();` aggiungi:

```js
        scheduleFeelAskClose(info);
```

(c) Nel ramo superset (callback dentro `mkTrack`, righe 1859-1865), dopo `render();` aggiungi — chiude solo quando ENTRAMBE le tracce della serie hanno un giudizio:

```js
        const e2 = normalizeSupersetEntry(getEntry(data, currentWeek, currentDay, exId));
        if (e2.a.sets[info.aIdx]?.feel && e2.b.sets[info.bIdx]?.feel) scheduleFeelAskClose(info);
```

(d) In `hideFeelAsk` (riga ~1887) aggiungi il clear per i percorsi di chiusura manuale (←, stop timer, fine recupero):

```js
function hideFeelAsk() {
  clearTimeout(scheduleFeelAskClose._t);
  document.getElementById("feelAsk").classList.add("hidden");
  lastDone = null;
}
```

- [ ] **Step 3: Verifica manuale**

Serie intermedia: "Serie fatta" → feel-ask → tap "ok" → conferma visibile ~1.2s → pannello sparisce, esercizio ancora aperto, timer continua. Doppio cambio rapido ("ok" poi "dura" entro 1.2s): vince l'ultimo, il pannello si chiude 1.2s dopo il secondo tap. Ultima serie: tap giudizio → dopo 1.2s si apre il PROSSIMO esercizio (strip e header aggiornati); sull'ultimo esercizio → si torna alla lista. Superset: il pannello resta finché A e B non hanno entrambe il giudizio della serie corrente. Tasto ← durante la finestra: nessun crash, niente chiusure fantasma dopo (clearTimeout).

- [ ] **Step 4: Run suite + commit**

Run: `npm test` → Expected: PASS.

```bash
git add app.js
git commit -m "feat(focus): feel-ask si chiude da solo; ultima serie → avanza al prossimo esercizio"
```

---

### Task 8: Verifica finale e bump service worker

**Files:**
- Modify: `sw.js` (bump versione cache)

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: PASS, ≥314 test + i nuovi (migrateExerciseName ×5, PR reps ×7, goSlug ×3).

- [ ] **Step 2: Bump cache del service worker**

In `sw.js` cerca la costante di versione (`grep -n "v57\|CACHE" sw.js`) e incrementala (es. `v57` → `v58`) così i client ricaricano gli asset nuovi.

- [ ] **Step 3: Giro completo manuale (checklist spec)**

Sessione simulata nel browser: 1) serie con feel → auto-close; 2) ultima serie → avanzamento; 3) timer 13s → preavviso, 3-2-1 rossi + tick, boot-log persistente, tap chiude; 4) Graphite: glow/scanline; 5) volume 0% → solo vibrazione; 6) dips senza kg → 🏆 al superamento reps; 7) catalogo: voce "Croci ai cavi in piedi"; 8) "dura" rossa.

- [ ] **Step 4: Commit finale**

```bash
git add sw.js
git commit -m "chore(sw): bump cache per rollout feedback sessione"
```
