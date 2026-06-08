# Superset a 3 tracce (circuiti) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere i superset da 2 tracce (a/b) a un massimo di 3 (a/b/c) per rappresentare i circuiti core, e unificare la vista focus su un layout impilato (via i sotto-tab) per tutti i superset.

**Architecture:** 3ª traccia `c` additiva e opzionale nel modello entry `{a,b,c,note}` + campi esercizio `muscleC/unitC/vol2C/platesC` a specchio di `b`. L'arità (duo/trio) si deduce dal numero di pezzi ` + ` nel nome via il nuovo helper `supersetTrackKeys`. La maggior parte delle funzioni per-traccia passa già da `entryTrack`, quindi basta estendere quello + i pochi punti che ramificano su `track === "b"`. Nessuna migrazione dei log esistenti.

**Tech Stack:** Vanilla JS ESM, test con `node --test`, PWA con service worker, deploy GitHub Pages da `main`.

**Spec di riferimento:** `docs/superpowers/specs/2026-06-08-superset-circuiti-tre-tracce-design.md`

**Branch:** `feat/superset-circuiti-3-tracce` (già creato e pushato).

**Comandi test:** tutti → `npm test`. Singolo file → `node --test tests/session.test.js`. Per nome → `node --test --test-name-pattern="supersetTrackKeys"`.

---

### Task 1: Helper arità — `supersetTrackKeys` e `trackMuscle`

**Files:**
- Modify: `session.js` (aggiungere vicino a `trackName`, ~riga 292)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

In `tests/session.test.js` aggiungi:

```js
import { supersetTrackKeys, trackMuscle } from "../session.js";

describe("supersetTrackKeys", () => {
  it("non-superset -> []", () => {
    assert.deepEqual(supersetTrackKeys({ name: "Panca", superset: false }), []);
  });
  it("duo (2 pezzi nel nome) -> [a,b]", () => {
    assert.deepEqual(supersetTrackKeys({ name: "Curl + Skull", superset: true }), ["a", "b"]);
  });
  it("trio (3 pezzi) -> [a,b,c]", () => {
    assert.deepEqual(supersetTrackKeys({ name: "Dead bug + Crunch + Plank", superset: true }), ["a", "b", "c"]);
  });
  it("superset senza ' + ' nel nome -> [a,b] (fallback duo)", () => {
    assert.deepEqual(supersetTrackKeys({ name: "Solo nome", superset: true }), ["a", "b"]);
  });
});

describe("trackMuscle", () => {
  const ex = { name: "A + B + C", superset: true, muscle: "Core", muscleB: "Spalle", muscleC: "Gambe" };
  it("a -> muscle, b -> muscleB, c -> muscleC", () => {
    assert.equal(trackMuscle(ex, "a"), "Core");
    assert.equal(trackMuscle(ex, "b"), "Spalle");
    assert.equal(trackMuscle(ex, "c"), "Gambe");
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test --test-name-pattern="supersetTrackKeys|trackMuscle"`
Expected: FAIL (`supersetTrackKeys is not a function`).

- [ ] **Step 3: Implementa**

In `session.js`, sopra `trackName` (~riga 292):

```js
// Chiavi traccia di un superset, dedotte dal nome: 2 pezzi " + " = duo [a,b],
// 3 pezzi = trio [a,b,c]. Non-superset -> []. Fonte unica dell'arità.
export function supersetTrackKeys(ex) {
  if (!ex?.superset) return [];
  const parts = String(ex?.name ?? "").split(" + ").length;
  return parts >= 3 ? ["a", "b", "c"] : ["a", "b"];
}

// Muscolo della singola traccia: a->muscle, b->muscleB, c->muscleC.
export function trackMuscle(ex, track) {
  if (track === "c") return ex?.muscleC;
  if (track === "b") return ex?.muscleB;
  return ex?.muscle;
}
```

- [ ] **Step 4: Esegui e verifica PASS**

Run: `node --test --test-name-pattern="supersetTrackKeys|trackMuscle"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add session.js tests/session.test.js
git commit -m "feat(session): helper supersetTrackKeys + trackMuscle (arita superset)"
```

---

### Task 2: `parseTarget` — split robusto su ` / ` + arità

**Files:**
- Modify: `session.js:14-23` (`parseTarget`)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

