# Batch "Sessione UX" — design

**Data:** 2026-06-05 · **Stato:** approvato a voce + mockup browser (sessione brainstorm `42786-1780647213`)

Dieci richieste utente sull'esperienza d'allenamento, raggruppate in un unico batch.
Tutte le scelte estetiche sono state validate con mockup interattivi nel browser
(`.superpowers/brainstorm/42786-1780647213/content/`: `focus-media.html`,
`scan-empty.html`, `go-dismiss.html`, `set-comments.html`, `editor-toggles.html`).

## Scoperte in esplorazione (cambiano la lista)

- I **commenti per-serie esistono già** (dialog "commenti veloci", `openQcDialog`,
  chip preset + testo libero, `set.comments[]` nel modello). Limite reale: si
  aggiungono solo alla serie corrente; su una serie già `done` il bottone sparisce
  (`onComment = null` se `allDone`).
- La **rinomina giornate esiste già** (`renameDay`, editor.js:65) → serve solo
  contenuto, non codice.
- Il **volume ×2 manubri esiste già** ma scatta solo su `/manubr/i` nel nome
  (`isDumbbell`, session.js:288) → "Affondo bulgaro" conta ×1.

## 1. Modello dati: campi `vol2` e `plates` per esercizio

Nuovi campi opzionali sugli esercizi del piano, pattern `unit`/`unitB`:

| Campo | Traccia | Significato | Default se assente (derivazione) |
|---|---|---|---|
| `vol2` | normale/A | volume = reps × kg × 2 | `isDumbbell(nome traccia)` (regex attuale) |
| `vol2B` | B (superset) | idem traccia B | idem |
| `plates` | normale/A | mostra riga "per lato: …" | `bar` impostato **oppure** nome matcha `/bilancier|stacco|squat|\bez\b/i` |
| `platesB` | B (superset) | idem traccia B | idem |

- `volumeMeta(ex, track)` legge prima l'override (`vol2`/`vol2B` boolean), poi cade
  sulla derivazione. Stessa struttura per una nuova `platesMeta(ex, track)` (o
  equivalente) usata da `buildEditBlock`.
- La riga "per lato" oggi appare sempre: dopo il fix appare **solo** se il flag
  (esplicito o derivato) è true. La lat machine smette di mostrarla; lo "Stacco
  rumeno" la mostra via derivazione, e in ogni caso si corregge dall'editor.
- **Invariante critica:** i 4 campi entrano in `dehydrate()` (e sopravvivono a
  hydrate/reconcile), con test di roundtrip dedicato — altrimenti spariscono al
  reload. Nessun bump di schema: campi opzionali, assente = derivazione.

### Editor (mockup `editor-toggles.html`, variante B approvata)

