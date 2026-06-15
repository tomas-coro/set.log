<div align="center">

```
        ┌─────────────────────────┐
        │  set.log                │
        │  > system ready_        │
        └─────────────────────────┘
```

# set·log

**Registro di allenamento minimal, offline-first.**
Carica la scheda, logga le serie, guarda i progressi salire.

[**▸ Apri l'app**](https://tomas-coro.github.io/set.log/) · [Funzioni](#funzioni) · [Stack](#stack-tecnico) · [Roadmap](#roadmap)

`PWA installabile` · `Offline-first` · `Vanilla JS — zero framework` · `Supabase`

</div>

---

## Cos'è

**set.log** è una web app (PWA) per tracciare gli allenamenti in palestra: scegli la scheda,
logghi carico / ripetizioni / RPE serie per serie, e l'app costruisce nel tempo il tuo storico —
calendario, volumi e curve di progressione. Estetica **da terminale**: monospazio, essenziale,
due temi commutabili (**Carta** chiaro · **Graphite** scuro).

È pensata per essere usata *davvero* dove serve: in palestra, spesso **senza segnale**. Per questo
funziona offline e si installa sul telefono come un'app vera.

> Si **installa** in un tap dal browser e gira a tutto schermo, come un'app nativa.

---

## Funzioni

```
▸ Schede multiple        più piani, ognuno con le sue giornate (es. Push / Pull / Gambe)
▸ Focus allenamento      log serie (carico · reps · RPE), timer di recupero, wake-lock schermo
▸ Calendario             heatmap mensile dei volumi + grafici di progressione per esercizio
▸ Database esercizi      catalogo personale, ricerca, gruppi muscolari
▸ Scan anatomia          heatmap del corpo: quali muscoli stai allenando (e quanto)
▸ Superset & circuiti    serie abbinate a 2–3 tracce per il lavoro a circuito
▸ Offline-first          tutto in locale, sync al rientro: in palestra non ti molla
▸ Multi-utente           account email + password, dati privati e isolati (RLS)
```

---

## Stack tecnico

| Area        | Scelta |
|-------------|--------|
| Front-end   | **Vanilla JS** (ES Modules), nessun framework — leggero e leggibile |
| Backend     | **Supabase** (Postgres + Auth), free tier; isolamento dati via Row Level Security |
| Offline     | **Service Worker**; client Supabase **vendorizzato** in locale (esbuild) → niente CDN |
| Test        | `node --test` (unit) + **Playwright** (smoke E2E: boot online & offline) |
| Hosting     | **GitHub Pages** (sito statico, zero server da gestire) |

Niente build step per il front-end: si serve così com'è. Una sola lingua (JS), facile da capire e modificare.

---

## Roadmap

```
[x]  v1.0   multi-utente · schede · focus · calendario · scan · offline
[ ]  demo   prova senza registrazione, con dati d'esempio          (in arrivo)
[ ]  store  app nativa iOS / Android via Capacitor                 (presto su App Store)
```

---

## Sviluppo locale

```bash
git clone https://github.com/tomas-coro/set.log.git
cd set.log

npm test                          # test unit
npx playwright install chromium   # una-tantum: browser per gli E2E
npm run e2e                        # smoke test E2E (boot online + offline)

node scripts/static-server.cjs    # server statico su :8766
# oppure:  python -m http.server 8765
# poi apri http://localhost:8766  (o :8765)
```

Le chiavi in `supabase-client.js` (URL + anon key) sono **pubbliche per design**: il vero gate è
la Row Level Security lato database. Per uno sviluppo isolato, crea un tuo progetto Supabase ed
esegui lo schema descritto in `docs/superpowers/specs/2026-05-28-multi-user-supabase-design.md`.

---

## Architettura

Spec completo e piano d'implementazione del backend multi-utente:
- `docs/superpowers/specs/2026-05-28-multi-user-supabase-design.md`
- `docs/superpowers/plans/2026-05-28-multi-user-supabase.md`

---

<div align="center">

Fatto da **Tomas Coronato** · [github.com/tomas-coro](https://github.com/tomas-coro)

<sub>set.log — perché ogni serie conta.</sub>

</div>
