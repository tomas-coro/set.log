# Fix sovrapposizione striscia giudizio / barra timer (#bottomStack) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La striscia «com'è andata?» non deve mai più sovrapporsi alla barra timer: i due elementi entrano in un unico wrapper fisso `#bottomStack` (striscia sopra, barra sotto).

**Architecture:** Oggi `.feelask` (fixed, `bottom:74px`, z-55) e `.timerbar` (fixed, `bottom:0`, z-60) sono fissati indipendentemente e collidono. Il fix sposta il posizionamento su un unico contenitore flex-column fisso in basso; i figli diventano blocchi statici. Una classe `body.feel-on` (toggle in `showFeelAsk`/`hideFeelAsk`) regola il padding del focus perché le note restino raggiungibili. Comportamento del giudizio invariato.

**Tech Stack:** vanilla HTML/CSS/JS, PWA statica, test `node --test` (332 verdi, nessun DOM → niente test nuovi, fix di solo layout).

**Spec:** `docs/superpowers/specs/2026-06-04-fix-stack-feelask-timerbar-design.md`

---

### Task 1: Wrapper `#bottomStack` — markup + CSS di posizionamento

**Files:**
- Modify: `index.html:403-407` (sposta `#feelAsk`), `index.html:425-445` (wrappa `#timerBar`)
- Modify: `style.css:199-202` (`.timerbar` base), `style.css:491-492` (z-index legacy), `style.css:572-574` (`.feelask`)

- [ ] **Step 1: index.html — togli `#feelAsk` dalla posizione attuale**

Edit su `index.html`, old_string:

```html
  <!-- Striscia sensazione durante il recupero -->
  <div id="feelAsk" class="feelask hidden">
    <div class="q">Serie <span id="feelAskN"></span> · <b>com'è andata?</b></div>
    <div id="feelAskBar"></div>
  </div>

  <!-- Menu drawer in fondo -->
```

new_string:

```html
  <!-- Menu drawer in fondo -->
```

- [ ] **Step 2: index.html — apri lo stack e reinserisci `#feelAsk` sopra la barra**

Edit su `index.html`, old_string:

```html
  <!-- Rest timer: riga 1 = nome esercizio + chiudi; riga 2 = tempo + controlli -->
  <div id="timerBar" class="timerbar hidden">
```

new_string:

```html
  <!-- Stack fisso in basso: striscia giudizio sopra, barra timer sotto (mai sovrapposte) -->
  <div id="bottomStack">

  <!-- Striscia sensazione durante il recupero -->
  <div id="feelAsk" class="feelask hidden">
    <div class="q">Serie <span id="feelAskN"></span> · <b>com'è andata?</b></div>
    <div id="feelAskBar"></div>
  </div>

  <!-- Rest timer: riga 1 = nome esercizio + chiudi; riga 2 = tempo + controlli -->
  <div id="timerBar" class="timerbar hidden">
```

- [ ] **Step 3: index.html — chiudi lo stack dopo `#timerBar`**

Edit su `index.html`, old_string:

```html
    <div id="timerGo" class="t-go hidden">
      <div class="g1"><span class="g-ok">[ ok ]</span> recupero completato · <span id="goRest"></span></div>
      <div class="g2"><span class="g-chev">&gt;</span> <span id="goVerb">vai</span> <span id="goPath" class="g-path"></span><span class="g-cursor"></span></div>
    </div>
  </div>
```

new_string:

```html
    <div id="timerGo" class="t-go hidden">
      <div class="g1"><span class="g-ok">[ ok ]</span> recupero completato · <span id="goRest"></span></div>
      <div class="g2"><span class="g-chev">&gt;</span> <span id="goVerb">vai</span> <span id="goPath" class="g-path"></span><span class="g-cursor"></span></div>
    </div>
  </div>
  </div><!-- /bottomStack -->
```

- [ ] **Step 4: style.css — nuova regola `#bottomStack`, `.timerbar` senza posizionamento proprio**

Edit su `style.css`, old_string:

```css
/* timer bar — due righe: nome esercizio intero sopra, tempo + controlli sotto */
.timerbar{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:440px;
  background:var(--surf2);border-top:1px solid var(--line);
  padding:14px 18px 16px;backdrop-filter:blur(8px);}
```

new_string:

```css
/* stack fisso in basso: striscia giudizio sopra, barra timer sotto — mai sovrapposte.
   Assorbe il posizionamento che prima era duplicato (e in conflitto) nei due figli. */
#bottomStack{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:440px;
  z-index:60;display:flex;flex-direction:column;}

/* timer bar — due righe: nome esercizio intero sopra, tempo + controlli sotto */
.timerbar{background:var(--surf2);border-top:1px solid var(--line);
  padding:14px 18px 16px;backdrop-filter:blur(8px);}
```

- [ ] **Step 5: style.css — elimina lo z-index legacy della barra (la z la dà lo stack)**

Edit su `style.css`, old_string:

```css
.focus-foot .cta{margin-top:0;}
/* la barra timer resta sopra l'overlay (parte dalla CTA dentro il focus) */
.timerbar{z-index:60;}
```

new_string:

```css
.focus-foot .cta{margin-top:0;}
```

- [ ] **Step 6: style.css — `.feelask` senza posizionamento proprio**

Edit su `style.css`, old_string:

