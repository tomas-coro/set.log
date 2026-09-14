SET.LOG — GARMIN SYNC MVP V2.3.0

OBIETTIVO
Telefono/web = sorgente scheda e storico.
Garmin = workout live.
Ponte = Supabase REST via Garmin Connect Mobile.

PAIRING TOKEN GIÀ GENERATO
ttkt0BIQPRvyxNfETU_O9IaFuJ5Mm2Qeh7nMk3rCP-8

FILE GARMIN DA COPIARE IN garmin/source/
- WorkoutView.mc
- WorkoutDelegate.mc
- SyncService.mc
- SyncConfig.mc

CONFIG GARMIN
SyncConfig.mc è già configurato con Project URL e publishable key.
Non cambiare DEVICE_TOKEN.

MANIFEST
Aggiungi il permesso Communications come indicato in MANIFEST_PERMISSION.txt.

WEB
Copia SETLOG_GARMIN_SYNC_PAGE.html nella root del repo Set.Log rinominandolo:
sync.html

Poi:
git add sync.html
git commit -m "aggiunge ponte Garmin sync"
git push

Apri sul telefono:
https://tomas-coro.github.io/set.log/sync.html

SUPABASE
1. Crea progetto gratuito.
2. SQL Editor.
3. Incolla tutto SETLOG_GARMIN_SYNC_SUPABASE.sql ed esegui.
4. Project Settings/API: prendi Project URL e anon/publishable key.
5. URL e publishable key sono già inseriti in sync.html e SyncConfig.mc.

FLUSSO STASERA
1. Set.Log telefono: avvia la scheda che vuoi fare.
2. sync.html: "Invia sessione attiva a Garmin".
3. Apri Set.Log sul Garmin: scarica la sessione e parte dalla scheda reale.
4. Allenati sul Garmin.
5. A fine workout attendi "SYNC OK", poi FINE.
6. sync.html sul telefono: "Importa risultati Garmin".
7. Torna alla PWA Set.Log e premi il suo normale pulsante di fine allenamento.
   Storico/PR restano gestiti dalla web app originale.

COSA VIAGGIA TELEFONO -> GARMIN
- nome scheda/sessione
- esercizi
- serie
- reps min/max
- RIR
- recupero
- ultimi kg/reps disponibili

COSA TORNA GARMIN -> TELEFONO
- kg/reps di ogni set completato
- durata totale
- tempo recupero
- tempo allenato

LIMITI MVP
- serve connessione telefono + Garmin Connect Mobile per le chiamate REST;
- niente sync automatico in background;
- niente superset/serie miste in questo step;
- il risultato viene applicato alla sessione attiva e poi salvato con il normale
  flusso Set.Log, per non duplicare la logica dello storico.

CODICE ERRORE GARMIN
SYNC 900 = SyncConfig.mc non è stato configurato.
Altri numeri = codice HTTP/rete restituito dal web request.


V2.3.0B - PACCHETTO GARMIN COMPLETO
-----------------------------------
Questo ZIP include ora l'intero progetto Connect IQ necessario:
- garmin/manifest.xml
- garmin/monkey.jungle
- garmin/resources/strings/strings.xml
- garmin/resources/drawables/drawables.xml
- garmin/resources/drawables/launcher_icon.png
- garmin/source/SetLogApp.mc
- garmin/source/WorkoutStore.mc
- garmin/source/WorkoutView.mc
- garmin/source/WorkoutDelegate.mc
- garmin/source/SyncService.mc
- garmin/source/SyncConfig.mc

Target manifest: vivoactive5
Permission: Communications
Entry point: SetLogApp
App ID generato per questo pacchetto: ee4df0df7061433cbaa5aec212879b03

SOSTITUZIONE CONSIGLIATA
Sostituisci tutta la cartella garmin/ del progetto con quella contenuta qui.
sync.html resta nella root della web app.
