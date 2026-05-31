# V2 — Piano 3a · Restyle schermate a "pattern noto"

Data: 2026-05-31
Stato: design approvato nei mockup del Visual Companion, in attesa di review dello spec scritto.

## 1. Contesto e obiettivo

Il **Piano 2** ha fissato il design system "Amber CRT" (palette, monospace, chrome da
terminale) e l'ha applicato all'app-shell e alla **Home** come pilota. Le altre
schermate ereditano i *colori* ma non il *layout*: vanno rifatte una a una (Piano 3).

Decisione di metodo (brainstorming 2026-05-31): il Piano 3 è diviso in **due
sotto-piani**, con approccio **ibrido**:

- **Piano 3a** (questo spec) — schermate che **ricalcano pattern già decisi**
  (Home/Esercizio): applicazione diretta del design system, verifica visiva dopo.
- **Piano 3b** (spec separato) — schermate con **layout nuovo** (Timer, Progressione,
  Editor, Calendario): mockup-first prima dell'implementazione.

Obiettivo di 3a: portare **focus/logging, righe Home, Nutrizione, i dialog e le
Impostazioni** all'estetica Amber CRT, **senza cambiare il comportamento funzionale**
(salvo le due piccole aggiunte Home descritte sotto). Lavoro **CSS-heavy**: nessun
nuovo modulo logico, nessuna modifica a `store/sync/auth/supabase`.

Tutti i look qui descritti sono stati **approvati nei mockup** del Visual Companion
(`.superpowers/brainstorm/.../content/03-esercizio.html`, `04-resto-3a.html`).

## 2. Scope

| # | Vista | Contenitore | Cosa cambia |
|---|---|---|---|
| 1 | **Esercizio / logging** + **Sessione guidata** | `#focusOverlay` | restyle completo: status bar `◈ LOG · DAY x`, box target con `// ultima volta`, serie come righe (`s1 ✓`), serie attiva con stepper kg/rip (+ totale `×2`), chip *feel*, CTA `› registra serie`, footer `$`. La sessione guidata **è lo stesso overlay** (vedi §4): il render focus già include l'anteprima `→ prossimo`. |
| 2 | **Righe Home** | `#list` (`renderList`) | aggiunta **sparkline** SVG per esercizio (dato da `exerciseTrend`) + bottone esplicito **`› log`** nel piede della riga. Sono i due dettagli **rimandati** da Piano 2. |
| 3 | **Nutrizione** | `#nutritionOverlay` / `renderNutritionGuide` | accordion CRT: sezioni a box, pasto-chiave `★` evidenziato, footer `# guida statica`. |
| 4 | **Dialog** | `#qcDialog`, `#setDialog`, `#exDialog` | form/popup CRT: header con `$`, label `# campo`, input su `--field`, CTA `✓`. Markup invariato, solo CSS. |
| 5 | **Impostazioni** | `#settingsDialog` | da *card + switch* a **righe terminale `# chiave : valore`** raggruppate per sezione (`account / attrezzatura / interfaccia / manutenzione`), toggle resi come `[ on ]`/`[ off ]`. |

**Fuori da 3a (→ Piano 3b):** `#chartDialog` (Progressione), `#planOverlay`
(Editor scheda), `#calendarOverlay` (Calendario), Timer recupero (`#timerBar`).
Questi ereditano già i colori del tema ma il loro layout è nuovo.

## 3. Design system di riferimento

Nessun nuovo token. Si riusano le custom property già definite in `style.css:1-21`
(Piano 2): `--bg --surf --surf2 --line --ink --tx --dim --faint --acc --acc-ink
--ac2 --ok --down --field --ctb --ctc --mono --glow1`.

Firma visiva (già stabilita in §3 dello spec V2, ribadita qui per le viste 3a):
- **status bar** `◈ <contesto>` a sinistra, contatori a destra; footer `$ ...`.
- **box** bordato `--line`, radius 7-8px, sfondo `--surf`.
- **CTA** `--ctb`/bordo `--ctc`/testo `--acc`, prefisso `›`/`✓`.
- **stepper** kg/rip: bottoni quadrati `−`/`+` bordo `--ctc`, valore centrale su `--field`.
- **chip** *feel*: stato attivo sfondo `--ctb`.
- **sparkline** SVG: tratto `--ac2`, punto finale `--acc`; tratto `--ctc` se nessun dato.
- motivi testuali: `$`/`>` prompt, `#` meta/chiavi, `//` note, `★` PR/chiave, `▓░` barre.

