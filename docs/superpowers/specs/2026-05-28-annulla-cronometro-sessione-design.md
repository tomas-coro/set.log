# Gym Schedule — Annulla cronometro sessione

**Data:** 2026-05-28
**Stato:** design approvato (brainstorming). Da qui → piano di implementazione.
**Origine:** segnalazione utente — "se inizio una sessione per sbaglio o per fare una prova,
scatta il timer ma non posso bloccarlo né annullarlo".

---

## 1. Problema

Il **cronometro sessione** (`app.js`, blocco "Cronometro sessione", ~righe 466-498) misura la durata
totale dell'allenamento per coppia `(settimana, giorno)`:

- parte **al primo recupero avviato del giorno** (`startSessionIfAbsent()`, chiamata in `startRest`);
- si ferma **solo quando il giorno è completo** (`endSessionClock()`, chiamata quando tutti gli
  esercizi risultano `isComplete`);
- è **solo locale**: vive in `localStorage` sotto `gymsched_session`, mappa con chiave
  `` `${currentWeek}-${currentDay}` `` e valore `{ start, end }` (ISO string, `end` null finché corre).

Il pill `#sessClock` mostra `⏱ in corso · MM:SS` mentre corre e `⏱ allenamento MM:SS` (attenuato,
classe `.ended`) quando è congelato.

**Difetto:** se l'utente tocca "Serie fatta" per sbaglio o per prova, il cronometro parte e **non
esiste alcun modo di fermarlo o annullarlo** finché non si completa l'intero giorno. Il pill non è
cliccabile.

## 2. Obiettivo

Dare un modo esplicito per **annullare il cronometro** del giorno corrente, **senza toccare nient'altro**:
le serie loggate, il volume e le note restano intatti (vivono in `data`, struttura separata da
`gymsched_session`).

## 3. Decisioni (chiuse il 2026-05-28)

1. **Affordance — ✕ dentro il pill.** Una piccola ✕ a destra del testo del cronometro. Esplicita e
   scopribile (il problema di partenza era proprio "non trovavo come fare"). Scartate: tap sull'intero
   pill (meno ovvio, più a rischio di tap accidentali); tap lungo (gesto nascosto, non scopribile).
2. **Conferma — sì, nativa.** Tap sulla ✕ → `confirm()` prima di cancellare, così un tocco sbagliato
   durante un allenamento vero non azzera il tempo. Coerente con lo stile del progetto, che già usa
   `confirm`/`prompt`/`alert` nativi.
3. **Ambito — solo il cronometro.** Cancella esclusivamente la voce `gymsched_session` del giorno
   corrente. **Nessuna** modifica a serie, volume, note. Esplicitamente richiesto dall'utente:
   "voglio solamente annullare il timer di allenamento, non altro".
4. **Stati — entrambi.** La ✕ è presente sia quando il cronometro corre (`in corso`) sia quando è
   congelato a giornata finita (`.ended`). Stesso comportamento: annulla e fa sparire il pill.
5. **Dopo l'annullo — ripartenza pulita.** Eliminata la voce, se l'utente avvia un nuovo recupero del
   giorno `startSessionIfAbsent()` ricrea un cronometro da zero. Nessuno stato residuo.

## 4. Modello dati

Nessun nuovo campo. Si agisce sulla mappa esistente `gymsched_session`:

```jsonc
{ "2026-W23-A": { "start": "2026-05-28T20:00:00.000Z", "end": null } }
```

Annullare = rimuovere la chiave `` `${currentWeek}-${currentDay}` `` dalla mappa.

## 5. Logica pura (testabile in Node)

Per restare in linea con la convenzione del progetto (logica pura coperta da `node --test`), la
rimozione passa per una funzione pura e immutabile:

- **`withoutSession(map, key)`** — ritorna una **nuova** mappa senza `key` (non muta l'input).
  Robusta a `map` nullo/non-oggetto (ritorna `{}` o copia senza la chiave). Vive accanto alle altre
  utility di sessione; esportata se serve al test.

`cancelSessionClock()` (impura, in `app.js`) la usa così:
`setSessionMap(withoutSession(getSessionMap(), sessClockKey())); renderSessClock();`

## 6. UI (`app.js` + `style.css`)

### 6.1 `app.js` — `renderSessClock()`
Oggi assegna `el.textContent = …`. Cambiarlo in costruzione di nodi:
- uno `<span class="sc-t">` con il testo attuale (`⏱ in corso · MM:SS` o `⏱ allenamento MM:SS`);
- un `<button type="button" class="sc-x" aria-label="Annulla cronometro">✕</button>`.
- Il pill si ridisegna ogni secondo (`setInterval(renderSessClock, 1000)`): ricostruire i due nodi a
  ogni tick è trascurabile. Usare `el.replaceChildren(textSpan, xBtn)` per evitare nodi orfani.
- Listener della ✕: `(e) => { e.stopPropagation(); if (confirm("Annullare il cronometro di questo
  allenamento? Le serie loggate restano salvate.")) cancelSessionClock(); }`.

### 6.2 `app.js` — `cancelSessionClock()`
Nuova funzione nel blocco "Cronometro sessione": rimuove la chiave corrente con `withoutSession` e
ridisegna (vedi §5).

### 6.3 `style.css` — `.sc-x`
Piccola ✕ a destra del testo dentro `.sessclock`: `margin-left` per staccarla dal testo, area di
tocco comoda (`min-width`/`padding` per ≈28px), colore tenue coerente col pill (`var(--acc)` quando
attivo, `var(--dim)` nello stato `.ended`), nessun bordo/sfondo (icona pulita). `cursor:pointer`.

## 7. Fuori scope

- Pulsante "pausa" del cronometro (no, solo annulla).
- Cancellazione di serie / volume / note (vivono in `data`, non toccati).
- Sincronizzazione cloud del cronometro (resta locale, com'è oggi).
- Annullo del **timer di recupero** (ha già i suoi controlli −15/⏸/+15/✕).

## 8. Testing

- **Logica pura:** test su `withoutSession` (rimozione immutabile, input nullo, chiave assente) con
  `node --test`. Gate del progetto verde.
- **UI (verifica manuale in browser reale):**
  1. avvia un recupero → compare il pill `⏱ in corso · …` con la ✕;
  2. tap ✕ → appare la conferma; **annulla la conferma** → il cronometro continua;
  3. tap ✕ → **conferma** → il pill sparisce e le serie loggate restano visibili/intatte;
  4. ri-tocca "Serie fatta" → il cronometro riparte da zero;
  5. ripeti su un cronometro **congelato** (`.ended`): la ✕ lo rimuove ugualmente.