```js
describe("parseTarget 3 tracce", () => {
  it("trio: split su ' / ' spaziato in {a,b,c}", () => {
    const r = parseTarget("2 × 10 / 2 × 20-25 / 2 × 8", true, 3);
    assert.deepEqual(r, {
      a: { sets: 2, reps: "10" }, b: { sets: 2, reps: "20-25" }, c: { sets: 2, reps: "8" },
    });
  });
  it("trio: qualificatore '8/lato' in traccia NON-ultima non spezza", () => {
    const r = parseTarget("2 × 8/lato / 2 × 10 / 2 × 25-30", true, 3);
    assert.equal(r.a.reps, "8/lato");
    assert.equal(r.b.reps, "10");
    assert.equal(r.c.reps, "25-30");
  });
  it("trio: ultima traccia tiene il resto, incl. 'max/lato'", () => {
    const r = parseTarget("2 × 10 / 2 × 12 / 2 × max/lato", true, 3);
    assert.equal(r.c.reps, "max/lato");
  });
});

describe("parseTarget regressione duo", () => {
  it("duo separatore spaziato invariato", () => {
    const r = parseTarget("3 × 15 / 3 × max/lato", true);
    assert.deepEqual(r, { a: { sets: 3, reps: "15" }, b: { sets: 3, reps: "max/lato" } });
  });
  it("duo: slash con spazi in A separa, qualificatore senza spazi resta", () => {
    const r = parseTarget("3 × 8/lato / 3 × 10", true);
    assert.equal(r.a.reps, "8/lato");
    assert.equal(r.b.reps, "10");
  });
  it("duo senza '/' ricade su entrambe le tracce", () => {
    const r = parseTarget("3 × 10", true);
    assert.deepEqual(r, { a: { sets: 3, reps: "10" }, b: { sets: 3, reps: "10" } });
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test --test-name-pattern="parseTarget"`
Expected: FAIL (il vecchio split su `indexOf("/")` spezza `8/lato`).

- [ ] **Step 3: Implementa**

Sostituisci `parseTarget` (`session.js:14-23`) con:

```js
// Normale -> { sets, reps } (prima parte prima di " / ").
// Superset -> { a, b } o { a, b, c }. Separatore = slash CIRCONDATO DA SPAZI
// (" / "), così qualificatori senza spazi ("8/lato", "max/lato") restano nella
// loro traccia. Si splittano i primi (n-1) separatori; l'ultima traccia tiene il resto.
export function parseTarget(setsReps, superset = false, n = 2) {
  const s = String(setsReps ?? "");
  if (superset) {
    const parts = splitTracks(s, n);
    const out = { a: parseTargetTrack(parts[0] ?? s), b: parseTargetTrack(parts[1] ?? parts[0] ?? s) };
    if (n >= 3) out.c = parseTargetTrack(parts[2] ?? parts[1] ?? parts[0] ?? s);
    return out;
  }
  return parseTargetTrack(splitTracks(s, 1)[0] ?? s);
}

// Splitta una stringa sui primi (n-1) separatori " / " (slash tra spazi);
// l'ultimo elemento conserva tutto il resto. Ritorna fino a n segmenti trimmati.
function splitTracks(s, n) {
  const re = /\s+\/\s+/g;
  const parts = [];
  let last = 0, m, count = 0;
  while (count < n - 1 && (m = re.exec(s)) !== null) {
    parts.push(s.slice(last, m.index));
    last = re.lastIndex;
    count++;
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim());
}
```

Nota: per `superset=false` il comportamento è invariato (prima parte prima del primo " / ").

- [ ] **Step 4: Esegui e verifica PASS**

Run: `node --test tests/session.test.js`
Expected: PASS (inclusi i test esistenti su `parseTarget`).

- [ ] **Step 5: Commit**

```bash
git add session.js tests/session.test.js
git commit -m "feat(session): parseTarget split su ' / ' spaziato + 3a traccia"
```

---

### Task 3: Tracce per-`c` — `entryTrack`, `withSupersetSet/withoutSupersetSet`, `trackName`, `volumeMeta`, `platesOn`

**Files:**
- Modify: `session.js:229-232` (entryTrack), `:83-93` (with/withoutSupersetSet), `:293-297` (trackName), `:303-310` (volumeMeta), `:315-320` (platesOn)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

```js
describe("traccia c", () => {
  const ex = { name: "M1 + M2 + Plank manubri", superset: true, unitC: "sec", muscle: "Core", muscleB: "Core", muscleC: "Core" };
  const entry = {
    a: { sets: [{ reps: "8", kg: "", done: true }] },
    b: { sets: [{ reps: "10", kg: "", done: true }] },
    c: { sets: [{ reps: "20", kg: "30", done: true }] },
  };
  it("withSupersetSet scrive sulla traccia c", () => {
    const nv = withSupersetSet(entry, "c", 1, { reps: "22", kg: "30", done: true });
    assert.equal(nv.c.sets.length, 2);
    assert.equal(nv.c.sets[1].reps, "22");
    assert.equal(nv.a.sets.length, 1); // a/b intatte
  });
  it("withoutSupersetSet rimuove dalla traccia c", () => {
    const nv = withoutSupersetSet(entry, "c", 0);
    assert.equal(nv.c.sets.length, 0);
  });
  it("trackName ritorna il terzo pezzo per c", () => {
    assert.equal(trackName(ex, "c"), "Plank manubri");
  });
  it("volumeMeta c: unitC sec", () => {
    assert.equal(volumeMeta(ex, "c").unit, "sec");
  });
  it("platesOn c usa platesC se booleano", () => {
    assert.equal(platesOn({ ...ex, platesC: true }, "c"), true);
  });
  it("bestKg su track c (passa da entryTrack)", () => {
    const data = { weeks: { "2026-W23": { entries: { A: { x1: entry } } } } };
    assert.equal(bestKg(data, "A", "x1", "c"), 30);
  });
});
```