Gli **effetti CRT** (glow/scanline) restano gestiti da `fx.js` (Piano 2): le nuove
viste non devono introdurre `text-shadow` sparsi ma, se servono accenti glow,
agganciarsi alle regole `body.fx-glow ...` esistenti.

## 4. Note per schermata

### 4.1 Focus / logging + Sessione guidata (`#focusOverlay`)
- L'overlay è renderizzato da `renderFocusOverlay()` (app.js:1995) → `renderFocusNormal`
  (1521) o `renderFocusSuperset` (1804). Il piede già mostra `nextExercisePreview`
  (1959): **non è una schermata separata**, la "sessione guidata" è questo stesso
  overlay percorso esercizio per esercizio.
- Restyle **prevalentemente CSS** sulle classi esistenti `.focus-ov .focus-top
  .focus-back .focus-id .fn .fs .focus-body .focus-foot` + le classi interne prodotte
  dai due renderer (target, righe serie, stepper, feel, CTA). **Verificare i nomi
  classe reali** prodotti da `renderFocusNormal/Superset` durante l'implementazione e
  re-skinnarli verso il mockup `03-esercizio.html`.
- Aggiunta **status bar** in cima al body focus (`◈ LOG · DAY x` + `ex N/T · Wxx`) e
  **footer** `$ recupero … · tot/vol` — coerenti col mockup. Possono essere markup
  statico in `index.html` (dentro `#focusOverlay`) popolato dai renderer, oppure
  generati dai renderer: scegliere in fase di piano la via a minor churn.
- Comportamento (logging serie, timer, feel, superset, manubri ×2/EZ) **invariato**.

### 4.2 Righe Home — sparkline + `› log` (`renderList`, app.js:1884)
- Per ogni riga esercizio, nel piede aggiungere:
  - **sparkline** SVG da `exerciseTrend(data, currentDay, exId, currentWeekKey, n, superset)`
    (session.js:352) — polilinea dei top-set; punto finale evidenziato. Se la serie
    storica è vuota, tratto attenuato `--ctc` senza punto.
  - bottone **`› log`** che apre il focus dell'esercizio (riusa l'handler di apertura
    focus già collegato alla riga). Stato "fatto" → `✓ fatto` attenuato.
- Solo `renderList` + CSS (`.item .ex-foot`, `.spark`, `.logbtn`). Nessun dato nuovo
  persistito; `exerciseTrend` è già esportato e usato altrove.

### 4.3 Nutrizione (`#nutritionOverlay`, `renderNutritionGuide` in nutrition.js)
- Il renderer crea sezioni accordion (apri/chiudi via classe `open`). Restyle **CSS**
  delle classi prodotte da `renderSection` (verificarne i nomi: head, body, meal,
  pasto `key`). Pasto-chiave (`key:true`, es. ★ Spuntino) evidenziato come box `--ctb`.
- Header overlay esistente (`.focus-top` con `.fn` "Alimentazione") mantenuto;
  opzionale status bar `◈ NUTRI` + footer `# guida statica · nessun dato salvato`
  (testo già presente come `foot` in nutrition.js:76).
- Nessuna modifica ai contenuti/logica della guida.

### 4.4 Dialog (`#qcDialog`, `#setDialog`, `#exDialog`)
- **Solo CSS**, markup invariato. Re-skin delle classi esistenti `.set-dialog
  .qc-dialog .modal-h .t .x .editlabel .ex-inp .confirm .acts .danger .failtoggle`
  verso il mockup `04-resto-3a.html`: header con prefisso `$`, label come `# campo`
  uppercase `--ac2`, input su `--field`, CTA `✓` su `--ctb`/bordo `--acc`.
- Verificare contrasto/leggibilità di `<select>` e checkbox col tema scuro.

### 4.5 Impostazioni (`#settingsDialog`)
- Oggi: `settings-v2-host` con `.sv-card` + `.sv-toggle/.sv-switch` (rifatte in V1→V2,
  funzionanti, già ricolorate dal tema). **Decisione approvata:** convertirle in
  **righe terminale `# chiave : valore`** raggruppate per sezione
  (`account / attrezzatura / interfaccia / manutenzione`), con i toggle resi come
  `[ on ]`/`[ off ]` (verde `--ok` / attenuato `--dim`).
