# Quick win #1 (PR badge) + #2 (volume per muscolo) — Design

Data: 2026-05-27. Approvato dall'utente ("si procedi").

Due delle 6 migliorie del backlog, raggruppate in un'unica spec ("quick win in blocco").
Il #3 (prefill nuova settimana) è **annullato**: lo stepper già propone i pesi
dell'ultima volta (`prefillSets`, app.js:1249), quindi non c'è lavoro da fare.

## Obiettivo

1. **PR badge / record** — quando batti il massimo storico (PR) su un esercizio,
   evidenziarlo: badge live `🏆 record!` nell'overlay mentre logghi, e 🏆 persistente
   accanto al "best" in lista finché il record della settimana corrente regge.
2. **Volume per gruppo muscolare** — breakdown settimanale del volume per gruppo,
   espandibile dalla riga volume già esistente in fondo alla lista.

## A. Modello dati — campo `muscle`

- Ogni esercizio del piano acquista `muscle`: uno di **8 gruppi**
  `Petto · Dorso · Spalle · Bicipiti · Tricipiti · Gambe · Polpacci · Core`.
- Superset: traccia A usa `muscle`, traccia B usa `muscleB`.
- Muscolo assente/non assegnato → bucket **"Altro"** nel breakdown; editabile.

### Seed (`plan.js`)

Aggiungo `muscle` (e `muscleB` sui superset) al seed `PLAN`:

- **A** — Panca piana→Petto · Lento avanti manubri→Spalle · Croci ai cavi→Petto ·
  Dips→Petto · Pulldown→Dorso · Pushdown+Curl→Tricipiti/Bicipiti · Polpacci→Polpacci ·
  Crunch+Plank→Core/Core
- **B** — Stacco rumeno→Gambe · Rematore bilanciere→Dorso · Pullover→Dorso ·
  Affondi→Gambe · Spinte inclinata→Petto · Curl EZ+Skull→Bicipiti/Tricipiti ·
  Face pull→Spalle · Leg raise+Twist→Core/Core
- **C** — Lento bilanciere→Spalle · Alzate laterali→Spalle · Alzate posteriori→Spalle ·
  Spinte manubri→Petto · Rematore cavo→Dorso · Curl EZ+Skull→Bicipiti/Tricipiti ·
  Curl concentrato+Pushdown→Bicipiti/Tricipiti · Crunch inv+Plank lat→Core/Core

### Migrazione schema 2 → 3 (`editor.js`)

I dati esistenti (`data.json`) sono già schema 2 con un `plan` **senza** `muscle`.
Il seed serve solo a chi migra da schema 1 e al merge-conflitto, quindi NON
retroattivamente. Serve un backfill esplicito:

- Nuova funzione `backfillMuscles(data, seedPlan)`:
  - Guardia: se `data.schema >= 3` → no-op (idempotente). Non muta l'input.
  - Per ogni esercizio di `data.plan`, se `muscle` è assente, cerca nel seed un
    esercizio con stesso `(day, name)` e copia `muscle`/`muscleB`.
  - Esercizi non abbinati (rinominati/custom) restano senza `muscle` → "Altro".
  - Imposta `data.schema = 3`.
- Va invocata nel boot subito dopo `migrate(...)` (sia al load normale sia nel
  ramo merge-conflitto in `saveToCloud`), così come `migrate` è già invocata.
- Verificato: i nomi attuali in `data.json` combaciano 1:1 col seed → backfill completo.

Nota: `migrate` (schema 1→2) resta invariata. `backfillMuscles` è un secondo passo
indipendente con la sua guardia, così le due migrazioni non si intralciano.

## B. #1 PR badge / record

### Helper puri (`session.js`)

- `bestKgBefore(data, day, exId, weekKey, track=null)` — max kg working su tutte le
  settimane **diverse** da `weekKey` (esclude warmup/failed). `null` se nessuno.
  Permette di capire se la settimana corrente ha fatto un nuovo PR.