> Nota: `trackName`, `volumeMeta`, `platesOn` sono export interni? Verifica che siano `export function` in `session.js`. Se `trackName` non è esportata, esportala (serve al test). Idem per gli altri usati nei test.

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test --test-name-pattern="traccia c"`
Expected: FAIL.

- [ ] **Step 3: Implementa**

`entryTrack` (`session.js:229-232`):

```js
function entryTrack(entry, track) {
  if (track === "a" || track === "b" || track === "c") return normalizeSupersetEntry(entry)[track];
  return normalizeEntry(entry);
}
```

`withSupersetSet` / `withoutSupersetSet` (`session.js:85` e `:91`): cambia la riga
`const t = track === "b" ? "b" : "a";` (in entrambe) con:

```js
  const t = track === "b" || track === "c" ? track : "a";
```

`trackName` (`session.js:293-297`):

```js
function trackName(ex, track) {
  const name = String(ex?.name ?? "");
  const parts = name.includes(" + ") ? name.split(" + ") : [name];
  if (track === "c") return (parts[2] ?? parts[0]).trim();
  if (track === "b") return (parts[1] ?? parts[0]).trim();
  return (parts[0] ?? name).trim();
}
```

`volumeMeta` (`session.js:303-310`): le due righe `ov`/`unit`:

```js
  const ov = track === "c" ? ex?.vol2C : track === "b" ? ex?.vol2B : ex?.vol2;
  const unit = (track === "c" ? ex?.unitC : track === "b" ? ex?.unitB : ex?.unit) === "sec" ? "sec" : "reps";
```

`platesOn` (`session.js:316`): la riga `ov`:

```js
  const ov = track === "c" ? ex?.platesC : track === "b" ? ex?.platesB : ex?.plates;