- Gli **id** dei controlli (`barInput`, `platesInput`, `notifyToggle`, `fxGlowToggle`,
  `fxScanToggle`, `btnLogout`, `btnForceUpdate`, `qcList/qcInput/qcAdd`, recovery
  buttons) **vanno preservati**: il restyle cambia il markup contenitore, **non** gli
  id né gli handler in app.js. Il `<form method="dialog">` e i valori `save/cancel`
  del footer restano.
- Lo swipe-to-dismiss e la X di chiusura (introdotti in v37) restano funzionanti.

## 5. Modifiche al codice (mappa, non esaustiva)

- `style.css` — **grosso del lavoro**: blocchi di restyle (in coda, come Piano 2) per
  focus/logging, righe Home (sparkline/logbtn), nutrizione accordion, dialog, e il
  nuovo blocco Impostazioni terminale.
- `index.html` — status bar/footer dentro `#focusOverlay`; **rifacimento markup**
  della `sv-body` Impostazioni in righe `key:value` (preservando gli id); eventuale
  status bar `#nutritionOverlay`.
- `app.js` — `renderList` (sparkline SVG + bottone `› log`); renderer focus
  (`renderFocusNormal/Superset`) per popolare status bar/footer se generati via JS;
  eventuali ritocchi al wiring Impostazioni se il markup cambia struttura (gli id
  restano, quindi i `getElementById` non cambiano).
- `nutrition.js` — al massimo aggiunta di classi/markup per l'accordion CRT se il
  CSS da solo non basta; logica invariata.
- `store.js`/`sync.js`/`auth.js`/`supabase-client.js`/`session.js`/`timer.js` —
  **nessuna modifica**.
- `sw.js` — **bump cache** `gymsched-v44` → `gymsched-v45` (sw.js:5).
- `tests/` — i ritocchi sono DOM/CSS; mantenere verde la suite (255 test). Aggiungere
  un test leggero che `renderList` con sparkline/logbtn non lanci e renda il bottone
  atteso (se `renderList` è testabile in isolamento; altrimenti verifica visiva).

## 6. Testing

- Suite esistente **verde** (atteso 255; annotare il numero reale).
- Nuovi check (dove fattibili come unit/DOM test):
  - `renderList` produce, per riga, il bottone `› log` e un `<svg>` sparkline; con
    storico vuoto usa il tratto attenuato senza punto finale.
  - apertura focus dal bottone `› log` equivalente al tap sulla riga (stesso handler).
  - Impostazioni: dopo il restyle, gli id chiave esistono ancora e i toggle riflettono
    lo stato (`notifyToggle`, `fxGlowToggle`, `fxScanToggle`).
- **Verifica visiva** sul device contro i mockup approvati (`03`, `04`), una schermata
  per commit. **E2E mobile** completo (logging, timer, sessione) resta a carico
  dell'utente.

## 7. Sequenza di build

1. **Focus / logging** (`#focusOverlay`) — restyle CSS + status bar/footer. Copre anche
   la sessione guidata. Verifica vs `03-esercizio.html`.
2. **Righe Home** — sparkline + `› log` in `renderList` + CSS. Verifica vs mockup Home.
3. **Nutrizione** — accordion CRT.
4. **Dialog** — qc/set/ex re-skin (solo CSS).
5. **Impostazioni** — markup `key:value` terminale (id preservati) + CSS.
6. **Bump cache SW v45** + suite verde + verifica console pulita.
7. **Commit per step**, poi `fetch`/`pull --ff-only`/`push` su `main`.

## 8. Fuori scope (esplicito)

- Piano 3b: Timer recupero, Progressione/grafico, Editor scheda (giorni dinamici),
  Calendario — layout nuovo, mockup-first, spec separato.
- Empty-state + giorni dinamici editor: già coperti dallo spec V2 §4.1/§5; l'Editor
  vero e proprio è 3b.
- Qualsiasi cambiamento funzionale al logging, al timer o ai dati.

## 9. Rischi noti

1. **Nomi classe interni dei renderer focus/nutrizione** non verificati riga-per-riga
   in questo spec: il piano d'implementazione deve ispezionarli prima di scrivere il
   CSS (rischio di selettori a vuoto). Mitigazione: primo step del piano = mappare le
   classi reali.
2. **Rifacimento markup Impostazioni**: rischio di scollegare un handler. Mitigazione:
   preservare tutti gli id e fare un test che li verifichi.
3. **Sparkline su molte righe**: SVG leggeri inline, nessun costo apprezzabile; ma
   `exerciseTrend` va chiamato per riga — verificare che non introduca lentezza su
   schede lunghe (è già usato altrove, rischio basso).