- `isWeekRecord(data, day, exId, weekKey, track=null)` — `true` se il top-set working
  di `weekKey` supera **strettamente** `bestKgBefore(...)`. Pareggio ≠ record.
  Per i superset il chiamante valuta A e B separatamente (OR a livello UI).
- `isSetRecord(prevBest, kg)` — micro-helper per il badge live: `kg` numerico e
  `prevBest === null || kg > prevBest`.

### Render

- **Live (overlay)**: quando una serie working viene confermata done con kg che batte
  il massimo *precedente a quella serie* (calcolato escludendo la serie stessa), mostro
  un badge transitorio `🏆 record!` accanto alla serie loggata nell'overlay. Sparisce
  al re-render successivo dell'esercizio (non persistito).
- **Lista (app.js:~1634)**: 🏆 accanto al valore "best" quando `isWeekRecord(currentWeek)`
  è `true`. Superset: 🏆 se A **o** B è record. Non sostituisce il "best", lo affianca.

## C. #2 volume per muscolo

### Helper puro (`session.js`)

- `volumeByMuscle(data, weekKey, dayPlan)` → `[{muscle, volume}]` ordinato per volume
  desc. Per ogni esercizio del giorno somma reps×kg delle serie done working:
  traccia normale/A → `muscle` (o "Altro"), traccia B → `muscleB` (o "Altro").
  Accumula in una mappa muscolo→volume, scarta i gruppi a 0. Riusa la logica di
  `trackVolume` (già in session.js).

### Display (`app.js`)

- La `volcard` (riga volume, `buildVolumeRow`) diventa **tappabile** (cursor/ruolo).
- Tap → espande un pannello sotto con una barra orizzontale per gruppo: label gruppo +
  `kg` + barra larga in proporzione al gruppo col volume massimo. Ri-tap richiude.
- Stato espanso in una variabile modulo (`volExpanded`, default `false`, non persistito).
- `renderVolRow` passa anche `volumeByMuscle(...)` a `buildVolumeRow`.

### Editor esercizio (`index.html` + `app.js`)

- `index.html` `#exDialog`: aggiungo `<select id="exMuscle">` (opzione vuota + 8 gruppi)
  con label "Gruppo muscolare", e `<select id="exMuscleB">` ("Gruppo traccia B"),
  quest'ultimo mostrato solo quando `#exSuperset` è spuntato (toggle su change).
- `openExDialog`: popola `exMuscle`/`exMuscleB` dall'esercizio; mostra/nasconde B in
  base a `superset`.
- `readExDialog`: legge `muscle` (sempre) e `muscleB` (solo se superset); stringa vuota
  → campo omesso dal patch.

## D. Test + rilascio

Nuovi test Node (`tests/`), nello stile dei file esistenti:

- `bestKgBefore`: esclude la settimana data, ignora warmup/failed, `null` se vuoto.
- `isWeekRecord`: record stretto = true; pareggio = false; nessuno storico = true se
  c'è un kg working; traccia superset A/B.
- `isSetRecord`: numerico vs `null`, `>` stretto.
- `volumeByMuscle`: normale, superset A/B su muscoli diversi, muscolo mancante → "Altro",
  ordinamento desc, esclusione warmup/failed/non-done.
- `backfillMuscles`: backfill per (day,name) dal seed; idempotenza (schema 3 → no-op);
  esercizio rinominato non abbinato resta senza muscle; input non mutato.

Rilascio:

- **Bump cache** `gymsched-v29` → `gymsched-v30` in `sw.js`.
- `npm test` verde, poi verifica browser con Playwright (editor: assegna muscolo;
  lista: 🏆 su una settimana-record; volcard: espandi e vedi il breakdown).
- Commit + push su `main`.

## Fuori scope

- #3 prefill settimana (annullato).
- #4 export/import, #5 riepilogo fine-sessione, #6 versione cache in ⚙ (lotto medio,
  sessione successiva).
- Confronto volume-per-muscolo vs settimana scorsa (solo settimana corrente per ora).