```

Se servono per i test, aggiungi `export` a `trackName`, `volumeMeta`, `platesOn` (probabilmente `volumeMeta`/`platesOn` sono già export; `trackName` no — esportala).

- [ ] **Step 4: Esegui e verifica PASS**

Run: `node --test tests/session.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add session.js tests/session.test.js
git commit -m "feat(session): tracce per-c (entryTrack, with/without, trackName, volumeMeta, platesOn)"
```

---

### Task 4: Iterazioni su tutte le tracce — `isEntryComplete`, `exerciseVolume`, `sessionHasDoneSet`, `weekTopKg`, `volumeByMuscle`, `muscleContributions`

**Files:**
- Modify: `session.js` (`:42-55`, `:338-344`, `:359-368`, `:373-394`, `:399-414`, `:417-431`)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

```js
describe("iterazioni 3 tracce", () => {
  const ex = { name: "A + B + C", superset: true, setsReps: "1 × 8 / 1 × 8 / 1 × 8", muscle: "Core", muscleB: "Core", muscleC: "Core" };
  it("isEntryComplete trio: completo solo se tutte le tracce (non vuote) sono ok", () => {
    const full = {
      a: { sets: [{ reps: "8", kg: "", done: true }] },
      b: { sets: [{ reps: "8", kg: "", done: true }] },
      c: { sets: [{ reps: "8", kg: "", done: true }] },
    };
    assert.equal(isEntryComplete(full, ex), true);
    const cMissing = { ...full, c: { sets: [{ reps: "8", kg: "", done: false }] } };
    assert.equal(isEntryComplete(cMissing, ex), false);
  });
  it("isEntryComplete trio: traccia c vuota non blocca", () => {
    const e = {
      a: { sets: [{ reps: "8", kg: "", done: true }] },
      b: { sets: [{ reps: "8", kg: "", done: true }] },
      c: { sets: [] },
    };
    assert.equal(isEntryComplete(e, ex), true);
  });
  it("exerciseVolume trio somma a+b+c", () => {
    const exW = { name: "A + B + C", superset: true };
    const e = {
      a: { sets: [{ reps: "10", kg: "10", done: true }] },
      b: { sets: [{ reps: "10", kg: "10", done: true }] },
      c: { sets: [{ reps: "10", kg: "10", done: true }] },
    };
    assert.equal(exerciseVolume(e, exW), 300);
  });
  it("volumeByMuscle trio attribuisce anche c->muscleC", () => {
    const exW = { id: "x1", name: "A + B + C", superset: true, muscle: "Petto", muscleB: "Dorso", muscleC: "Gambe" };
    const e = {
      a: { sets: [{ reps: "10", kg: "10", done: true }] },
      b: { sets: [{ reps: "10", kg: "10", done: true }] },
      c: { sets: [{ reps: "10", kg: "10", done: true }] },
    };
    const data = { weeks: { "2026-W23": { entries: { A: { x1: e } } } } };
    const res = volumeByMuscle(data, "2026-W23", "A", { exercises: [exW] });
    assert.deepEqual(res.sort((a,b)=>a.muscle<b.muscle?-1:1).map(r=>r.muscle), ["Dorso","Gambe","Petto"]);
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test --test-name-pattern="iterazioni 3 tracce"`
Expected: FAIL.

- [ ] **Step 3: Implementa**

`isEntryComplete` (`session.js:42-55`) — generalizza il ramo superset:

```js
export function isEntryComplete(entry, ex) {
  if (ex && ex.superset) {
    const e = normalizeSupersetEntry(entry);
    const keys = supersetTrackKeys(ex);
    const n = keys.length;
    const tgt = parseTarget(ex.setsReps, true, n);
    const tracks = keys.map((k) => ({ track: e[k], tgt: tgt[k] }));
    if (tracks.every((t) => t.track.sets.length === 0)) return false;
    return tracks.every((t) => t.track.sets.length === 0 || trackComplete(t.track, t.tgt.sets));
  }
  const e = normalizeEntry(entry);
  const tgt = parseTarget(ex?.setsReps, false);
  return trackComplete(e, tgt.sets);
}
```

`exerciseVolume` (`session.js:338-344`):

```js
export function exerciseVolume(entry, ex) {
  if (ex?.superset) {
    const e = normalizeSupersetEntry(entry);
    return supersetTrackKeys(ex).reduce((sum, k) => sum + trackVolume(e[k], volumeMeta(ex, k)), 0);
  }
  return trackVolume(normalizeEntry(entry), volumeMeta(ex, null));
}
```

`sessionHasDoneSet` (`session.js:359-368`) — il blocco `tracks`:

```js
    const tracks = ex?.superset
      ? supersetTrackKeys(ex).map((k) => normalizeSupersetEntry(v)[k])
      : [normalizeEntry(v)];
```

`volumeByMuscle` (`session.js:381-390`) — il ramo superset:

```js
    if (ex?.superset) {
      const e = normalizeSupersetEntry(v);
      for (const k of supersetTrackKeys(ex)) add(trackMuscle(ex, k), trackVolume(e[k], volumeMeta(ex, k)));
    } else {
      add(ex?.muscle, trackVolume(normalizeEntry(v), volumeMeta(ex, null)));
    }
```

`muscleContributions` (`session.js:404-411`) — il ramo superset:

```js
    if (ex?.superset) {
      const e = normalizeSupersetEntry(v);
      for (const k of supersetTrackKeys(ex)) {
        out.push({ muscle: trackMuscle(ex, k), name: trackName(ex, k), volume: trackVolume(e[k], volumeMeta(ex, k)) });
      }
    } else {
      out.push({ muscle: ex?.muscle, name, volume: trackVolume(normalizeEntry(v), volumeMeta(ex, null)) });
    }
```

`weekTopKg` (`session.js:417-431`) — il blocco `tracks`:

```js
  const tracks = superset
    ? supersetTrackKeys({ name: getEntryExName(data, weekKey, day, exId), superset: true })
        .map((k) => normalizeSupersetEntry(v)[k])
    : [normalizeEntry(v)];
```

⚠️ `weekTopKg` riceve solo `exId`/`superset`, non l'`ex` (quindi non conosce il nome per l'arità). **Soluzione semplice e sicura:** dato che `normalizeSupersetEntry(v)` ora ha sempre `{a,b,c}` e una traccia `c` inesistente è `{sets:[]}`, basta fondere sempre a/b/c senza conoscere l'arità:

```js
  const tracks = superset
    ? (() => { const e = normalizeSupersetEntry(v); return [e.a, e.b, e.c]; })()
    : [normalizeEntry(v)];
```

(Una traccia c vuota non contribuisce al max kg → nessun effetto sui duo.) Usa questa versione; ignora `getEntryExName`.

> Per `trackName` usata in `muscleContributions`: assicurati che sia importabile/visibile nel modulo (è interna a session.js, ok). `trackMuscle` è il nuovo export del Task 1.

- [ ] **Step 4: Esegui e verifica PASS**

Run: `node --test tests/session.test.js`
Expected: PASS (inclusi tutti i test superset preesistenti).

- [ ] **Step 5: Commit**

```bash
git add session.js tests/session.test.js
git commit -m "feat(session): iterazioni volume/completo/record su tutte le tracce (a/b/c)"
```

---

### Task 5: Store — `normalizeSupersetEntry` con traccia `c`

**Files:**
- Modify: `store.js:125-132`
- Test: `tests/store.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

```js
describe("normalizeSupersetEntry con c", () => {
  it("forma {a,b,c,note}", () => {
    const r = normalizeSupersetEntry({
      a: { sets: [{ reps: "8", kg: "" }] },
      b: { sets: [{ reps: "9", kg: "" }] },
      c: { sets: [{ reps: "10", kg: "" }] },
      note: "x",
    });
    assert.equal(r.c.sets[0].reps, "10");
    assert.equal(r.note, "x");
  });
  it("vuoto -> tre tracce vuote", () => {
    const r = normalizeSupersetEntry(undefined);
    assert.deepEqual(r, { a: { sets: [], note: "" }, b: { sets: [], note: "" }, c: { sets: [], note: "" }, note: "" });
  });
  it("duo legacy {a,b} -> c vuota", () => {
    const r = normalizeSupersetEntry({ a: { sets: [{ reps: "8", kg: "" }] }, b: { sets: [] } });
    assert.deepEqual(r.c, { sets: [], note: "" });
  });
});
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `node --test --test-name-pattern="normalizeSupersetEntry con c"`
Expected: FAIL (`c` undefined).

- [ ] **Step 3: Implementa**

`store.js:125-132`:

```js
export function normalizeSupersetEntry(v) {
  if (v && typeof v === "object" && ("a" in v || "b" in v || "c" in v)) {
    return { a: normalizeEntry(v.a), b: normalizeEntry(v.b), c: normalizeEntry(v.c), note: v.note ?? "" };
  }
  // Legacy/single entry -> traccia A; la nota resta a livello superset (e dentro A via base).
  const base = normalizeEntry(v);
  return { a: base, b: { sets: [], note: "" }, c: { sets: [], note: "" }, note: base.note };
}
```

- [ ] **Step 4: Esegui e verifica PASS**

Run: `node --test tests/store.test.js`
Expected: PASS (inclusi i test preesistenti, da aggiornare se asserivano l'assenza di `c` — aggiorna quei test per includere `c: {sets:[],note:""}`).

- [ ] **Step 5: Commit**

```bash
git add store.js tests/store.test.js
git commit -m "feat(store): normalizeSupersetEntry con terza traccia c"
```

---

### Task 6: Vista focus impilata (via i tab) — `renderFocusSuperset`

**Files:**
- Modify: `app.js` (`renderFocusSuperset` ~2703-2760; globali `supersetTab`/`draftA`/`draftB`; `showFeelAsk`; `openFocus` reset)
- Modify: `style.css` (la regola `.ss-tabs` può restare inutilizzata; nessuna nuova regola obbligatoria — i `.track`/`.track + .track` già impilano con separatore)

> Niente unit test (UI non coperta dai test puri del repo). Verifica manuale a fine task.

- [ ] **Step 1: Generalizza lo stato draft**

In `app.js`, dove sono dichiarati `draftA`/`draftB` (cerca `let draftA`), sostituisci con una mappa per-traccia:

```js
let draftTracks = { a: {}, b: {}, c: {} };
```

Aggiorna i riferimenti `draftA`→`draftTracks.a`, `draftB`→`draftTracks.b` ovunque (cerca tutte le occorrenze). Rimuovi `supersetTab` e i suoi usi (cerca `supersetTab`).

- [ ] **Step 2: Riscrivi `renderFocusSuperset` (impilato, niente tab)**

Sostituisci il corpo con la versione che cicla su `supersetTrackKeys(ex)`:

```js
function renderFocusSuperset(ex, idx, container, footer) {
  const exId = exIdAt(idx);
  const v = getEntry(data, currentWeek, currentDay, exId);
  const e = normalizeSupersetEntry(v);
  const keys = supersetTrackKeys(ex);
  const tgt = parseTarget(ex.setsReps, true, keys.length);
  const prev = previousSupersetSets(currentWeek, currentDay, exId); // verifica che ritorni anche .c (vedi Step 3)

  const trendRow = buildTrendRow(exerciseTrend(data, currentDay, exId, currentWeek, 3, true), currentWeek);
  if (trendRow) container.appendChild(trendRow);

  const ssBar = exerciseBar(ex, getBar());
  const blocks = keys.map((k) =>
    trackBlock(k, trackNameOf(ex, k), e[k], tgt[k], prev[k] ?? [], draftTracks[k], idx, ssBar, volumeMeta(ex, k), platesOn(ex, k)));
  blocks.forEach((b) => container.appendChild(b.wrap)); // tutti impilati

  // header serie riferito alla PRIMA traccia non completa (o alla prima)
  const firstActive = blocks.find((b) => !b.allDone) ?? blocks[0];
  const fk = keys[blocks.indexOf(firstActive)];
  document.getElementById("focusSet").textContent =
    `serie ${Math.min(firstActive.curIdx + 1, tgt[fk].sets)} / ${tgt[fk].sets}`;

  if (!isEntryComplete(getEntry(data, currentWeek, currentDay, exId), ex)) {
    const label = keys.map((k) => k.toUpperCase()).join("+");
    const cta = document.createElement("button");
    cta.className = "cta"; cta.textContent = `Serie fatta (${label}) · avvia recupero ▸`;
    cta.addEventListener("click", () => {
      let nv = getEntry(data, currentWeek, currentDay, exId);
      const feelTracks = [];
      let anyRecord = false;
      keys.forEach((k, i) => {
        const blk = blocks[i];
        if (blk.allDone) return; // salta tracce gia complete
        const d = draftTracks[k];
        if (isSetRecord(bestKg(data, currentDay, exId, k), d.kg)) anyRecord = true;
        nv = withSupersetSet(nv, k, blk.curIdx, { reps: d.reps, kg: d.kg, done: true, feel: e[k].sets[blk.curIdx]?.feel ?? "", comments: d.comments });
        feelTracks.push({ track: k, idx: blk.curIdx });
      });
      if (anyRecord) showRecordToast();
      data = setEntry(data, currentWeek, currentDay, exId, nv, new Date().toISOString());
      persist(idx);
      const _doneAll = isEntryComplete(getEntry(data, currentWeek, currentDay, exId), ex);
      const _nx = nextExercisePreview(dayPlan().exercises, idx);
      const _go = _doneAll
        ? (_nx.last ? { fine: true } : { slug: goSlug(_nx.name), serie: 1 })
        : { slug: goSlug(ex.name), serie: firstActive.curIdx + 2 };
      startRest(getRest(currentDay, exId, ex.restSeconds), ex.name, _go);
      render();
      showFeelAsk({ idx, superset: true, tracks: feelTracks, last: _doneAll });
    });
    footer.appendChild(cta);
  }
}
```

Note per l'esecutore:
- `trackNameOf(ex, k)` = il nome della traccia. `trackName` è interna a session.js; esponila come `export` (già fatto nel Task 3) e importala in app.js, oppure replica inline lo split del nome. Usa il nome esportato `trackName`.
- Verifica come l'originale appendeva `cta` (a `container` o `footer`): mantieni lo stesso target dell'originale.
- `previousSupersetSets` deve restituire le serie precedenti per ogni traccia (a/b/c). Vedi Step 3.

- [ ] **Step 3: Aggiorna `previousSupersetSets` per la traccia c**

Cerca `function previousSupersetSets` in app.js. Estendi il ritorno per includere `c` con la stessa logica di `a`/`b` (usa traccia `"c"` in `lastWorkingSet`/`previousWeekSet` o l'equivalente già usato). Se ritorna `{a, b}`, fallo diventare `{a, b, c}`.

- [ ] **Step 4: Aggiorna `showFeelAsk` a N tracce**

Cerca `function showFeelAsk` (e `openFocus` per il reset di `supersetTab`, ora rimosso). Oggi gestisce `aIdx`/`bIdx`; cambialo per ciclare su `opts.tracks` (`[{track, idx}]`) costruendo una barra RPE per ciascuna. Mantieni la stessa UI per-barra; il salvataggio del feel usa `withSupersetSet(v, track, idx, { feel })`.

- [ ] **Step 5: Verifica manuale**

```bash
npm test   # i test puri restano verdi
```
Poi in locale (o su deploy di prova) apri un superset da 2 e verifica: niente tab, due blocchi impilati A/B, CTA "Serie fatta (A+B)", recupero, RPE per traccia. (Il trio si prova in Task 11 con dati reali, oppure creando al volo un esercizio trio in editor — Task 7.)

- [ ] **Step 6: Commit**

```bash
git add app.js style.css
git commit -m "feat(focus): vista superset impilata (via tab) con N tracce + CTA unica"
```

---

### Task 7: Editor — metadati traccia C

**Files:**
- Modify: `index.html` (~388-415, dialog esercizio)
- Modify: `app.js` (`toggleMuscleB` ~1145, `openExDialog` ~1188-1204, `readExDialog` ~1227-1239, `applyChipDefaults` ~1170-1177, `clearExChipsUI` ~3416)

> Verifica manuale.

- [ ] **Step 1: HTML — aggiungi i controlli C**

In `index.html`: cambia l'etichetta superset e aggiungi i campi C. Dopo il blocco `#exChipsB` (riga ~389-392) aggiungi:

```html
    <div class="ex-chips" id="exChipsC" style="display:none">
      <button type="button" id="exVol2C" class="ex-chip" aria-pressed="false">C · VOL ×2</button>
      <button type="button" id="exPlatesC" class="ex-chip" aria-pressed="false">C · DISCHI/LATO</button>
    </div>
```

Cambia l'etichetta superset (riga ~393):

```html
    <label class="notifyrow"><input type="checkbox" id="exSuperset"> Superset / circuito (serie×reps: <code>A / B / C</code>)</label>
```

Dopo i campi B (`#exMuscleB` ~405 e `#exUnitB` ~415) aggiungi i gemelli C:

```html
    <label class="editlabel" for="exMuscleC" id="exMuscleCLabel">Gruppo traccia C</label>
    <select id="exMuscleC" class="ex-inp">
      <option value="">— nessuno —</option>
      <option>Petto</option><option>Dorso</option><option>Spalle</option><option>Bicipiti</option>
      <option>Tricipiti</option><option>Gambe</option><option>Polpacci</option><option>Core</option>
    </select>
    <label class="editlabel" for="exUnitC" id="exUnitCLabel">Unità traccia C</label>
    <select id="exUnitC" class="ex-inp">
      <option value="reps">Ripetizioni</option>
      <option value="sec">Secondi (a tempo, es. plank)</option>
    </select>
```

- [ ] **Step 2: `toggleMuscleB` — mostra/nascondi anche C**

`app.js` ~1145: aggiungi alle righe esistenti:

```js
  document.getElementById("exMuscleC").style.display = on ? "" : "none";
  document.getElementById("exMuscleCLabel").style.display = on ? "" : "none";
  document.getElementById("exUnitC").style.display = on ? "" : "none";
  document.getElementById("exUnitCLabel").style.display = on ? "" : "none";
```

- [ ] **Step 3: `openExDialog` — carica i valori C**

`app.js` ~1195-1199: dopo le righe `exMuscleB`/`exUnitB` aggiungi:

```js
  document.getElementById("exMuscleC").value = ex && ex.muscleC != null ? ex.muscleC : "";
  document.getElementById("exUnitC").value = ex && ex.unitC === "sec" ? "sec" : "reps";
```

E vicino a `document.getElementById("exChipsB").style.display = ...` aggiungi:

```js
  document.getElementById("exChipsC").style.display = (ex && ex.superset) ? "" : "none";
```

Nel ramo `if (ex)` (chip) ~1203-1206 aggiungi le chip C e includile in `exChipsTouched`:

```js
    setChip("exVol2C", typeof ex.vol2C === "boolean" ? ex.vol2C : volumeMeta(ex, "c").factor === 2);
    setChip("exPlatesC", typeof ex.platesC === "boolean" ? ex.platesC : platesOn(ex, "c"));
```
e cambia la riga `exChipsTouched = [...]` in:
```js
    exChipsTouched = [ex.vol2, ex.plates, ex.vol2B, ex.platesB, ex.vol2C, ex.platesC].some((vv) => typeof vv === "boolean");
```

- [ ] **Step 4: `applyChipDefaults` — default chip C**

`app.js` ~1170-1177: aggiungi:

```js
  setChip("exVol2C", volumeMeta(probe, "c").factor === 2);
  setChip("exPlatesC", platesOn(probe, "c"));
```

- [ ] **Step 5: `readExDialog` — salva i campi C**

`app.js` ~1229-1239: dopo le righe `muscleB`/`unitB`/`vol2B`/`platesB` aggiungi:

```js
  const muscleC = document.getElementById("exMuscleC").value;
  if (superset && muscleC) ex.muscleC = muscleC;
  ex.unitC = (superset && document.getElementById("exUnitC").value === "sec") ? "sec" : undefined;
  ex.vol2C = superset ? chipOn("exVol2C") : undefined;
  ex.platesC = superset ? chipOn("exPlatesC") : undefined;
```

- [ ] **Step 6: `clearExChipsUI` — includi le chip C**

`app.js` ~3416: estendi l'array a `["exVol2", "exPlates", "exVol2B", "exPlatesB", "exVol2C", "exPlatesC"]`.

- [ ] **Step 7: Verifica manuale**

Apri l'editor, crea un esercizio con nome `Dead bug + Crunch + Plank`, superset ON, `setsReps` `2 × 8 / 2 × 10 / 2 × 25-30`, muscC=Core, unitC=sec. Salva, riapri: i campi C devono ripopolarsi. In sessione deve mostrare 3 blocchi impilati.

- [ ] **Step 8: Commit**

```bash
git add index.html app.js
git commit -m "feat(editor): metadati traccia C per i circuiti (muscoloC/unitaC/chip C)"
```

---

### Task 8: Riga scheda — badge "vol ×2 / a tempo" considera C

**Files:**
- Modify: `app.js:1131-1132` (`buildPlanRow`)

> Verifica manuale.

- [ ] **Step 1: Aggiorna i predicati del sub-testo**

`app.js:1131-1132`:

```js
    (volumeMeta(ex, null).factor === 2 || (ex.superset && (volumeMeta(ex, "b").factor === 2 || volumeMeta(ex, "c").factor === 2))) ? "vol ×2" : "",
    (ex.unit === "sec" || ex.unitB === "sec" || ex.unitC === "sec") ? "a tempo" : "",
```

(Il nome con due ` ＋ ` è già renderizzato dal loop `split("+")` esistente; nessuna modifica lì.)

- [ ] **Step 2: Verifica manuale**

Nell'editor, la riga di un trio con plank deve mostrare "a tempo"; un trio con manubri deve mostrare "vol ×2".

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(editor): badge riga scheda considera la traccia C"
```

---

### Task 9: Bump service worker

**Files:**
- Modify: `sw.js:5` (`CACHE`)

- [ ] **Step 1: Bump versione**

In `sw.js` cambia `const CACHE = "gymsched-v70";` → `"gymsched-v71";`.

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "chore(sw): bump cache v71 per superset a 3 tracce"
```

---

### Task 10: Full test run + merge su main + deploy

- [ ] **Step 1: Suite completa verde**

Run: `npm test`
Expected: tutti i test PASS (i ~390 preesistenti + i nuovi). Annota il conteggio.

- [ ] **Step 2: Aggiorna lo spec a "implementato"**

In `docs/superpowers/specs/2026-06-08-superset-circuiti-tre-tracce-design.md` segna lo stato come implementato (data 2026-06-08).

- [ ] **Step 3: Merge ff su main e push (deploy GitHub Pages)**

```bash
git checkout main
git pull --ff-only
git merge --ff-only feat/superset-circuiti-3-tracce
git push origin main
```

Se il ff fallisce (main avanzato), fai `git rebase main` sul branch prima del merge. NON forzare.

- [ ] **Step 4: Verifica deploy**

Attendi GitHub Pages; sul telefono potrebbe servire il refresh (banner "Nuova versione · tocca per aggiornare" grazie al bump SW v71).

---

### Task 11: Fase 2 — applica i circuiti core al piano vivo (Playwright)

> Solo DOPO che il deploy (Task 10) è live e supporta i trio. Tecnica = quella della v430 (vedi memory `scheda-revisione-petto-3x`). Manuale/assistito.

- [ ] **Step 1: Login ad hoc + leggi il blob**

Apri https://xbacco.github.io/gym-schedule/ via Playwright, login (autofill profilo), leggi `localStorage` blob della scheda attiva `2b80r`.

- [ ] **Step 2: Sostituisci le 3 voci-circuito rotte con superset da 3**

Nel `plan` della scheda `2b80r`, per ciascun giorno trasforma la voce "Circ.N …" in un esercizio:
- `superset: true`, `muscle/muscleB/muscleC: "Core"`, `restSeconds: 60`
- nome e `setsReps` (vedi tabella). Mantieni gli `id` se possibile per agganciare lo storico; altrimenti id nuovi (lo storico delle vecchie voci resta scollegato, zero perdite).

| Giorno | Nome | setsReps | unità (a/b/c) |
|---|---|---|---|
| C | `Dead bug + Crunch a terra + Plank` | `2 × 8/lato / 2 × 10 / 2 × 25-30` | reps/reps/`unitC:"sec"` |
| B | `Bird-dog + Russian twist + Plank laterale` | `2 × 8/lato / 2 × 8/lato / 2 × 20/lato` | reps/reps/`unitC:"sec"` |
| A | `Crunch inverso + Hollow hold + Plank tocco spalla` | `2 × 10 / 2 × 20-25 / 2 × 8/lato` | reps/`unitB:"sec"`/reps |

- [ ] **Step 3: Marca dirty + reload + verifica**

Scrivi il blob modificato + `_dirty=true`, reload → `mergeBlobs` + push. Verifica: `dirty=false`, `version` incrementata, settimane di log intatte, i 3 circuiti appaiono come superset da 3 in sessione. Poi logout dal browser di automazione.

- [ ] **Step 4: Aggiorna memory**

Aggiorna `scheda-revisione-petto-3x` (o nuova nota) con lo stato "circuiti applicati come superset da 3, vX".

---

## Self-Review (eseguita)

- **Copertura spec:** data model (T5), arità+parseTarget (T1,T2), per-traccia c (T3), iterazioni (T4), focus impilato (T6), editor (T7), riga scheda (T8), SW (T9), rollout (T10,T11). ✓
- **Placeholder:** nessuno; codice completo in ogni step logico. Le task UI (T6/T7/T8) hanno verifica manuale (l'app non è coperta dai test puri del repo) — esplicitato.
- **Coerenza tipi:** `supersetTrackKeys`/`trackMuscle`/`trackName` usati coerentemente; `draftTracks.{a,b,c}` sostituisce `draftA/draftB`; `showFeelAsk({tracks})` coerente tra T6.4 e T6.2.
- **Rischio noto:** `weekTopKg` non conosce l'arità → si fondono sempre a/b/c (c vuota = innocua sui duo). Esplicitato in T4.
```
