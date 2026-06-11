# Fase 3 — Store update (scaffolding a flag spento)

- **Data:** 2026-06-11
- **Stato:** design approvato, pronto per il piano di implementazione
- **Topic:** banner di aggiornamento "platform-aware" + voce Impostazioni, predisposti per la futura pubblicazione su App Store / Play Store
- **Branch atteso:** `feat/store-update-scaffolding`

## 1. Contesto e obiettivo

Oggi l'app è una PWA su GitHub Pages: gli aggiornamenti arrivano via Service Worker e
l'utente vede il toast "Nuova versione disponibile › aggiorna" (implementato in fase 2,
`app.js` ~3923). Un domani l'app sarà incartata (Capacitor) e pubblicata sugli store; in
quello scenario l'update non passa più dal SW ma dallo store.

Obiettivo della fase 3: **costruire adesso tutta l'infrastruttura** del banner store +
voce Impostazioni, ma **dietro un flag spento** (`STORE_UPDATE_ENABLED = false`), così che:

- **finché il flag è OFF** (oggi e fino alla pubblicazione) il comportamento è **identico
  a oggi**: SW invariato, nessun fetch di rete aggiuntivo, nessun banner store;
- **quando il flag verrà acceso** (alla pubblicazione) l'app saprà già rilevare una
  versione più nuova in store e mostrare il banner, senza altri interventi strutturali.

Non-obiettivo di questa fase: il wrapping Capacitor vero, gli account sviluppatore, gli
ID/URL reali degli store. Quelli arrivano alla pubblicazione; ora si lasciano **segnaposto**.

## 2. Decisioni di design (validate con mockup interattivi)

| # | Decisione | Scelta |
|---|-----------|--------|
| 1 | Dove appare il banner opzionale | **Toast in basso** — riusa il componente `.update-toast` esistente |
| 2 | Aggiornamento obbligatorio / versione minima | **Nessuno.** Un solo banner per ogni update; niente concetto di "minima", niente schermata di blocco. Chiudibile, dismiss di sessione |
| 3 | Riga `app` in Impostazioni | **Tag inline** — `v1.0.0 · ↑ v1.1.0` |
| 4 | Testo del banner | **Minimale** — `Aggiorna · v1.1.0` + freccia; il tap apre lo store giusto via `getPlatform()`, il nome dello store non è nel testo |

Principio trasversale: **a flag OFF nulla di tutto questo è attivo.**

## 3. Architettura

Un nuovo modulo puro `release.js` (stesso pattern di `theme.js` / `catalog.js`: ESM,
funzioni pure, dipendenze iniettate per testabilità), importato da `app.js`. Tutta la
logica decidibile senza DOM/rete sta in funzioni pure unit-testate; l'integrazione col
DOM e il `fetch` reale restano sottili wrapper in `app.js`.

### 3.1 Modulo `release.js`

Costanti:

```js
export const APP_VERSION = "1.0.0";              // versione corrente dell'app
export const STORE_UPDATE_ENABLED = false;        // il flag — OFF fino alla pubblicazione
export const VERSION_MANIFEST_URL = "./version.json";
export const STORE = {
  ios:     { appId: "PLACEHOLDER_IOS_ID",  url: "https://apps.apple.com/app/idPLACEHOLDER_IOS_ID" },
  android: { pkg:   "it.placeholder.setlog", url: "https://play.google.com/store/apps/details?id=it.placeholder.setlog" },
};
```

Funzioni pure (firme con dipendenze iniettabili e default reali):

```js
// 'ios' | 'android' | 'web' — Capacitor ha priorità, poi UA, fallback 'web'
export function getPlatform(nav = (typeof navigator !== "undefined" ? navigator : {}),
                            cap = (typeof globalThis !== "undefined" ? globalThis.Capacitor : undefined)) { ... }

// confronto semver "x.y.z": true se remote > current; input malformati → false (non infastidire)
export function isNewer(remote, current) { ... }

// url dello store per la piattaforma; 'web' → null (resta sul SW)
export function pickStore(platform, store = STORE) { ... }

// best-effort: ritorna {updateAvailable, latest, storeUrl} oppure null; qualsiasi errore → null
export async function checkStoreUpdate({
  fetchFn = fetch,
  manifestUrl = VERSION_MANIFEST_URL,
  currentVersion = APP_VERSION,
  platform = getPlatform(),
} = {}) { ... }
```

