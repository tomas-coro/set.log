# Controllo sessione + icona graphite — Design

**Data:** 2026-06-10
**Blocco:** A (di un batch di 4 — vedi "Contesto" sotto)
**Stato:** approvato dall'utente via mockup (in attesa di review dello spec scritto)

## Contesto

Batch di richieste UX su set.log. Le 9 richieste originali sono state raggruppate in 4 blocchi; l'utente ha scelto di partire dal **blocco A — Controllo sessione**, a cui si è aggiunta una richiesta sull'**icona graphite**.

Fuori da questo spec (blocchi successivi, già concordati ma non qui):
- **B** — popup (banner update + toast record) riposizionati; commento serie a scomparsa.
- **C** — volume *pianificato* per gruppo muscolare dalla scheda (focus petto vs dorso).
- **D** — edit esercizio al volo dall'overlay durante l'allenamento.
- **#1 (escluso, vincolo tecnico):** timer live nelle notifiche iOS a app chiusa — **non realizzabile da PWA** (serve ActivityKit/Live Activities native; iOS sospende il JS in background). Documentato e accantonato.
- **#9 (iOS):** curato trasversalmente; in questo spec rientra solo ciò che tocca il blocco A (safe-area della timer bar) + l'icona.

Decisioni di design prese sui mockup (`mockups/sessione-controllo-rev1.html`, `mockups/icona-graphite-rev1.html`):
- Avvio: **variante A** (controllo integrato nello slot cronometro).
- Tempo totale in esercizio: **variante A** (nella status bar dell'overlay).
- Recupero: **ripristinabile** (la ✕ collassa in una chip "riprendi", non distrugge).
- Icona: **variante A** (Graphite solido).

## Obiettivo

1. **Avvio esplicito** dell'allenamento con un tasto dedicato (non più solo implicito al primo recupero), con **pausa** e **annulla**.
2. **Tempo totale** della sessione visibile **dentro l'overlay esercizio**, senza uscire.
3. **Recupero ripristinabile**: chiudere il timer di recupero per sbaglio non lo deve distruggere.
4. **Icona graphite** (solido) al posto della "carta" attuale, coerente con la home scura/vetro di iOS.

Non-obiettivi: nessuna modifica alla logica di log/superset; nessun backend; nessuna notifica push.

---

## Stato attuale (ancore nel codice)

- **Mappa cronometro** `gymsched_session` (solo locale), key `${week}-${day}`, forma attuale `{ start: ISO, end: ISO|null }`:
  - `app.js:1388-1411` — `SESSION_KEY`, `getSessionMap`, `setSessionMap`, `sessClockKey`, `startSessionIfAbsent`, `endSessionClock`, `fmtDuration`, `cancelSessionClock`.
  - `app.js:1413-1437` — `renderSessClock()` (riga `#sessClock` con ✕ annulla).
  - `timer.js:105-111` — `withoutSession(map, key)`.
- **Avvio implicito:** `app.js:1568` — `startRest()` chiama `startSessionIfAbsent()` (→ il cronometro parte al primo recupero).
- **Fine cronometro:** `app.js:3057-3059` — `render()` chiama `endSessionClock()` quando il giorno è completo.
- **Tick 1s:** `app.js:3771` — `setInterval(renderSessClock, 1000)`.
- **DOM cronometro home:** `index.html:110` — `<div id="sessClock" class="sessclock hidden">` (tra `.week-row` e `#progBar`).
- **Timer di recupero (RestTimer):** `timer.js:17-90` — `start/pause/resume/stop/addSeconds/sync`, stato `paused` + `pausedRemaining`.
- **Timer bar DOM:** `index.html:472-490` — `#timerBar` con due sotto-stati `#timerRun` (label + `#tStop ✕`; tempo + `#tMinus/#tToggle/#tPlus`) e `#timerGo`.
- **Wiring timer bar:** `app.js:3260-3272` — `tMinus/tPlus/tStop/tToggle`. `tStop` oggi: `timer.stop(); hideFeelAsk(); dismissTimerGo()` → **distrugge**.
- **Overlay esercizio:** `index.html:206-221` — `.sbar` con `#focusSbarCtx` / `#focusSbarCount`; `renderFocusOverlay()` a `app.js:3004-3032` imposta `#focusSbarCount = "ex NN/total · W"`.
- **Icona:** `icon.svg` (palette carta), `icon-180.png`; `manifest.json` (`theme_color`/`background_color` `#ece3d0`, icons = solo `icon.svg`); `index.html:6,10` (`theme-color #ece3d0`, `apple-touch-icon icon-180.png`); `index.html:5` viewport **senza** `viewport-fit=cover`.

---

## Design

### A1 — Avvio / pausa / annulla (slot cronometro)

**Forma dati estesa** in `gymsched_session[key]`:

```
{ start: ISO|null, end: ISO|null, pausedAt: ISO|null, pausedMs: number }
```

Backward-compatible: le voci vecchie `{start,end}` si leggono con `pausedAt=null`, `pausedMs=0` via un normalizzatore (`normalizeSessionEntry`). Tempo trascorso:

```
elapsedMs(c, now) = (c.end ? Date.parse(c.end) : now)
                    - Date.parse(c.start)
                    - (c.pausedMs || 0)
                    - (c.pausedAt ? now - Date.parse(c.pausedAt) : 0)
```

**Macchina a stati** (derivata dalla voce, niente flag separati):

| Stato | Condizione | UI nello slot `#sessClock` |
|---|---|---|
| PRONTO | nessuna voce o `!start` | bottone largo **▶ Avvia allenamento** |
| IN CORSO | `start && !pausedAt && !end` | `● allenamento in corso · MM:SS` + **⏸** + **✕ annulla** |
| IN PAUSA | `start && pausedAt && !end` | `⏸ in pausa · MM:SS` (congelato) + **▶** + **✕ annulla** |
| FINITO | `end` | `⏱ allenamento MM:SS` (congelato), classe `ended` (come oggi) |

Azioni:
- **Avvia** → `startSession()`: scrive `{ start: now, end:null, pausedAt:null, pausedMs:0 }`.
- **⏸ pausa** → `pauseSession()`: se in corso, `pausedAt = now`.
- **▶ riprendi** → `resumeSession()`: `pausedMs += now - pausedAt; pausedAt = null`.
- **✕ annulla** → conferma + `cancelSessionClock()` (già esistente; i log restano).

**Rete di sicurezza:** `startRest()` continua a chiamare `startSessionIfAbsent()` (avvio automatico al primo recupero se non avviato). `startSessionIfAbsent` resta no-op se `start` già presente, e inizializza i nuovi campi.

**Visibilità:** lo slot è visibile in PRONTO/IN CORSO/IN PAUSA/FINITO ogni volta che esiste una scheda non vuota (oggi `#sessClock` è `hidden` finché non c'è voce → cambia: in PRONTO mostra il bottone Avvia). Resta nascosto solo con piano vuoto (empty-state).

**Refactor:** `renderSessClock()` → `renderSessionControl()` che costruisce lo stato giusto; `fmtDuration` invariato; il pulsante ✕ riusa la logica `cancelSessionClock` esistente. Pausa/annulla **non** sono nell'overlay (coerente col mockup A approvato): per metterli si torna a home con `←`. La timer bar di *recupero* è un'altra cosa (A3).

### A2 — Tempo totale nella status bar dell'overlay

`renderFocusOverlay()` imposta `#focusSbarCount`. Nuovo contenuto quando la sessione è avviata (start presente):

```
⏱ {elapsed} · ex NN/NN        // es. "⏱ 14:12 · ex 02/07"  (il tag settimana è rimosso)
```

Se la sessione **non** è avviata: solo `ex NN/NN` (nessun ⏱).
Se FINITO: `⏱` con il totale congelato.

**Aggiornamento 1s:** il `setInterval(... ,1000)` attuale (`app.js:3771`) diventa `tickSessionDisplays()` che aggiorna **sia** lo slot home (`renderSessionControl`) **sia**, se l'overlay è aperto (`openIndex !== null`), la sola parte tempo di `#focusSbarCount`. Evitare di ri-renderizzare tutto l'overlay ogni secondo: aggiornare solo il `textContent` del tempo (idealmente uno `<span id="focusSbarClock">` dedicato dentro `#focusSbarCount`).

### A3 — Recupero ripristinabile (✕ non distruttiva)

La timer bar (`#timerBar`) guadagna un **terzo sotto-stato** `#timerResume` (chip collassata), accanto a `#timerRun` e `#timerGo`.

Nuovo DOM in `index.html` dentro `#timerBar`:

```html
<div id="timerResume" class="t-resume hidden">
  <button id="resumeOpen" class="tr-open" type="button">
    <span class="tr-ic">▸</span> recupero in pausa · <span id="resumeTime">0:00</span>
    <span class="tr-go">riprendi ›</span>
  </button>
  <button id="resumeDiscard" class="tr-x" type="button" aria-label="Chiudi recupero">×</button>
</div>
```

Comportamento (rimpiazza l'handler `tStop`, `app.js:3262-3266`):
- **✕ su `#timerRun` (`tStop`)** → `collapseRest()`: `timer.pause()`; nascondi `#timerRun`; mostra `#timerResume` con `resumeTime = formatTime(timer.pausedRemaining)`; togli `scroll-lock`; **tieni** la timer bar visibile (slim) e il wakeLock attivo (sei ancora in recupero).
- **Tap `#resumeOpen`** → `expandRest()`: `timer.resume()`; mostra `#timerRun`; nascondi `#timerResume`; ri-aggiungi `scroll-lock` (come `startRest`).
- **Tap `#resumeDiscard` (×)** → chiusura vera: `timer.stop(); hideFeelAsk(); dismissTimerGo()` (il vecchio comportamento di `tStop`).

Note:
- `RestTimer.pause()/resume()` esistono già e sono robusti (basati su `pausedRemaining`): nessuna modifica a `timer.js`.
- Coerenza con `⏸` (`tToggle`): sia ⏸ sia ✕ lasciano `timer.paused=true`; ⏸ tiene la barra aperta col tempo, ✕ la collassa in chip. Riprendere da entrambi torna a IN CORSO. Se la barra è già in pausa via ⏸ e si preme ✕, collassa comunque.
- `#timerResume` è parte di `#timerBar` (fixed, globale): la chip è raggiungibile sia in home sia in overlay.

### A4 — Icona graphite (Graphite solido) + safe-area iOS

**Icona** (segno invariato: bilanciere + quadrato "log"; cambia solo la palette):
- Riscrivere `icon.svg`: fondo `radialGradient` `#222831 → #12151a`, segno `#f0a73c`, quadrato centrale `fill #12151a stroke #f0a73c`, dot interno `#f0a73c`. (Geometria identica all'attuale — vedi `mark()` in `mockups/icona-graphite-rev1.html`.)
- Rigenerare `icon-180.png` e **aggiungere** `icon-192.png`, `icon-512.png` dal nuovo SVG.
  - **Metodo di generazione (cross-platform):** rendering via Playwright — pagina HTML che disegna l'SVG a dimensione esatta, screenshot dell'elemento a 180/192/512 px. (Niente dipendenze native tipo sharp.)
- `manifest.json`: `theme_color` e `background_color` → graphite (`#131517`); `icons` → aggiungere i png (192/512 `purpose: "any maskable"`) oltre all'svg.
- `index.html`: `<meta name="theme-color">` → `#131517`; `apple-touch-icon` resta `icon-180.png` (ora graphite).

**Safe-area (tocca il blocco A):**
- `index.html:5` viewport → aggiungere `viewport-fit=cover`.
- La timer bar fissa (`#timerBar`) e, se serve, lo slot controllo, rispettano `env(safe-area-inset-bottom)` in `style.css` così non finiscono sotto la home-indicator su iPhone (incl. 17 Pro Max). Padding-bottom = `calc(<attuale> + env(safe-area-inset-bottom))`.

---

## Componenti / file toccati

| File | Modifica |
|---|---|
| `app.js` | forma dati sessione estesa + `normalizeSessionEntry`/`elapsedMs`; `startSession/pauseSession/resumeSession`; `renderSessClock`→`renderSessionControl` (4 stati); `tickSessionDisplays` (home + overlay); `renderFocusOverlay` (⏱ in `#focusSbarCount`); `collapseRest/expandRest` + rewire `tStop`/nuovi bottoni resume |
| `index.html` | slot `#sessClock` (markup minimo invariato, riempito da JS); `#timerResume` dentro `#timerBar`; viewport `viewport-fit=cover`; `theme-color` graphite |
| `style.css` | stati slot (pronto/in corso/in pausa), chip `#timerResume`, safe-area-inset-bottom su timer bar |
| `timer.js` | nessuna modifica logica (riuso `pause/resume`); eventuale helper se serve |
| `icon.svg` | riscritto graphite |
| `icon-180.png` / `icon-192.png` / `icon-512.png` | rigenerati graphite |
| `manifest.json` | theme/background graphite + icons png |
| `sw.js` | **bump `CACHE`** (v71 → v72) + aggiungere i nuovi png agli `ASSETS` |
| `tests/` | nuovi test puri (vedi sotto) |

## Test

Logica pura testabile in Node (come da convenzione del repo):
- `elapsedMs` / `normalizeSessionEntry`: corso, in pausa (congela), ripresa (somma `pausedMs`), finito; robustezza a voce legacy `{start,end}`; più cicli pausa/ripresa.
- Macchina a stati: derivazione PRONTO/IN CORSO/IN PAUSA/FINITO dalla voce.
- (Se estratte come funzioni pure) transizioni `collapse/expand` del recupero rispetto allo stato `paused` del RestTimer.

Verifica manuale (Playwright + browser, con cache SW svuotata): avvio→pausa→ripresa→annulla; tempo totale che scorre dentro l'overlay; ✕ recupero → chip → riprendi; ✕ chip → discard; icona graphite su home; timer bar sopra la home-indicator.

## Rischi / note

- **Invariante critica del repo:** ogni `save` deve passare da `dehydrate(data)` o i log spariscono al reload. Questo blocco tocca `gymsched_session` (localStorage separato, non `data`), quindi a basso rischio, ma le verifiche vanno fatte con login reale.
- **SW cache:** dimenticare il bump `CACHE` = codice stantio nel browser. Svuotare la cache SW prima di verificare.
- `maximum-scale=1.0, user-scalable=no` resta (scelta esistente); `viewport-fit=cover` è additivo.
- Niente re-introduzione di immagini esterne / notifiche push.