Nel form esercizio, sotto i campi esistenti, riga **«opzioni carico»** con due
chip-toggle stile terminale: `VOL ×2` e `DISCHI/LATO` (ambra = attivo). Si
precompilano con la derivazione quando si scrive/cambia il nome (solo finché
l'utente non le ha toccate a mano in quel form); al salvataggio il valore va
sempre scritto esplicito. Per i superset: una coppia di chip per traccia.

## 2. Focus esercizio in allenamento (mockup `focus-media.html`, variante A)

- **Immagini wger sempre visibili** in testa alla card focus: 2 frame affiancati
  (partenza/arrivo), `loading="lazy"`, pannello nascosto se `mediaFor()` è null o
  l'immagine non carica (hotlink, `onerror`). Aggancio per nome alla voce di
  catalogo (stesso link-per-nome di `catalogUsage`); vale l'override `img` per-voce.
- **Chip `REC <recText>`** sempre in vista nella riga chip del focus (oggi il
  recupero è solo nel cassetto).
- **Chip `VOL ×2`** mostrata quando il fattore effettivo è 2.
- **Popolamento `media-map.js`:** aggiungere gli esercizi della scheda utente +
  seed catalogo, SOLO voci verificate con HEAD 200 su entrambi i frame (regola del
  file). Esercizi senza corrispondenza wger restano senza pannello (fallback già
  previsto).

## 3. Timer

- **Fix overlap (bug):** con la barra timer visibile (`body.timer-on`) il
  contenitore scrollabile prende `padding-bottom` ≥ altezza barra + safe-area,
  così l'ultimo esercizio/il prossimo esercizio non finisce sotto la barra fissa.
- **GO auto-dismiss (mockup `go-dismiss.html`, variante B):** lo stato GO
  ("vai → ./slug --serie N") si chiude da solo dopo **8 s di schermo visibile**
  (il conteggio si ferma con `document.hidden`, riparte al rientro: tornando dal
  blocco schermo lo si vede comunque). Indicatore: **linea ambra sottile** sotto
  il testo che si scarica linearmente in 8 s (CSS transition/animation pilotata
  da JS per rispettare la pausa da `visibilitychange`). Il tap chiude subito,
  come oggi.
- **Scroll-lock:** mentre il countdown del recupero corre, lo scroll di pagina è
  bloccato (classe CSS su `body`, `overflow:hidden` sul contenitore). ⏸ pausa
  → sbloccato; scadenza (stato GO) o stop → sbloccato.

## 4. Commenti su serie già fatte (mockup `set-comments.html`, variante B)

Ogni serie `done` mostra a destra una **💬 fantasma** (attenuata se senza
commenti, accesa con testo se presenti — il rendering del testo esiste già).
Il tap-target è **solo la 💬** (con area di tocco generosa, ≥40px): un eventuale
comportamento già esistente del tap sul resto della riga (es. modifica serie)
resta invariato. Tap sulla 💬 → `openQcDialog` con i commenti di **quella**
serie, salvataggio immediato via `withSet`/`withSupersetSet` + `persist`.
Vale anche per le tracce dei superset.

## 5. Scan: empty-state boot-log (mockup `scan-empty.html`, variante B)

Nuova funzione pura in `body.js` (testabile in Node):
`scanBootLog(tab, info)` → stringa HTML. Quando il tab non ha dati:

- figura attenuata (opacity ~0.3) dietro/accanto;
- blocco boot-log stile terminale: `$ scan --week W23` / `▸ 0 serie loggate —
  figura in standby` / come funziona (serie → muscolo si accende; ambra = volume
  settimana, reset lunedì; blu = lavoro secondario; per Freschezza: acceso =
  allenato da poco, tratteggio rosso = mai allenato);
- mini legenda (pallini primario/secondario/mai).

Trigger: tab Settimana con `contribs.length === 0`; tab Freschezza con nessun
gruppo con storico (tutti `never`). Appena c'è un dato, layout normale attuale.

## 6. Nomi giornate (contenuto, niente codice)

Proposta (in base alla Scheda 2 v5): **A «Petto + Spinta»**, **B «Gambe +
Dorso»**, **C «Spalle + Braccia»** (eventualmente «Spalle + Braccia/Polsi»).
Si applicano dall'editor con la rinomina esistente — passaggio manuale
dell'utente o ritocco in fase di verifica, fuori dal piano TDD.

## 7. Test e trasversali

- TDD per ogni logica pura: override/derivazione `vol2`-`plates` (`volumeMeta`,
  nuova derivazione plates), roundtrip `dehydrate` dei 4 campi, `scanBootLog`,
  slug/format invariati. La meccanica timer GO (8 s visibili, pausa su hidden)
  va isolata in una utility pura testabile (es. in `timer.js`).
- Bump cache SW → **v66** (cambiano `app.js`, `body.js`, `editor.js`,
  `media-map.js`, `style.css`, `index.html`).
- Verifica finale nel browser reale (trucco verifica senza login) su mobile
  viewport prima del merge.

## Fuori scope

- Fix offline totale (import `esm.sh`) — prossimo lavoro a sé.
- Popolare la MAP wger oltre scheda+seed.
- Qualsiasi redesign del flusso sessione oltre i punti elencati.
