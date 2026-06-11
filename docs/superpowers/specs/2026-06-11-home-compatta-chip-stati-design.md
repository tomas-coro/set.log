# Home compatta + chip sessione "accesa/spenta" — Design

**Data:** 2026-06-11
**Contesto:** Rifinitura UI post-rilascio del blocco A (controllo sessione, commit `6eb9d6c`). Verifica su iPhone reale → due problemi di look-and-feel, nessun problema di logica.

## Problema

1. **Home troppo verticale.** I controlli stanno su 3 righe separate (`.day-tabs`, `.week-row`, slot Avvia) e il bottone "▶ Avvia allenamento" lascia molto vuoto a destra. Sensazione di spazio sprecato.
2. **Stati chip indistinguibili.** "● in corso · MM:SS" e "⏸ in pausa · MM:SS" hanno lo stesso bordo ambra e lo stesso testo: a colpo d'occhio sono identici.

Scelte di design validate via mockup interattivo (visual companion):
- Home → **opzione A** (riga unica controlli + Avvia a tutta larghezza).
- Chip → **opzione A** (acceso vs spento: in corso ambra+pallino pulsante, in pausa grigio spento).

## Non-obiettivi (YAGNI)

- Nessuna modifica alla logica del cronometro: `normalizeSessionEntry` / `elapsedMs` / `sessionState` (timer.js) restano identiche.
- Nessuna modifica al comportamento di avvio/pausa/ripresa/annulla, né al recupero ripristinabile.
- Nessun cambio al formato dati `gymsched_session`.
- Niente nuovo schema, niente migrazione.

---

## Intervento 1 — Home compatta (layout A)

### DOM (`index.html`)
Oggi (righe ~99-110):
```
<div class="day-tabs" id="dayTabs"> A B C </div>
<div class="week-row"> <select id="weekSelect"> <button id="newWeekBtn" class="btn-soft">+ Sett.</button> </div>
<div id="sessClock" class="sessclock hidden"></div>
```
Diventa una **riga di controllo unica** `.ctl-row` che racchiude tab giorni + settimana + aggiungi, seguita dallo slot sessione invariato di posizione:
```html
<div class="ctl-row">
  <div class="day-tabs" id="dayTabs">
    <button data-day="A" class="on">A</button>
    <button data-day="B">B</button>
    <button data-day="C">C</button>
  </div>
  <select id="weekSelect" aria-label="Settimana"></select>
  <button id="newWeekBtn" class="btn-add" aria-label="Aggiungi settimana">+</button>
</div>
<div id="sessClock" class="sessclock hidden" aria-label="Durata allenamento"></div>
```
- `#newWeekBtn`: testo da `+ Sett.` → **`+`**, con `aria-label="Aggiungi settimana"`. Handler/funzione `newWeek` invariati.
- `#weekSelect`: resta il `<select>` nativo, etichette invariate (`renderWeekSelect` non si tocca). Su un dispositivo da ~390px la riga `[A][B][C] [2026-W24 ▾] [+]` misura ~270px e ci sta; il select ha `min-width:0` per troncare in caso di label custom lunghe.

### CSS (`style.css`)
- Nuova `.ctl-row{display:flex;gap:7px;align-items:stretch;margin-top:12px;}`
  - `.ctl-row .day-tabs{flex:1 1 auto;margin-top:0;}` (i 3 tab restano flex uguali tra loro)
  - `.ctl-row #weekSelect{flex:0 1 auto;min-width:0;margin-top:0;}`
  - `.ctl-row #newWeekBtn{flex:0 0 auto;}`
- `.btn-add`: bottone compatto ambra (azione "aggiungi") — riusa lo stile di `.btn-soft` (bordo `--line`, testo `--acc`) ma quadrato (`width:~42px`, `+` centrato, `font-size:18px`, `min-height` allineato ai tab).
- **Avvia a tutta larghezza** solo nello stato PRONTO: `.sessclock.ready{display:block;width:100%;}` e `.sc-start{width:100%;}`. La chip in corso/pausa/finito resta `inline-flex` allineata a sinistra (nessun cambio).
- Le vecchie regole `.week-row` diventano inerti (il contenitore non esiste più); si possono lasciare o ripulire — ripulire è preferibile per non lasciare CSS morto.

---

## Intervento 2 — Chip "accesa vs spenta" (chip A)