Regole:

- **`getPlatform`**: se `cap?.getPlatform` esiste → ne usa il valore (`'ios'`/`'android'`/`'web'`);
  altrimenti UA: `/iPhone|iPad|iPod/i` → `ios`, `/Android/i` → `android`, altrimenti `web`.
- **`isNewer`**: split su `.`, `parseInt` di major/minor/patch (mancanti = 0); eventuale
  suffisso pre-release (`-beta`) viene troncato; confronto numerico in ordine. NaN/formato
  invalido su uno dei due → `false`.
- **`pickStore`**: `ios`→`store.ios.url`, `android`→`store.android.url`, `web`→`null`.
- **`checkStoreUpdate`**: se `platform === 'web'` → `null` (sul web l'update resta il SW);
  altrimenti `fetchFn(manifestUrl, { cache: "no-store" })` → JSON `{latest}`; se
  `isNewer(latest, currentVersion)` → `{updateAvailable:true, latest, storeUrl: pickStore(platform)}`,
  altrimenti `null`. Try/catch totale: rete giù / JSON rotto / store url nullo → `null`
  (mai un banner spurio).

> **Nota sul flag.** `STORE_UPDATE_ENABLED` è una costante *build-time*: la build PWA/web
> pubblicata su GitHub Pages la tiene **OFF**, la futura build nativa (Capacitor) la accende.
> La combinazione "piattaforma `web` + flag ON" quindi non si verifica nella pratica; se
> capitasse, `checkStoreUpdate` torna comunque `null` e l'update resta sul SW — gestita senza
> rompere nulla.

### 3.2 Manifest `version.json`

Servito dalla stessa origin (GitHub Pages), bumpato a mano a ogni release pubblicata:

```json
{ "latest": "1.0.0" }
```

Nessun campo `min` (decisione 2A). Unico scopo: dire qual è l'ultima versione in store.

### 3.3 Integrazione in `app.js`

- **Import**: `import { APP_VERSION, STORE_UPDATE_ENABLED, checkStoreUpdate, getPlatform, pickStore } from "./release.js";`
- **Avvio controllo store** — dopo la registrazione del SW (vicino a `app.js` ~3973),
  dentro una guardia `if (STORE_UPDATE_ENABLED)`:
  - al `load` e su `visibilitychange` (visibile), chiama `checkStoreUpdate()`;
  - se ritorna `{updateAvailable}` → `showStoreUpdateBanner(latest, storeUrl)`.
  - **A flag OFF questo blocco non viene mai eseguito** → nessun fetch, comportamento di oggi.
- **`showStoreUpdateBanner(latest, storeUrl)`** — gemello di `showUpdateBanner`, riusa la
  classe `.update-toast`. Contenuto minimale (decisione 4): pallino `.ut-dot`, testo
  `Aggiorna · v{latest}` (la versione in colore accento), bottone freccia `›` che apre
  `storeUrl` (`window.open(storeUrl, "_blank", "noopener")`), `✕` con dismiss di sessione
  (flag `storeUpdateDismissed`, gemello di `updateDismissed`). Idempotente (un solo banner).
- **Riga Impostazioni `app`** — una funzione `renderAppLine()` popola lo `span.v` della
  riga `app` in base allo stato:
  - **flag OFF**: `v{APP_VERSION}` + il bottone "🔄 aggiorna" attuale (force-update SW) — invariato;
  - **flag ON, update disponibile**: `v{APP_VERSION}` + tag `↑ v{latest}` (tap → `storeUrl`);
  - **flag ON, aggiornata**: `v{APP_VERSION}` (eventuale `✓` attenuato).

### 3.4 `index.html`

La riga `app` (≈134) oggi contiene solo `#btnForceUpdate`. Si aggiunge uno `span` per la
versione e un contenitore per il tag dinamico, popolati da `renderAppLine()`. Il bottone
"🔄 aggiorna" resta (force-update SW), nascosto/sostituito solo quando il flag è ON.

### 3.5 `sw.js`

Bump cache `gymsched-v74` → `v75`. Aggiungere `./release.js` a `ASSETS` (è codice
dell'app, serve offline). **`version.json` NON va precacheato**: il fetch handler del SW è
cache-first e cacheerebbe ogni GET same-origin, servendo un manifest stantio e scavalcando
il `cache:"no-store"` lato app. Quindi `version.json` resta **network-only** — escluso da
`ASSETS` e con un bypass nel fetch handler (`if (pathname.endsWith("/version.json")) return;`)
che lo lascia passare diretto alla rete senza intercettarlo né cacheario.

### 3.6 `style.css`

Riuso massimo di `.sv-tag`, `.update-toast`, `.ut-*` esistenti. Eventuale micro-classe per
la versione attenuata nella riga Impostazioni (`color:var(--dim)`); nessun nuovo componente.

## 4. Flusso

```
load / visibilitychange (visibile)
        │
   STORE_UPDATE_ENABLED ? ──no──> (niente: SW gestisce gli update come oggi)
        │ sì
   checkStoreUpdate()
        │
   platform === 'web' ? ──sì──> null (resta sul SW)
        │ no
   fetch version.json → {latest}
        │
   isNewer(latest, APP_VERSION) ? ──no──> null
        │ sì
   showStoreUpdateBanner(latest, pickStore(platform))
   renderAppLine() → tag "↑ v{latest}"
```

## 5. File toccati

| File | Tipo | Cosa |
|------|------|------|
| `release.js` | **nuovo** | costanti + helper puri (`getPlatform`, `isNewer`, `pickStore`, `checkStoreUpdate`) |
| `version.json` | **nuovo** | `{ "latest": "1.0.0" }` |
| `tests/release.test.js` | **nuovo** | unit `node:test` per gli helper puri |
| `app.js` | mod | import, init `checkStoreUpdate` sotto flag, `showStoreUpdateBanner`, `renderAppLine` |
| `index.html` | mod | riga `app`: span versione + contenitore tag |
| `sw.js` | mod | cache v75 + `release.js`/`version.json` in `ASSETS` |
| `style.css` | mod (min) | micro-classe versione attenuata, se serve |

## 6. Testing

Nuovo `tests/release.test.js` (`node --test`, ESM, nomi in italiano come la suite esistente).
Solo logica pura — niente `fetch` reale, niente DOM:

- **`isNewer`**: `1.1.0 > 1.0.0` → true; uguale → false; `1.0.0 > 1.1.0` → false; differenza
  solo di patch (`1.0.1 > 1.0.0`); campi mancanti (`1.1` vs `1.1.0`); suffisso pre-release
  troncato; input malformato → false.
- **`getPlatform`**: Capacitor presente (`{getPlatform:()=>'ios'}`) vince sull'UA; UA iPhone
  → `ios`; UA Android → `android`; UA desktop → `web`; navigator vuoto → `web`.
- **`pickStore`**: `ios`/`android` → url giusto; `web` → null; store custom iniettato.
- **`checkStoreUpdate`** con `fetchFn` mock: latest più nuovo → `{updateAvailable:true,…}`;
  uguale/minore → null; `platform:'web'` → null senza chiamare fetch; `fetchFn` che rigetta
  → null; JSON malformato → null.

Atteso: la suite resta verde e cresce di ~12-15 test (da 416).

## 7. Non-goals (YAGNI — semplificazioni dalla decisione 2A)

- nessun overlay di blocco a tutto schermo;
- nessun campo `min` / versione minima nel manifest;
- nessun "force update" guidato dalla versione minima;
- nessun wrapping Capacitor, account store, ID/URL reali (segnaposto fino alla pubblicazione);
- nessuna icona nuova: l'app/store userà la graphite scura attuale, il favicon adattivo della
  fase 2 non si tocca.

## 8. Rischi e note

- **Flag OFF deve essere davvero inerte**: il blocco `checkStoreUpdate` va racchiuso in
  `if (STORE_UPDATE_ENABLED)` *prima* di qualsiasi `fetch` o timer, così a OFF non c'è nessun
  effetto osservabile (zero richieste, zero banner). È l'invariante da verificare per prima.
- **`checkStoreUpdate` non deve mai produrre falsi positivi**: ogni errore → `null`. Meglio
  non mostrare il banner che mostrarne uno sbagliato.
- **`version.json` su GitHub Pages può essere servito stale** (cache HTTP): in fase ON il
  fetch userà `cache: "no-store"` per evitarlo (stessa logica del SW in fase 2).
- **`web` resta sul SW**: con flag ON ma piattaforma `web`, `checkStoreUpdate` torna `null` e
  l'update continua a passare dal toast SW esistente — i due canali non si pestano i piedi.
