# Fase 5 — Serie di riscaldamento vs working set + banner aggiornamento PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcare le serie come riscaldamento (escluse da volume/PR/trend e dal target), arricchire la riga volume col totale assoluto precedente, e aggiungere un banner "nuova versione" per la PWA.

**Architecture:** Un nuovo flag booleano `warmup` per serie nel modello dati per-serie. La logica pura (`store.js`/`session.js`) esclude i warmup dai calcoli; l'UI (`app.js`/`style.css`) aggiunge il pulsante `+ riscald.`, la resa attenuata e il banner di aggiornamento. Logica pura in TDD con `node --test`; UI verificata in browser reale.

**Tech Stack:** HTML/CSS/JS vanilla a moduli ES, `node --test` come gate dei test, deploy su GitHub Pages, service worker per la PWA.

**Spec:** `docs/superpowers/specs/2026-05-26-fase5-warmup-working-set-design.md`

---

## File Structure

- `store.js` — `normalizeSet` (nuovo campo `warmup`), `prefillSets` (porta `warmup`). [Task 1]
- `session.js` — esclusione warmup da `bestKg`, `trackVolume`, `weekTopKg`; `trackComplete` sui soli working set; `previousSetInSession`/`previousWeekSet` saltano i warmup. [Task 2, 3]
- `tests/store.test.js`, `tests/session.test.js` — copertura della logica pura. [Task 1, 2, 3]
- `app.js` — `setRow` (resa warmup), `renderFocusNormal` (pulsante `+ riscald.` + dots), `buildVolumeRow` (nuovo formato), registrazione SW (banner). [Task 4, 5, 6, 7]
- `style.css` — stili `.srow.warm`, `.wbadge`, `.dt.warm`, `.addset.warm`, `.volcard` (sotto-riga), banner. [Task 4, 5, 6, 7]
- `sw.js` — niente `skipWaiting` automatico, listener `message`, bump `CACHE`. [Task 7]

---

## Task 1: Modello dati — flag `warmup`

**Files:**
- Modify: `store.js` (`normalizeSet` ~righe 61-64, `prefillSets` ~righe 88-97)
- Test: `tests/store.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in fondo a `tests/store.test.js` (gli import `normalizeSet`, `normalizeEntry`, `prefillSets`, `emptyData`, `setEntry` potrebbero già esserci in cima; aggiungili se mancano):

```js
import { normalizeSet, prefillSets } from "../store.js";

test("normalizeSet: warmup default false, preserva true", () => {
  assert.equal(normalizeSet({ reps: 8, kg: 50 }).warmup, false);
  assert.equal(normalizeSet({ reps: 8, kg: 50, warmup: true }).warmup, true);
  assert.equal(normalizeSet({ warmup: "x" }).warmup, true); // coercizione booleana
});

