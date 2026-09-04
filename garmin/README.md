# set.log Garmin MVP

Prima base Connect IQ per **Garmin vívoactive 5**.

## Obiettivo MVP

Sul telefono/web app resta tutta la gestione della scheda.
Sul Garmin, durante l'allenamento:

- esercizio corrente;
- serie corrente/totale;
- target reps e RIR;
- ultima performance;
- kg modificabili di 2,5 kg;
- reps modificabili di 1;
- completa serie;
- timer recupero;
- prossimo esercizio.

Questa prima versione usa un workout demo locale. La sincronizzazione con Set.Log arriva nel passaggio successivo.

## Requisiti Mac

1. Installa Visual Studio Code.
2. Installa l'estensione ufficiale **Monkey C**.
3. Dall'estensione installa/configura il Connect IQ SDK.
4. Verifica con `Monkey C: Verify Installation`.
5. Apri la cartella `garmin` come progetto.
6. Seleziona **vívoactive 5** (`vivoactive5`) come target.
7. Avvia nel simulatore con Run/Debug.

Il device ID ufficiale del vívoactive 5 è `vivoactive5` e il display è 390×390 touch.

## Interazione demo

- Tap a sinistra/destra della riga KG: -/+ 2,5 kg
- Tap a sinistra/destra della riga reps: -/+ 1 rep
- Tap in basso: completa serie
- Durante il recupero: tap in basso per saltare il timer
- Tasto ENTER: completa serie

## Prossimi step

1. compilazione nel simulatore;
2. correzione eventuali incompatibilità SDK;
3. modello dati condiviso Set.Log ↔ Garmin;
4. salvataggio sessione locale sull'orologio;
5. sync workout dal telefono e risultati verso Set.Log;
6. superset reali e vibrazione fine recupero.