### Stati visivi
- **IN_CORSO:** colori attuali (testo/bordo ambra) + **pallino `.sc-dot` che pulsa** (animazione CSS). Prefisso testuale: `in corso · MM:SS` (il "●" non è più un carattere ma un elemento animabile).
- **IN_PAUSA:** chip **completamente grigia/spenta** — `color:var(--dim)`, `border-color:var(--line)`, nessun ambra, **nessun pallino**, icona `⏸` statica. Testo: `in pausa · MM:SS`.
- **FINITO:** invariato (`.ended`, grigio, congelato), testo `⏱ allenamento MM:SS`.

### `app.js` — `renderSessionControl`
La funzione già costruisce lo slot per stato. Modifiche:
1. Sostituire le classi di stato sullo slot: oltre a `ready`/`ended`, aggiungere `running` (IN_CORSO) e `paused` (IN_PAUSA) via `classList.toggle`.
2. Per IN_CORSO/IN_PAUSA costruire l'indicatore come elemento:
   - IN_CORSO → `<span class="sc-dot"></span>` (pulsante) + testo `in corso · ` + tempo.
   - IN_PAUSA → `<span class="sc-ico">⏸</span>` + testo `in pausa · ` + tempo.
   - Il tempo resta nello `<span id="sessClockText">` (id finora morto → ora usato dal tick).
3. Toggle/✕ invariati (ereditano il colore: ambra in corso, `--dim` in pausa).

### CSS (`style.css`)
```css
.sessclock.paused{color:var(--dim);border-color:var(--line);}
.sc-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);
  display:inline-block;margin-right:7px;flex:0 0 auto;animation:scpulse 1.3s ease-in-out infinite;}
.sc-ico{margin-right:6px;}
@keyframes scpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.3;transform:scale(.7);}}
@media (prefers-reduced-motion:reduce){.sc-dot{animation:none;}}
```

### Tick fluido (fix del rebuild ogni secondo)
**Problema:** oggi `tickSessionDisplays` chiama `renderSessionControl()` (rebuild completo dello slot) **ogni secondo** → l'animazione del pallino si resetterebbe ogni tick (pulse rotto) e si ri-attaccano i listener inutilmente.

**Soluzione:** guardia di stato.
- `renderSessionControl()` scrive lo stato corrente in `#sessClock` come `dataset.state` (es. `"IN_CORSO"`).
- `tickSessionDisplays()`:
  - calcola lo stato corrente; se **diverso** da `#sessClock.dataset.state` → `renderSessionControl()` (rebuild completo, raro: solo ai cambi di stato).
  - se **uguale** → aggiorna **solo il testo del tempo**: `#sessClockText` (home) e, se overlay aperto, `#focusSbarClock`.
- Il pallino non viene più ricreato a ogni tick → animazione fluida; meno lavoro DOM.

**Centralizzazione (chiude le rifiniture note):** estrarre un helper `clockText(entry, now)` per l'espressione `"⏱ " + fmtDuration(elapsedMs(entry, now)/1000) + " · "` oggi duplicata in `renderFocusOverlay` e `tickSessionDisplays`; usarlo in entrambi.

---

## Testing

- **Logica pura invariata** → la suite Node esistente (416 test) deve restare verde. È la rete di sicurezza primaria: conferma che `timer.js` e gli import non si sono rotti.
- Se `clockText`/label diventa una funzione abbastanza pura da testare senza DOM, aggiungere 1-2 test mirati; altrimenti basta la suite verde (app.js è l'entry DOM, non sotto test unitario).
- **SW:** bump `CACHE` (v72 → v73) perché cambiano `app.js`/`style.css`/`index.html` serviti dalla cache.
- **Verifica manuale (browser, cache SW svuotata):** Avvia → in corso ambra+pallino pulsa → ⏸ → chip grigia spenta, tempo congelato → ▶ riprende (ambra) → overlay mostra ⏱ che scorre fluido → home compatta su una riga, Avvia a tutta larghezza, `+` funziona.
- **Verifica device iPhone:** layout su una riga senza overflow, pallino che pulsa, distinzione corso/pausa netta, safe-area invariata.

## File toccati

| File | Cosa |
|---|---|
| `index.html` | `.ctl-row` (merge day-tabs + week-row), `#newWeekBtn` → `+` |
| `style.css` | `.ctl-row`, `.btn-add`, `.sc-start` full-width su `.ready`, `.sessclock.paused`, `.sc-dot`+keyframes, cleanup `.week-row` |
| `app.js` | `renderSessionControl` (classi stato + pallino elemento + `dataset.state`), `tickSessionDisplays` (guardia stato, update solo tempo), helper `clockText` |
| `sw.js` | bump `CACHE` v72 → v73 |
