# set.log

App per loggare gli allenamenti in palestra: serie, timer di recupero, storico, record e grafici. Single-file, offline-first, dati in `localStorage`. Nessun account, nessun server.

**Live:** https://tomas-coro.github.io/set.log/

## Caratteristiche
- Sessione guidata: serie/ripetizioni/RIR per esercizio, note, calcolo dischi.
- Timer di recupero ancorato a timestamp reale (regge lo schermo bloccato).
- Wake lock: schermo acceso durante la sessione (dove il browser lo supporta).
- Autocomplete esercizi da un catalogo seed (64 esercizi, 8 gruppi muscolari).
- Storico sessioni, record personali, grafici carico max / 1RM stimato.
- PWA installabile, funziona offline (service worker + manifest).

## Stack
HTML/CSS/JS statico in un unico `index.html`. Zero dipendenze, zero build.

## Sviluppo locale
Serve i file con un qualsiasi server statico (il service worker richiede http, non `file://`):

```sh
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Deploy
GitHub Pages dal branch `main`, root. HTTPS obbligatorio (serve al wake lock e al service worker).