```css
.feelask{position:fixed;left:50%;transform:translateX(-50%);bottom:74px;width:100%;max-width:440px;z-index:55;
  background:var(--surf2);border-top:2px solid var(--acc);padding:12px 14px 14px;
  box-shadow:0 -8px 24px rgba(0,0,0,.45);}
```

new_string:

```css
/* dentro #bottomStack, sopra la barra timer (lo stack la posiziona) */
.feelask{background:var(--surf2);border-top:2px solid var(--acc);padding:12px 14px 14px;
  box-shadow:0 -8px 24px rgba(0,0,0,.45);}
```

- [ ] **Step 7: suite verde**

Run: `npm test`
Expected: 332 pass, 0 fail (nessun test tocca il DOM: è una verifica di non-regressione sul resto).

- [ ] **Step 8: Commit**

```powershell
git add index.html style.css
git commit -m @'
fix(ui): striscia giudizio e barra timer in un unico stack fisso

#bottomStack assorbe il posizionamento: via il bottom:74px hardcoded
della feelask (z-55) che finiva sotto la timerbar a due righe (z-60).
Sovrapposizione impossibile per costruzione.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task 2: `body.feel-on` — spazio riservato nel focus

**Files:**
- Modify: `app.js:1953-1955` (`showFeelAsk`), `app.js:1957-1963` (`hideFeelAsk`)
- Modify: `style.css:596-597` (padding focus)

- [ ] **Step 1: style.css — padding del focus per i tre stati dello stack**

Edit su `style.css`, old_string:

```css
/* il timer (fixed) non deve più coprire le note del focus */
body.timer-on .focus-body{padding-bottom:196px;}
```

new_string:

```css
/* lo stack in basso (timer e/o striscia giudizio) non deve coprire le note del focus */
body.timer-on .focus-body{padding-bottom:196px;}
body.feel-on .focus-body{padding-bottom:140px;}
body.timer-on.feel-on .focus-body{padding-bottom:300px;}
```

- [ ] **Step 2: app.js — `showFeelAsk` aggiunge `feel-on`**

Edit su `app.js`, old_string:

```js
  paint();
  document.getElementById("feelAsk").classList.remove("hidden");
}
```

new_string:

```js
  paint();
  document.getElementById("feelAsk").classList.remove("hidden");
  document.body.classList.add("feel-on"); // padding extra nel focus: lo stack ora è più alto
}
```

- [ ] **Step 3: app.js — `hideFeelAsk` toglie `feel-on`**

Edit su `app.js`, old_string:

```js
  document.getElementById("feelAsk").classList.add("hidden");
  lastDone = null;
}
```

new_string:

```js
  document.getElementById("feelAsk").classList.add("hidden");
  document.body.classList.remove("feel-on");
  lastDone = null;
}
```

- [ ] **Step 4: suite verde**

Run: `npm test`
Expected: 332 pass, 0 fail.

- [ ] **Step 5: Commit**

```powershell
git add app.js style.css
git commit -m @'
fix(focus): padding extra quando la striscia giudizio è visibile

body.feel-on da show/hideFeelAsk: con stack più alto (timer + striscia)
le note in fondo al focus restano raggiungibili.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

### Task 3: Bump cache SW + verifica nel browser

**Files:**
- Modify: `sw.js:5`

- [ ] **Step 1: sw.js — bump cache (app-shell cambiato: index.html, style.css, app.js)**

Edit su `sw.js`, old_string:

```js
const CACHE = "gymsched-v61";
```

new_string:

```js
const CACHE = "gymsched-v62";
```

- [ ] **Step 2: servi l'app in locale**

Run (run_in_background): `npx -y http-server -p 8123 -c-1 .`
Expected: server su `http://localhost:8123`.

- [ ] **Step 3: verifica geometrica nel browser (Playwright)**

1. `browser_resize` a 390×844 (viewport telefono).
2. `browser_navigate` → `http://localhost:8123`.
3. `browser_evaluate`:

```js
() => {
  document.getElementById("feelAsk").classList.remove("hidden");
  document.getElementById("timerBar").classList.remove("hidden");
  const f = document.getElementById("feelAsk").getBoundingClientRect();
  const t = document.getElementById("timerBar").getBoundingClientRect();
  return {
    feelaskSopraBarra: Math.abs(f.bottom - t.top) < 0.5,
    nessunaSovrapposizione: f.bottom <= t.top + 0.5,
    barraAFondoSchermo: Math.abs(t.bottom - window.innerHeight) < 1,
    larghezzaUguale: Math.abs(f.width - t.width) < 0.5,
  };
}
```

Expected: tutti `true`. Poi `browser_console_messages`: nessun errore JS.

4. Screenshot di controllo (`browser_take_screenshot`) con entrambi visibili.

- [ ] **Step 4: verifica manuale comportamentale (checklist dello spec, §Verifica manuale)**

Nell'app servita (o sul telefono dopo il deploy): serie fatta → striscia sopra la barra; tap giudizio → auto-chiusura ~1.2s; superset a due tracce; stato GO con striscia aperta; ✕ timer → striscia a filo schermo; entrambi i temi.

- [ ] **Step 5: suite verde + commit**

Run: `npm test` — Expected: 332 pass, 0 fail.

```powershell
git add sw.js
git commit -m @'
chore(sw): bump cache per rollout fix stack giudizio/timer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```
