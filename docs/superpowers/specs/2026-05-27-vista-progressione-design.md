# Vista progressione — grafico carico nel tempo (per esercizio)

**Data:** 2026-05-27
**Stato:** design approvato, pronto per il piano

## Obiettivo

Mostrare la progressione di carico nel tempo di un singolo esercizio: un grafico a
linea del **top-set in kg per settimana**, aperto dal focus dell'esercizio. Valore,
non rischio — chiude il "prossimo passo naturale" rimasto dopo l'editor scheda.

## Decisioni (dal brainstorming)

| Tema | Scelta |
|------|--------|
| Punto d'accesso | Per-esercizio, dal focus overlay (icona 📈 nell'header) |
| Metrica (asse Y) | Top-set kg per settimana (esclude warmup e serie non riuscite) |
| Superset | Solo la traccia della sotto-tab A/B attiva |
| Asse X | Default ultime 3 settimane, con controllo per espandere a tutto lo storico |
| Stile grafico | Linea con punti + area sfumata, tema Amber (variante A approvata) |
| Rendering | SVG inline fatto a mano, nessuna dipendenza |

## Architettura

### Punto d'accesso
- Pulsante **📈** nell'header del focus (`focus-top` in `index.html`, a destra del
  nome esercizio). Tap → apre il grafico di **quell'esercizio** (`openIndex`).
- Superset: il grafico usa la traccia della sotto-tab attiva (`supersetTab`, `"a"`/`"b"`).
- Il grafico vive in un **`<dialog id="chartDialog">`** modale, stesso pattern dei
  dialog esistenti (`#setDialog`/`#exDialog`/`#qcDialog`, tutti `showModal()`).
  Chiusura: pulsante X / Escape / tap-fuori. Nessun nuovo stato di history.

### Dati — helper puri in `session.js` (testati in Node)

1. **`topSetSeries(data, day, exId, weekKey, track = null)`** → `[{week, kg}]`
   - Tutte le settimane con chiave valida e `≤ weekKey` che hanno un top-set numerico.
   - Ordine crescente per settimana.
   - `track`: `null` = esercizio normale (`normalizeEntry`); `"a"`/`"b"` = traccia del
     superset (`normalizeSupersetEntry`).
   - Per ogni settimana, `kg` = max kg sulle serie **non warmup e non failed** (stessa
     regola di `weekTopKg`, ma su una sola traccia).
   - Salta le settimane senza alcun kg numerico.

2. **`chartGeometry(series, opts)`** → geometria SVG pronta da disegnare
   - Input: `series` = `[{week, kg}]` ordinata; `opts` = `{width, height, padding}`.
   - Output: `{ points: [{x, y, week, kg}], polyline: "x,y x,y …", yTicks: [{value, y}], min, max }`.
   - Scala Y su **min/max dei dati con un margine** (NON parte da 0), così la variazione
     è leggibile anche con pochi kg di differenza. Se min === max, applica una banda
     artificiale per non dividere per zero.
   - Tutta la matematica di scala/coordinate vive qui (testabile); il rendering DOM no.

> Nota: `exerciseTrend` (riga trend esistente) resta com'è; in fase di piano si valuta
> se riscriverlo sopra `topSetSeries` per non duplicare la logica di top-set per settimana.

### Rendering — SVG inline in `app.js`
- `renderChart(series, view)` costruisce l'SVG (namespace SVG) a partire da
  `chartGeometry`: gridlines, area sfumata sotto la linea, polyline amber
  (`#E8A93C`), punti con label valore, ultimo punto evidenziato, label settimana
  sull'asse X. Stile della variante A approvata nel companion.
- **Stati limite:**
  - 0 settimane con dato → messaggio "Nessuno storico ancora".
  - 1 sola settimana → punto singolo + nota "serve più di una settimana per il trend"
    (nessuna linea tracciata).

### Interazione
- Controllo a due pill **"3 sett." / "tutto lo storico"**: di default attiva "3 sett."
  (slice delle ultime 3 dalla serie completa); tap su "tutto lo storico" ridisegna con
  l'intera serie. Stato locale del dialog, non persistito.
- Con molte settimane: label X **diradate** (mostra 1 ogni *k*) per evitare che si
  accavallino; la linea si adatta alla larghezza del viewBox.

## Test
- `node --test` (il gate del progetto):
  - `topSetSeries`: traccia normale, traccia `a`/`b`, salta settimane vuote, esclude
    warmup/failed, ordine crescente, filtro `≤ weekKey`.
  - `chartGeometry`: scala min/max con padding, caso 0 punti, 1 punto, molti punti,
    `min === max` (banda artificiale, no divisione per zero).
- Rendering/wiring DOM in `app.js`: non testato in Node, verificato in browser.

## Verifica browser (Playwright, porta pulita)
- 📈 nell'header del focus apre il dialog.
- Linea disegnata sui dati reali (es. Panca W22) con i valori corretti.
- Pill "tutto lo storico" espande l'asse X.
- Esercizio superset: il grafico segue la sotto-tab A/B attiva.
- 0 errori console.

## Cache
- `CACHE` in `sw.js` → **`gymsched-v21`**.

## Fuori scope (YAGNI)
- Schermata progressione globale / selettore esercizio (scelto: solo per-esercizio dal focus).
- Metriche 1RM stimato e volume (scelto: solo top-set kg).
- Due linee A+B per i superset (scelto: solo traccia attiva).
- Persistenza della preferenza 3-sett./tutto.