test("prefillSets: porta il flag warmup dalle serie precedenti", () => {
  let d = emptyData();
  d = setEntry(d, "2026-W20", "A", 0, { sets: [
    { reps: 8, kg: 40, done: true, warmup: true },
    { reps: 8, kg: 72.5, done: true, warmup: false },
  ] });
  const pre = prefillSets(d, "2026-W21", "A", 0);
  assert.equal(pre[0].warmup, true);
  assert.equal(pre[1].warmup, false);
  assert.equal(pre[0].done, false);
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: i due nuovi test falliscono (`warmup` è `undefined`).

- [ ] **Step 3: Implementa la modifica minima**

In `store.js`, `normalizeSet`:

```js
export function normalizeSet(s) {
  const feel = FEELS.has(s?.feel) ? s.feel : "";
  return { reps: String(s?.reps ?? ""), kg: String(s?.kg ?? ""), done: !!s?.done, feel, warmup: !!s?.warmup };
}
```

In `store.js`, `prefillSets`, riga del `return`:

```js
    if (e.sets.length) return e.sets.map(({ reps, kg, warmup }) => ({ reps, kg, done: false, warmup: !!warmup }));
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: tutti i test passano.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add store.js tests/store.test.js
git commit -m "feat(store): flag warmup su normalizeSet e prefillSets"
```

---

## Task 2: Esclusione warmup da volume, PR e trend

**Files:**
- Modify: `session.js` (`bestKg` ~righe 121-131, `trackVolume` ~righe 178-186, `weekTopKg` ~righe 205-218)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in fondo a `tests/session.test.js` (gli import `bestKg`, `sessionVolume`, `exerciseTrend`, `emptyData`, `setEntry` sono già presenti):

```js
test("warmup escluso da volume, PR e trend", () => {
  const dayPlan = { exercises: [{ name: "Panca", setsReps: "4 × 8" }] };
  let d = emptyData();
  d = setEntry(d, "2026-W22", "A", 0, { sets: [
    { reps: 8, kg: 40,   done: true, warmup: true },   // riscaldamento: NON conta
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
  ] });
  // volume: solo le due working = 8*72.5*2 = 1160 (il warmup 8*40=320 escluso)
  assert.equal(sessionVolume(d, "2026-W22", "A", dayPlan), 1160);
  // PR: 72.5, non 40... ma qui 72.5 > 40 comunque; usiamo un warmup più pesante per il test:
  let d2 = emptyData();
  d2 = setEntry(d2, "2026-W22", "A", 0, { sets: [
    { reps: 3, kg: 90, done: true, warmup: true },     // warmup "pesante" fittizio: NON è un PR
    { reps: 8, kg: 72.5, done: true, warmup: false },
  ] });
  assert.equal(bestKg(d2, "A", 0), 72.5);
  // trend top-set: 72.5 (il 90 warmup escluso)
  const tr = exerciseTrend(d2, "A", 0, "2026-W22", 3);
  assert.equal(tr[tr.length - 1].kg, 72.5);
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: il nuovo test fallisce (volume 1480, bestKg 90, trend 90).

- [ ] **Step 3: Implementa le modifiche**

In `session.js`, `bestKg`, dentro il ciclo `for (const s of e.sets)` aggiungi come prima riga:

```js
      if (s.warmup) continue;
```

In `session.js`, `trackVolume`, sostituisci `if (!s.done) continue;` con:

```js
    if (!s.done || s.warmup) continue;
```

In `session.js`, `weekTopKg`, dentro `for (const s of t.sets)` aggiungi come prima riga:

```js
      if (s.warmup) continue;
```

(`exerciseTrend` usa `weekTopKg`, quindi eredita l'esclusione.)

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: tutti i test passano.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add session.js tests/session.test.js
git commit -m "feat(session): escludi warmup da volume, PR e trend"
```

---

## Task 3: Target sui soli working set + repeat-helpers che saltano i warmup

**Files:**
- Modify: `session.js` (`trackComplete` ~righe 34-37, `previousSetInSession` ~righe 148-155, `previousWeekSet` ~righe 159-170)
- Test: `tests/session.test.js`

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in fondo a `tests/session.test.js`:

```js
test("trackComplete: il target conta solo i working set", () => {
  const ex = { name: "Panca", setsReps: "4 × 8" };
  // 1 warmup + 3 working, tutte done -> NON completo (servono 4 working)
  let d = emptyData();
  d = setEntry(d, "2026-W22", "A", 0, { sets: [
    { reps: 8, kg: 40,   done: true, warmup: true },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
  ] });
  assert.equal(isEntryComplete(getEntry(d, "2026-W22", "A", 0), ex), false);
  // 1 warmup + 4 working, tutte done -> completo
  let d2 = emptyData();
  d2 = setEntry(d2, "2026-W22", "A", 0, { sets: [
    { reps: 8, kg: 40,   done: true, warmup: true },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: 8, kg: 72.5, done: true, warmup: false },
  ] });
  assert.equal(isEntryComplete(getEntry(d2, "2026-W22", "A", 0), ex), true);
});

test("previousSetInSession salta i warmup", () => {
  const entry = { sets: [
    { reps: 8, kg: 40, done: true, warmup: true },
    { reps: 8, kg: 72.5, done: true, warmup: false },
    { reps: "", kg: "", done: false, warmup: false },
  ] };
  // dalla serie 3 (index 2): l'ultima working done è la index 1 (72.5), non il warmup 40
  assert.deepEqual(previousSetInSession(entry, 2), { reps: "8", kg: "72.5" });
});

test("previousWeekSet si allinea ai soli working set", () => {
  let d = emptyData();
  d = setEntry(d, "2026-W21", "A", 0, { sets: [
    { reps: 8, kg: 40, done: true, warmup: true },   // warmup: ignorato nell'allineamento
    { reps: 8, kg: 70, done: true, warmup: false },  // working #0
    { reps: 8, kg: 72.5, done: true, warmup: false },// working #1
  ] });
  // setIndex 0 -> primo working (70), non il warmup
  assert.deepEqual(previousWeekSet(d, "A", 0, "2026-W22", 0), { reps: "8", kg: "70", week: "2026-W21" });
});
```

Assicurati che `getEntry` sia importato in cima al file di test:

```js
import { emptyData, setEntry, getEntry } from "../store.js";
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: i tre nuovi test falliscono.

- [ ] **Step 3: Implementa le modifiche**

In `session.js`, sostituisci `trackComplete`:

```js
function trackComplete(track, targetSets) {
  const working = track.sets.filter((s) => !s.warmup).length;
  return working >= targetSets && working > 0 && track.sets.every((s) => s.done);
}
```

In `session.js`, `previousSetInSession`, dentro il ciclo sostituisci la riga `if (t.sets[i].done)` con:

```js
    if (t.sets[i].done && !t.sets[i].warmup) return { reps: t.sets[i].reps, kg: t.sets[i].kg };
```

In `session.js`, `previousWeekSet`, sostituisci il corpo del ciclo:

```js
  for (let i = keys.length - 1; i >= 0; i--) {
    const t = entryTrack(getEntry(data, keys[i], day, idx), track);
    const working = t.sets.filter((s) => !s.warmup);
    if (working.length) {
      const s = working[setIndex] ?? working[working.length - 1];
      return { reps: s.reps, kg: s.kg, week: keys[i] };
    }
  }
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: tutti i test passano (compresi quelli preesistenti, ~91+).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add session.js tests/session.test.js
git commit -m "feat(session): target sui soli working set, repeat-helpers saltano i warmup"
```

---

## Task 4: Resa della serie warmup in `setRow`

**Files:**
- Modify: `app.js` (`setRow` ~righe 433-488)
- Modify: `style.css` (dopo le regole `.srow`, ~riga 62)

- [ ] **Step 1: Modifica `setRow` in `app.js`**

Cambia la riga dell'indice e della className iniziale:

```js
  const row = document.createElement("div");
  row.className = "srow" + (isCurrent ? " cur" : "") + (set.warmup ? " warm" : "");
  const idx = document.createElement("span"); idx.className = "i"; idx.textContent = set.warmup ? "W" : String(i + 1);
```

Sostituisci il blocco della marcatura di progressione (da `const delta = prev ?` fino alla chiusura del blocco `else if (isCurrent)`) con:

```js
  if (set.warmup && set.done) {
    const b = document.createElement("span"); b.className = "wbadge"; b.textContent = "RISCALD.";
    row.appendChild(b);
  } else {
    const delta = prev ? progressionDelta(set.kg, prev.kg) : null;
    if (set.done && delta !== null && delta > 0) {
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = `▲ +${delta}`;
      row.appendChild(tag);
    } else if (set.done && delta !== null && delta < 0) {
      const tag = document.createElement("span"); tag.className = "tag down"; tag.textContent = `▼ ${delta}`;
      row.appendChild(tag);
    } else if (set.done) {
      const chk = document.createElement("span"); chk.className = "chk"; chk.textContent = "✓";
      if (!set.feel) chk.style.marginLeft = "auto";
      row.appendChild(chk);
    } else if (isCurrent) {
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "in corso"; tag.style.marginLeft = "auto";
      row.appendChild(tag);
    }
  }
```

Cambia la condizione del tag feel per non mostrarlo sui warmup:

```js
  if (set.done && !set.warmup && set.feel && onFeel) {
```

- [ ] **Step 2: Aggiungi gli stili in `style.css`** (dopo riga 62, `.srow.cur .tag{...}`)

```css
.srow.warm{opacity:.62;}
.srow.warm .i{color:var(--acc);}
.srow.warm .v{color:var(--dim);}
.srow .wbadge{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.09em;
  color:var(--faint);border:1px solid var(--line);border-radius:6px;padding:1px 6px;}
```

- [ ] **Step 3: Verifica in browser**

Avvia un server locale e apri l'app:

```bash
cd C:/Users/TomasCoro/gym-schedule; python -m http.server 8062
```
Apri `http://localhost:8062/`. (La verifica completa è nel Task 5 una volta che si può aggiungere un warmup; qui basta controllare che l'app carichi senza errori in console.)

- [ ] **Step 4: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add app.js style.css
git commit -m "feat(ui): resa della serie di riscaldamento in setRow"
```

---

## Task 5: Pulsante `+ riscald.` e dots warmup in `renderFocusNormal`

**Files:**
- Modify: `app.js` (`renderFocusNormal`, blocco dots ~righe 566-580)
- Modify: `style.css` (`.dt`/`.addset`, ~righe 99-103)

- [ ] **Step 1: Modifica il blocco dots in `app.js`**

Sostituisci il ciclo dei dots e l'aggiunta del pulsante (da `const dots = ...` fino a `card.appendChild(dots);`) con:

```js
  const dots = document.createElement("div");
  dots.className = "dots";
  for (let i = 0; i < total; i++) {
    const s = entry.sets[i];
    const d = document.createElement("span");
    let cls = "dt";
    if (s && s.warmup) cls = "dt warm";
    else if (i < curIdx) cls = "dt on";
    else if (i === curIdx) cls = "dt cur";
    d.className = cls;
    dots.appendChild(d);
  }
  const addW = document.createElement("button");
  addW.className = "addset warm"; addW.textContent = "+ riscald.";
  addW.addEventListener("click", () => {
    data = setEntry(data, currentWeek, currentDay, focusIndex, withSet(v, entry.sets.length, { reps: "", kg: "", done: false, warmup: true }), new Date().toISOString());
    persist(); render();
  });
  const add = document.createElement("button");
  add.className = "addset"; add.textContent = "+ serie";
  add.addEventListener("click", () => {
    data = setEntry(data, currentWeek, currentDay, focusIndex, withSet(v, entry.sets.length, { reps: "", kg: "", done: false }), new Date().toISOString());
    persist(); render();
  });
  dots.appendChild(addW);
  dots.appendChild(add);
  card.appendChild(dots);
```

- [ ] **Step 2: Aggiungi gli stili in `style.css`** (dopo riga 101, `.dt.cur{...}`, e dopo la regola `.addset`)

```css
.dt.warm{background:transparent;box-shadow:0 0 0 2px var(--bg),0 0 0 3px var(--acc);}
.addset.warm{border-style:solid;border-color:rgba(63,224,168,.4);color:var(--acc);}
```

- [ ] **Step 3: Verifica in browser**

Con il server attivo (`http://localhost:8062/`):
1. In un esercizio normale, tocca **`+ riscald.`** → compare una serie nuova; impostane il carico (es. 40) e premi "Serie fatta".
2. Verifica: la riga è attenuata, l'indice è **`W`**, c'è il badge **`RISCALD.`**, **nessun** `▲`.
3. Completa le 4 working set e verifica che l'esercizio risulti completo solo a **4 working** (il warmup non conta).
4. Controlla che la barra di progresso/volume in fondo **escluda** il warmup.
5. Console: nessun errore nuovo (sono attesi solo 404 favicon + warning meta deprecato preesistenti).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add app.js style.css
git commit -m "feat(ui): pulsante + riscald. e dots warmup in renderFocusNormal"
```

---

## Task 6: Nuovo formato della riga volume

**Files:**
- Modify: `app.js` (`buildVolumeRow` ~righe 286-301)
- Modify: `style.css` (`.volcard`, ~righe 173-178)

- [ ] **Step 1: Sostituisci `buildVolumeRow` in `app.js`**

```js
function buildVolumeRow(vol, prevVol) {
  const row = document.createElement("div");
  row.className = "volcard";
  const l = document.createElement("span"); l.className = "vl"; l.textContent = "Volume sessione";
  const right = document.createElement("div"); right.className = "vright";
  const v = document.createElement("span"); v.className = "vv"; v.textContent = `${fmtKg(vol)} kg`;
  right.appendChild(v);
  if (prevVol > 0) {
    const sub = document.createElement("span"); sub.className = "vsub";
    const pct = Math.round(((vol - prevVol) / prevVol) * 100);
    const p = document.createElement("span");
    p.className = pct >= 0 ? "acc" : "neg";
    p.textContent = `${pct >= 0 ? "+" : ""}${pct}%`;
    sub.appendChild(p);
    sub.appendChild(document.createTextNode(` · sett. scorsa ${fmtKg(prevVol)} kg`));
    right.appendChild(sub);
  }
  row.append(l, right);
  return row;
}
```

- [ ] **Step 2: Aggiorna gli stili `.volcard` in `style.css`** (sostituisci le regole `.volcard .vv .acc` / `.neg` e aggiungi quelle nuove)

```css
.volcard{display:flex;justify-content:space-between;align-items:flex-start;background:var(--surf2);
  border:1px solid var(--line);border-radius:11px;padding:10px 13px;margin-top:14px;}
.volcard .vl{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding-top:3px;}
.volcard .vright{display:flex;flex-direction:column;align-items:flex-end;gap:2px;}
.volcard .vv{font-family:"JetBrains Mono",monospace;font-size:16px;font-weight:700;color:var(--ink);}
.volcard .vsub{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--dim);}
.volcard .vsub .acc{color:var(--acc);}
.volcard .vsub .neg{color:#FFB37F;}
```

- [ ] **Step 3: Verifica in browser**

Con il server attivo: in fondo alla focus card la riga "Volume sessione" mostra il numero grande e, sotto a destra, `±N% · sett. scorsa <tot> kg` (la % verde se ≥ 0, arancio se < 0). Se non c'è settimana precedente con volume, compare solo il numero.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add app.js style.css
git commit -m "feat(ui): riga volume con totale assoluto della settimana precedente"
```

---

## Task 7: Banner aggiornamento PWA + bump cache

**Files:**
- Modify: `sw.js` (handler `install` ~riga 21, nuovo listener `message`, `CACHE` ~riga 5)
- Modify: `app.js` (registrazione SW ~righe 882-887)
- Modify: `style.css` (nuovo stile banner)

- [ ] **Step 1: Modifica `sw.js`**

Cambia il nome cache (riga 5):

```js
const CACHE = "gymsched-v2";
```

Sostituisci l'handler `install` (rimuovi `skipWaiting` automatico):

```js
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});
```

Aggiungi in fondo al file un listener `message`:

```js
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
```

- [ ] **Step 2: Sostituisci il blocco di registrazione SW in `app.js`** (~righe 882-887)

```js
// PWA: registra il service worker e gestisce l'aggiornamento (best-effort).
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(reg);
        });
      });
    }).catch(() => { /* SW non disponibile */ });
  });
}

function showUpdateBanner(reg) {
  if (document.getElementById("updateBanner")) return;
  const b = document.createElement("button");
  b.id = "updateBanner";
  b.textContent = "Nuova versione · tocca per aggiornare";
  b.addEventListener("click", () => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  });
  document.body.appendChild(b);
}
```

- [ ] **Step 3: Aggiungi lo stile del banner in `style.css`** (in fondo al file)

```css
#updateBanner{position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:50;
  background:var(--acc);color:var(--acc-ink);border:none;border-radius:12px;padding:11px 16px;
  font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:700;cursor:pointer;
  box-shadow:0 6px 20px rgba(0,0,0,.4);}
```

(`bottom:84px` tiene il banner sopra la barra timer fissa; se la barra timer ha un'altezza diversa, allinealo a quella.)

- [ ] **Step 4: Verifica in browser**

1. Apri l'app su `http://localhost:8062/` una prima volta (installa il SW `v2`): il banner **non** deve comparire (prima installazione, nessun controller).
2. Simula un aggiornamento: modifica un byte di un file dello shell e bumpa `CACHE` in `sw.js` a `gymsched-v3`, ricarica due volte. Atteso: compare il banner "Nuova versione…", il tap ricarica e applica il codice nuovo, **senza** loop di reload. Riporta poi `CACHE` a `gymsched-v2` (lo stato che vogliamo deployare) se hai fatto il test con v3.
3. Console: nessun errore.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/TomasCoro/gym-schedule
git add sw.js app.js style.css
git commit -m "feat(pwa): banner nuova versione + bump cache v2"
```

---

## Task 8: Verifica finale e deploy

- [ ] **Step 1: Gate dei test**

Run: `cd C:/Users/TomasCoro/gym-schedule; node --test`
Expected: tutti i test passano, 0 fail.

- [ ] **Step 2: Verifica olistica in browser** (Playwright o manuale)

Scenario completo su un esercizio normale: aggiungi 1 warmup (40 kg) + 4 working (72.5 kg), conferma resa attenuata/badge, completamento a 4 working, volume e trend che escludono il warmup, e la nuova riga volume. Console pulita.

- [ ] **Step 3: Push (deploy GitHub Pages)**

```bash
cd C:/Users/TomasCoro/gym-schedule
git push origin main
```

- [ ] **Step 4: Aggiorna la memoria**

Aggiorna `gym-schedule-phases.md` (memory) per registrare la Fase 5 come completata e svuotare il backlog §8.

---

## Self-Review (eseguita)

- **Copertura spec:** §3 modello dati → Task 1; §4.1/§4.2 logica → Task 1/2/3; §5.2 setRow → Task 4; §5.1/§5.3 pulsante+dots → Task 5; §5.4 volume → Task 6; §6 banner PWA → Task 7; §8 testing → Task 1-3 (unit) + Task 5/7/8 (browser). §7 fuori scope (superset `+ riscald.`) rispettato: i Task UI toccano solo `renderFocusNormal`.
- **Placeholder:** nessuno; ogni step ha codice/comandi concreti.
- **Coerenza tipi/nomi:** flag `warmup` usato in modo uniforme; `showUpdateBanner(reg)` definita e chiamata in Task 7; classi CSS (`.srow.warm`, `.wbadge`, `.dt.warm`, `.addset.warm`, `.vright`, `.vsub`, `#updateBanner`) coerenti tra app.js e style.css.
