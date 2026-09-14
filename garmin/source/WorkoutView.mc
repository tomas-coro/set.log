using Toybox.Graphics as Gfx;
using Toybox.Attention as Attention;
using Toybox.Application.Storage as Storage;
using Toybox.Timer as Timer;
using Toybox.Time as Time;
using Toybox.WatchUi as Ui;
using Toybox.System as Sys;

class WorkoutView extends Ui.View {

    private var _workout;
    private var _exerciseIndex = 0;
    private var _setIndex = 0;

    private var _kg = 0.0;
    private var _reps = 0;

    private var _lastDoneKg = 0.0;
    private var _lastDoneReps = 0;
    private var _hasDoneSetThisExercise = false;

    private var _restRemaining = 0;
    private var _restClockActive = false;
    private var _restStartElapsedSec = 0;
    private var _setRestElapsedSec = 0;

    // Flow: ESERCIZIO -> REPS -> KG -> CONFERMA
    private const SCREEN_EXERCISE = 0;
    private const SCREEN_REPS = 1;
    private const SCREEN_WEIGHT = 2;
    private const SCREEN_CONFIRM = 3;
    private const SCREEN_WEIGHT_KEYPAD = 4;
    private const SCREEN_FINISHED = 5;
    private var _screen = 0;

    private var _kgDraft = "";
    private var _completedSets = 0;
    private var _finishElapsedSec = 0;
    private var _restElapsedSec = 0;
    private var _finishRestElapsedSec = 0;

    private var _timer;
    private var _elapsedSec = 0;
    private var _workoutStarted = false;
    private var _sessionRestored = false;

    // V2.3.0AD: riferimento assoluto per recuperare il tempo trascorso
    // mentre l'app e' nascosta/sospesa o viene riaperta.
    private var _lastWallClockSec = null;

    // V2.3.0: sync minimale web <-> Garmin via REST.
    private var _syncService;
    private var _syncReady = false;
    private var _syncRequested = false;
    private var _syncMessage = "SYNC...";
    private var _remoteSessionId = null;
    private var _results = [];
    private var _syncPushState = 0; // 0 idle, 1 sending, 2 ok, 3 error
    private var _syncPushCode = 0;

    function initialize() {
        View.initialize();

        _workout = new WorkoutStore().demoWorkout();
        _loadCurrentDefaults();

        _screen = SCREEN_EXERCISE;
        _timer = null;

        // V2.2.31: se esiste una sessione locale incompleta, la ripristina.
        _restoreSession();

        _syncService = new SyncService(self);

        // Una sessione ripristinata ha gia' i dati necessari per continuare.
        if (_sessionRestored) {
            _syncReady = true;
        }
    }

    function onShow() {
        // V2.3.0AD: riallinea timer totale e recupero al tempo reale
        // trascorso mentre la view non era attiva.
        _applyWallClockGap();

        // Se non c'e' una sessione locale, scarica la scheda inviata dal telefono.
        if (!_syncReady && !_syncRequested) {
            _syncRequested = true;
            _syncMessage = "SYNC...";
            _syncService.pullWorkout();
        }

        // La schermata finale resta congelata e non riavvia il timer.
        if (_screen == SCREEN_FINISHED) {
            _retryPendingResult();
            return;
        }

        if (!_workoutStarted) {
            _workoutStarted = true;

            if (!_sessionRestored) {
                _elapsedSec = 0;
            }
        }

        // Importante anche per un semplice hide/show dell'app.
        if (_timer == null) {
            _timer = new Timer.Timer();
            _timer.start(method(:_tick), 1000, true);
        }

        _sessionRestored = false;
        _saveSession();
    }

    function onHide() {
        _saveSession();

        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    function _saveSession() {
        // Sessione volutamente piccola: solo stato locale necessario a riprendere
        // esattamente il workout corrente. Nessun sync o storico remoto.
        Storage.setValue("sl_session_active", true);
        Storage.setValue("sl_exercise_index", _exerciseIndex);
        Storage.setValue("sl_set_index", _setIndex);
        Storage.setValue("sl_screen", _screen);

        Storage.setValue("sl_kg", _kg);
        Storage.setValue("sl_reps", _reps);
        Storage.setValue("sl_last_done_kg", _lastDoneKg);
        Storage.setValue("sl_last_done_reps", _lastDoneReps);
        Storage.setValue("sl_has_done_set", _hasDoneSetThisExercise);

        Storage.setValue("sl_rest_remaining", _restRemaining);
        Storage.setValue("sl_rest_clock_active", _restClockActive);
        Storage.setValue("sl_set_rest_elapsed", _setRestElapsedSec);
        Storage.setValue("sl_rest_elapsed", _restElapsedSec);

        Storage.setValue("sl_completed_sets", _completedSets);
        Storage.setValue("sl_elapsed_sec", _elapsedSec);
        Storage.setValue("sl_finish_elapsed", _finishElapsedSec);
        Storage.setValue("sl_finish_rest_elapsed", _finishRestElapsedSec);
        Storage.setValue("sl_kg_draft", _kgDraft);

        // Stato sync necessario per riprendere anche una scheda remota.
        Storage.setValue("sl_workout", _workout);
        Storage.setValue("sl_remote_session_id", _remoteSessionId);
        Storage.setValue("sl_results", _results);
        Storage.setValue("sl_sync_push_state", _syncPushState);

        _lastWallClockSec = Time.now().value();
        Storage.setValue("sl_wall_clock_sec", _lastWallClockSec);
    }

    function _restoreSession() {
        var active = Storage.getValue("sl_session_active");

        if (active != true) {
            return;
        }

        var value;

        value = Storage.getValue("sl_workout");
        if (value != null) {
            _workout = value;
        }

        value = Storage.getValue("sl_remote_session_id");
        if (value != null) {
            _remoteSessionId = value.toString();
        }

        value = Storage.getValue("sl_results");
        if (value != null) {
            _results = value;
        }

        value = Storage.getValue("sl_sync_push_state");
        if (value != null) {
            _syncPushState = value.toNumber();
        }

        value = Storage.getValue("sl_wall_clock_sec");
        if (value != null) {
            _lastWallClockSec = value.toNumber();
        }

        value = Storage.getValue("sl_exercise_index");
        if (value != null) {
            _exerciseIndex = value.toNumber();
        }

        // Protezione minima se la scheda demo cambia tra due build.
        if (_exerciseIndex < 0 || _exerciseIndex >= _workout["exercises"].size()) {
            _exerciseIndex = 0;
        }

        value = Storage.getValue("sl_set_index");
        if (value != null) {
            _setIndex = value.toNumber();
        }

        var ex = _exercise();
        if (_setIndex < 0 || _setIndex >= ex["sets"]) {
            _setIndex = 0;
        }

        value = Storage.getValue("sl_screen");
        if (value != null) {
            _screen = value.toNumber();
        }

        if (_screen < SCREEN_EXERCISE || _screen > SCREEN_FINISHED) {
            _screen = SCREEN_EXERCISE;
        }

        value = Storage.getValue("sl_kg");
        if (value != null) {
            _kg = value.toFloat();
        }

        value = Storage.getValue("sl_reps");
        if (value != null) {
            _reps = value.toNumber();
        }

        value = Storage.getValue("sl_last_done_kg");
        if (value != null) {
            _lastDoneKg = value.toFloat();
        }

        value = Storage.getValue("sl_last_done_reps");
        if (value != null) {
            _lastDoneReps = value.toNumber();
        }

        value = Storage.getValue("sl_has_done_set");
        if (value != null) {
            _hasDoneSetThisExercise = (value == true);
        }

        value = Storage.getValue("sl_rest_remaining");
        if (value != null) {
            _restRemaining = value.toNumber();
        }

        value = Storage.getValue("sl_rest_clock_active");
        if (value != null) {
            _restClockActive = (value == true);
        }

        value = Storage.getValue("sl_set_rest_elapsed");
        if (value != null) {
            _setRestElapsedSec = value.toNumber();
        }

        value = Storage.getValue("sl_rest_elapsed");
        if (value != null) {
            _restElapsedSec = value.toNumber();
        }

        value = Storage.getValue("sl_completed_sets");
        if (value != null) {
            _completedSets = value.toNumber();
        }

        value = Storage.getValue("sl_elapsed_sec");
        if (value != null) {
            _elapsedSec = value.toNumber();
        }

        value = Storage.getValue("sl_finish_elapsed");
        if (value != null) {
            _finishElapsedSec = value.toNumber();
        }

        value = Storage.getValue("sl_finish_rest_elapsed");
        if (value != null) {
            _finishRestElapsedSec = value.toNumber();
        }

        value = Storage.getValue("sl_kg_draft");
        if (value != null) {
            _kgDraft = value.toString();
        }

        // SCREEN_FINISHED non deve riavviare il cronometro.
        _workoutStarted = (_screen != SCREEN_FINISHED);
        _sessionRestored = true;
    }

    function _applyWallClockGap() {
        if (_lastWallClockSec == null) {
            _lastWallClockSec = Time.now().value();
            return;
        }

        var nowSec = Time.now().value();
        var gap = nowSec - _lastWallClockSec;

        // Protezione contro cambi manuali dell'orologio o valori anomali.
        if (gap <= 0 || gap > 43200) {
            _lastWallClockSec = nowSec;
            return;
        }

        // La schermata finale e una sessione non ancora iniziata restano congelate.
        if (_screen == SCREEN_FINISHED || !_workoutStarted) {
            _lastWallClockSec = nowSec;
            return;
        }

        _elapsedSec += gap;

        if (_restRemaining > 0 && _restClockActive) {
            var restGap = gap;
            if (restGap > _restRemaining) {
                restGap = _restRemaining;
            }

            _restElapsedSec += restGap;
            _setRestElapsedSec += restGap;
            _restRemaining -= restGap;

            if (_restRemaining <= 0) {
                _restRemaining = 0;
                _restClockActive = false;
                _setRestElapsedSec = 0;
                _screen = SCREEN_EXERCISE;
            }
        }

        _lastWallClockSec = nowSec;
    }

    function _clearSavedSession() {
        // Basta rimuovere il flag: i dati residui non vengono più ripristinati.
        Storage.deleteValue("sl_session_active");
    }

    function onRemoteWorkout(data) {
        if (data == null || data["exercises"] == null || data["sessionId"] == null) {
            _syncMessage = "NESSUNA SCHEDA";
            _syncRequested = false;
            Ui.requestUpdate();
            return;
        }

        _remoteSessionId = data["sessionId"].toString();
        _workout = {
            "name" => data["dayName"],
            "exercises" => data["exercises"]
        };

        _exerciseIndex = 0;
        _setIndex = 0;
        _screen = SCREEN_EXERCISE;
        _completedSets = 0;
        _elapsedSec = 0;
        _lastWallClockSec = Time.now().value();
        _restElapsedSec = 0;
        _setRestElapsedSec = 0;
        _results = [];
        _hasDoneSetThisExercise = false;
        _loadCurrentDefaults();

        _syncReady = true;
        _syncMessage = "SYNC OK";
        _saveSession();
        Ui.requestUpdate();
    }

    function onRemoteWorkoutError(code) {
        _syncMessage = "SYNC " + code.toString();
        _syncRequested = false;
        Ui.requestUpdate();
    }

    function _buildResultPayload() {
        return {
            "sessionId" => _remoteSessionId,
            "totalSec" => _finishElapsedSec,
            "restSec" => _finishRestElapsedSec,
            "trainedSec" => (_finishElapsedSec - _finishRestElapsedSec),
            "sets" => _results
        };
    }

    function _queueFinalSync() {
        if (_remoteSessionId == null) {
            return;
        }

        var payload = _buildResultPayload();
        Storage.setValue("sl_pending_sync_result", payload);
        _syncPushState = 1;
        _saveSession();
        _syncService.pushResult(payload);
    }

    function _retryPendingResult() {
        if (_syncService == null || _syncPushState == 1) {
            return;
        }

        var pending = Storage.getValue("sl_pending_sync_result");
        if (pending != null) {
            _syncPushState = 1;
            _syncService.pushResult(pending);
        }
    }

    function onResultPushed(code) {
        _syncPushCode = code;

        if (code >= 200 && code < 300) {
            _syncPushState = 2;
            Storage.deleteValue("sl_pending_sync_result");
        } else {
            _syncPushState = 3;
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function getScreen() {
        return _screen;
    }

    function isResting() {
        return _restRemaining > 0;
    }

    function _exercise() {
        return _workout["exercises"][_exerciseIndex];
    }

    // V2.3.0D: nomi esercizio ottimizzati per la safe area del vivoactive 5.
    // Il nome originale resta intatto nei dati/sync: qui cambia solo il rendering.
    function _hasPrefix(text, prefix) {
        if (text.length() < prefix.length()) {
            return false;
        }

        return text.substring(0, prefix.length()).equals(prefix);
    }

    function _exerciseNameLines(name) {
        var n = name.toString();

        // Match per prefisso invece che sulla stringa completa:
        // evita problemi con spazi, parentesi o simboli diversi ricevuti dal sync.
        if (_hasPrefix(n, "Panca inclinata")) { return ["Panca inclinata", "manubri 20-30°"]; }
        if (_hasPrefix(n, "Chest press convergente")) { return ["Chest press", "convergente"]; }
        if (_hasPrefix(n, "Chest press plate-loaded")) { return ["Chest press", "plate-loaded"]; }
        if (_hasPrefix(n, "Shoulder press macchina")) { return ["Shoulder press", "macchina"]; }
        if (_hasPrefix(n, "Shoulder press plate-loaded")) { return ["Shoulder press", "plate-loaded"]; }
        if (_hasPrefix(n, "Alzate laterali ai cavi")) { return ["Alzate laterali", "ai cavi"]; }
        if (_hasPrefix(n, "Pushdown ai cavi")) { return ["Pushdown cavo", "corda"]; }
        if (_hasPrefix(n, "Lat machine presa neutra")) { return ["Lat machine", "presa neutra"]; }
        if (_hasPrefix(n, "Lat machine presa media")) { return ["Lat machine", "media-larga"]; }
        if (_hasPrefix(n, "Rematore chest-supported")) { return ["Rematore", "chest-supported"]; }
        if (_hasPrefix(n, "Rematore unilaterale")) { return ["Rematore cavo", "unilaterale"]; }
        if (_hasPrefix(n, "Pullover machine")) { return ["Pullover machine", "straight-arm"]; }
        if (_hasPrefix(n, "Curl manubri su panca inclinata")) { return ["Curl inclinato", "manubri"]; }
        if (_hasPrefix(n, "Curl martello manubri")) { return ["Curl martello", "manubri"]; }
        if (_hasPrefix(n, "Estensioni tricipiti overhead")) { return ["Tricipiti overhead", "al cavo"]; }

        // V2.3.0X: fallback generico per nomi lunghi ricevuti dal sync.
        // Divide automaticamente su uno spazio vicino al centro, massimo 2 righe.
        if (n.length() > 19) {
            var middle = (n.length() / 2).toNumber();
            var bestSplit = -1;
            var bestDistance = 999;

            for (var i = 1; i < n.length() - 1; i += 1) {
                if (n.substring(i, i + 1).equals(" ")) {
                    var distance = i - middle;
                    if (distance < 0) {
                        distance = -distance;
                    }

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestSplit = i;
                    }
                }
            }

            if (bestSplit > 0) {
                return [
                    n.substring(0, bestSplit),
                    n.substring(bestSplit + 1, n.length())
                ];
            }
        }

        return [n];
    }

    function _loadCurrentDefaults() {
        var ex = _exercise();

        if (_hasDoneSetThisExercise) {
            _kg = _lastDoneKg;
            _reps = _lastDoneReps;
        } else {
            _kg = ex["lastKg"];
            _reps = ex["lastReps"];
        }
    }

    function openReps() {
        if (_restRemaining > 0) {
            return;
        }

        _screen = SCREEN_REPS;
        _saveSession();
        Ui.requestUpdate();
    }

    function openWeight() {
        if (_screen != SCREEN_REPS) {
            return;
        }

        // V2.2.22: il recupero parte quando confermo le REPS.
        // KG e riepilogo continuano a essere compilabili mentre il tempo corre.
        if (!_restClockActive) {
            _restClockActive = true;
            _restStartElapsedSec = _elapsedSec;
        }

        _screen = SCREEN_WEIGHT;
        _saveSession();
        Ui.requestUpdate();
    }

    function openConfirm() {
        if (_screen != SCREEN_WEIGHT) {
            return;
        }

        _screen = SCREEN_CONFIRM;
        _saveSession();
        Ui.requestUpdate();
    }

    function backStep() {
        if (_restRemaining > 0) {
            return;
        }

        if (_screen == SCREEN_REPS) {
            _screen = SCREEN_EXERCISE;
        } else if (_screen == SCREEN_WEIGHT) {
            // Tornando alle REPS il tempo torna ad essere allenato.
            _restClockActive = false;
            _screen = SCREEN_REPS;
        } else if (_screen == SCREEN_CONFIRM) {
            _screen = SCREEN_WEIGHT;
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function editFromConfirm() {
        if (_screen != SCREEN_CONFIRM) {
            return;
        }

        // Correggere le REPS = tempo allenato, non recupero.
        _restClockActive = false;
        _screen = SCREEN_REPS;
        _saveSession();
        Ui.requestUpdate();
    }

    function changeKg(delta) {
        if (_screen != SCREEN_WEIGHT || _restRemaining > 0) {
            return;
        }

        // V2.3.0N: i pulsanti peso lavorano sempre a step fissi di 2.5 kg.
        // Il tastierino manuale resta disponibile toccando il valore centrale.
        if (delta < 0) {
            _kg -= 2.5;
        } else if (delta > 0) {
            _kg += 2.5;
        }

        if (_kg < 0) {
            _kg = 0.0;
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function changeReps(delta) {
        if (_screen != SCREEN_REPS || _restRemaining > 0) {
            return;
        }

        _reps += delta;

        if (_reps < 0) {
            _reps = 0;
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function saveSet() {
        if (_screen != SCREEN_CONFIRM || _restRemaining > 0) {
            return;
        }

        _lastDoneKg = _kg;
        _lastDoneReps = _reps;
        _hasDoneSetThisExercise = true;
        _completedSets += 1;

        _results.add({
            "exerciseIndex" => _exerciseIndex,
            "setIndex" => _setIndex,
            "reps" => _reps,
            "kg" => _kg
        });

        var ex = _exercise();
        var finishedExercise = ((_setIndex + 1) >= ex["sets"]);

        // Recupero accumulato dalla pressione di VAI AI KG.
        // Se si torna alle REPS, il clock si ferma e riparte al nuovo VAI AI KG.
        var remaining = ex["restSec"] - _setRestElapsedSec;
        if (remaining < 0) {
            remaining = 0;
        }

        if (!finishedExercise) {
            _setIndex += 1;
            _kg = _lastDoneKg;
            _reps = _lastDoneReps;

            _screen = SCREEN_EXERCISE;
            _restRemaining = remaining;
            if (_restRemaining <= 0) {
                _restClockActive = false;
                _setRestElapsedSec = 0;
            }
            _saveSession();
            Ui.requestUpdate();
            return;
        }

        if ((_exerciseIndex + 1) < _workout["exercises"].size()) {
            _exerciseIndex += 1;
            _setIndex = 0;
            _hasDoneSetThisExercise = false;
            _loadCurrentDefaults();

            _screen = SCREEN_EXERCISE;
            _restRemaining = remaining;
            if (_restRemaining <= 0) {
                _restClockActive = false;
                _setRestElapsedSec = 0;
            }
            _saveSession();
            Ui.requestUpdate();
            return;
        }

        _restRemaining = 0;
        _restClockActive = false;
        _finishElapsedSec = _elapsedSec;
        _finishRestElapsedSec = _restElapsedSec;
        _screen = SCREEN_FINISHED;
        _workoutStarted = false;

        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }

        _saveSession();
        _queueFinalSync();
        Ui.requestUpdate();
    }

    function finishWorkout() {
        if (_screen != SCREEN_FINISHED) {
            return;
        }

        // Evita di chiudere mentre il risultato sta ancora partendo.
        if (_syncPushState == 1) {
            return;
        }

        _clearSavedSession();
        Sys.exit();
    }

    // Tenendo premuto ESC/back da qualunque schermata: chiede conferma
    // prima di buttare via l'allenamento in corso.
    function confirmCancelWorkout() {
        var msg = new Ui.Confirmation("Annullare\nl'allenamento?");
        Ui.pushView(msg, new CancelWorkoutDelegate(self), Ui.SLIDE_IMMEDIATE);
    }

    function cancelWorkout() {
        _clearSavedSession();

        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }

        Sys.exit();
    }

    function addRest15() {
        if (_restRemaining <= 0) {
            return;
        }

        _restRemaining += 15;
        _saveSession();
        Ui.requestUpdate();
    }

    function subtractRest15() {
        if (_restRemaining <= 0) {
            return;
        }

        _restRemaining -= 15;

        if (_restRemaining < 0) {
            _restRemaining = 0;
        }

        // Se porti manualmente il recupero a zero, passa subito alla serie successiva.
        if (_restRemaining == 0) {
            _restClockActive = false;
            _setRestElapsedSec = 0;
            _screen = SCREEN_EXERCISE;
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function skipRest() {
        if (_restRemaining <= 0) {
            return;
        }

        _restRemaining = 0;
        _restClockActive = false;
        _setRestElapsedSec = 0;
        _screen = SCREEN_EXERCISE;
        _saveSession();
        Ui.requestUpdate();
    }

    function _vibrateRestWarning() {
        // V2.2.25: un singolo richiamo quando mancano 10 secondi.
        if (Attention has :vibrate) {
            var pattern = [
                new Attention.VibeProfile(80, 120)
            ];

            Attention.vibrate(pattern);
        }
    }

    function _vibrateRestCountdown() {
        // V2.2.25: impulso breve per ciascun secondo 3 - 2 - 1.
        if (Attention has :vibrate) {
            var pattern = [
                new Attention.VibeProfile(100, 110)
            ];

            Attention.vibrate(pattern);
        }
    }

    function _vibrateRestGo() {
        // "VIA": impulso finale più marcato quando il recupero arriva a zero.
        if (Attention has :vibrate) {
            var pattern = [
                new Attention.VibeProfile(100, 260)
            ];

            Attention.vibrate(pattern);
        }
    }

    function _tick() as Void {
        if (_workoutStarted) {
            _elapsedSec += 1;

            if (_restClockActive) {
                _restElapsedSec += 1;
                _setRestElapsedSec += 1;
            }
        }

        if (_restRemaining > 0) {
            _restRemaining -= 1;

            // V2.2.25:
            // 10s -> singolo avviso
            // 3s / 2s / 1s -> tre impulsi separati, uno al secondo
            // 0s -> "VIA" con impulso finale più lungo
            if (_restRemaining == 10) {
                _vibrateRestWarning();
            } else if (_restRemaining == 3 || _restRemaining == 2 || _restRemaining == 1) {
                _vibrateRestCountdown();
            }

            if (_restRemaining <= 0) {
                _restRemaining = 0;
                _restClockActive = false;
                _setRestElapsedSec = 0;
                _vibrateRestGo();
                _screen = SCREEN_EXERCISE;
            }
        }

        // Scrittura periodica leggera: limita I/O ma riduce la perdita in caso di crash.
        if (_workoutStarted && ((_elapsedSec % 5) == 0)) {
            _saveSession();
        }

        Ui.requestUpdate();
    }

    function _formatTime(totalSeconds) {
        var min = (totalSeconds / 60).toNumber();
        var sec = (totalSeconds % 60).toNumber();
        var secText = sec < 10 ? "0" + sec.toString() : sec.toString();

        return min.toString() + ":" + secText;
    }

    function _formatKg(value) {
        // V2.2.8: conserva fino a 2 decimali per pesi inseriti manualmente.
        var text = value.toFloat().format("%.2f");
        var len = text.length();

        if (len >= 3 && text.substring(len - 3, len).equals(".00")) {
            return text.substring(0, len - 3);
        }

        if (len >= 1 && text.substring(len - 1, len).equals("0")) {
            return text.substring(0, len - 1);
        }

        return text;
    }

    function openKgKeypad() {
        if (_screen != SCREEN_WEIGHT || _restRemaining > 0) {
            return;
        }

        // V2.2.11: inserimento manuale sempre da campo vuoto.
        // Il peso corrente resta disponibile tornando indietro senza confermare.
        _kgDraft = "";
        _screen = SCREEN_WEIGHT_KEYPAD;
        _saveSession();
        Ui.requestUpdate();
    }

    function keypadAppend(token) {
        if (_screen != SCREEN_WEIGHT_KEYPAD) {
            return;
        }

        if (token.equals(".")) {
            if (_kgDraft.find(".") != null) {
                return;
            }

            if (_kgDraft.length() == 0) {
                _kgDraft = "0";
            }

            _kgDraft += ".";
            Ui.requestUpdate();
            return;
        }

        // Massimo 6 caratteri totali: sufficiente per valori palestra realistici.
        if (_kgDraft.length() >= 6) {
            return;
        }

        if (_kgDraft.equals("0")) {
            _kgDraft = token;
        } else {
            _kgDraft += token;
        }

        Ui.requestUpdate();
    }

    function keypadDelete() {
        if (_screen != SCREEN_WEIGHT_KEYPAD) {
            return;
        }

        var len = _kgDraft.length();

        if (len > 0) {
            _kgDraft = _kgDraft.substring(0, len - 1);
        }

        _saveSession();
        Ui.requestUpdate();
    }

    function keypadConfirm() {
        if (_screen != SCREEN_WEIGHT_KEYPAD) {
            return;
        }

        if (_kgDraft.length() == 0 || _kgDraft.equals(".")) {
            _kgDraft = "0";
        }

        var value = _kgDraft.toFloat();

        if (value != null && value >= 0) {
            _kg = value;
        }

        _screen = SCREEN_WEIGHT;
        _saveSession();
        Ui.requestUpdate();
    }

    function keypadCancel() {
        if (_screen != SCREEN_WEIGHT_KEYPAD) {
            return;
        }

        _screen = SCREEN_WEIGHT;
        _saveSession();
        Ui.requestUpdate();
    }

    function _fillPill(dc, x, y, width, height, color) {
        var r = (height / 2).toNumber();

        dc.setColor(color, color);
        dc.fillCircle(x + r, y + r, r);
        dc.fillCircle(x + width - r, y + r, r);
        dc.fillRectangle(x + r, y, width - (r * 2), height);
    }

    function _drawPillButton(dc, x, y, width, height, fill, labelColor, text) {
        _fillPill(dc, x, y, width, height, fill);

        var font = Gfx.FONT_XTINY;
        var fontH = dc.getFontHeight(font);

        dc.setColor(labelColor, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            x + (width / 2),
            y + ((height - fontH) / 2) - 1,
            font,
            text,
            Gfx.TEXT_JUSTIFY_CENTER
        );
    }

    function _drawCircleButton(dc, cx, cy, radius, fill, labelColor, text, font) {
        dc.setColor(fill, fill);
        dc.fillCircle(cx, cy, radius);

        var fontH = dc.getFontHeight(font);
        dc.setColor(labelColor, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            cx,
            cy - (fontH / 2) - 1,
            font,
            text,
            Gfx.TEXT_JUSTIFY_CENTER
        );
    }

    function _drawAdjustButton(dc, cx, cy, radius, fill, symbolColor, isPlus) {
        dc.setColor(fill, fill);
        dc.fillCircle(cx, cy, radius);

        var half = 9;
        var thick = 4;
        dc.setColor(symbolColor, symbolColor);
        dc.fillRectangle(cx - half, cy - 2, half * 2, thick);

        if (isPlus) {
            dc.fillRectangle(cx - 2, cy - half, thick, half * 2);
        }
    }

    function _drawCenteredTextExact(dc, cx, y, font, text) {
        // V2.3.0AC: compensazione ottica del font Garmin.
        // getTextWidthInPixels tende a lasciare il blocco visivamente qualche pixel a destra.
        var opticalCx = cx - 3;
        var textW = dc.getTextWidthInPixels(text, font);
        var leftX = (opticalCx - (textW / 2)).toNumber();
        dc.drawText(leftX, y, font, text, Gfx.TEXT_JUSTIFY_LEFT);
    }

    function _drawTop(dc, w, accent, muted, step) {
        dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            8,
            Gfx.FONT_XTINY,
            _formatTime(_elapsedSec),
            Gfx.TEXT_JUSTIFY_CENTER
        );

        var startX = (w / 2) - 33;

        for (var i = 0; i < 4; i += 1) {
            if (i == step) {
                dc.setColor(accent, accent);
                dc.fillCircle(startX + (i * 22), 38, 5);
            } else {
                dc.setColor(muted, muted);
                dc.fillCircle(startX + (i * 22), 38, 3);
            }
        }
    }

    function _exerciseProgressText() {
        return (_exerciseIndex + 1).toString()
            + "/"
            + _workout["exercises"].size().toString()
            + " ESERCIZI";
    }

    function _setProgressText(ex) {
        return (_setIndex + 1).toString()
            + "/"
            + ex["sets"].toString();
    }

    function _compactProgressText(ex) {
        return (_exerciseIndex + 1).toString()
            + "/"
            + _workout["exercises"].size().toString()
            + "  ·  "
            + _setProgressText(ex);
    }

    function onUpdate(dc) {
        var w = dc.getWidth();

        var bg = 0x252B42;
        var accent = 0x72D8C3;
        var accentSoft = 0x58C3B1;
        var white = Gfx.COLOR_WHITE;
        var muted = 0xB7C0CC;
        var faint = 0x7E8794;
        var softFill = 0x39415F;

        dc.setColor(bg, bg);
        dc.clear();

        if (!_syncReady) {
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 92, Gfx.FONT_XTINY, "SET.LOG");

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 150, Gfx.FONT_MEDIUM, _syncMessage);

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 206, Gfx.FONT_XTINY, "TELEFONO -> GARMIN");
            return;
        }

        if (_restRemaining > 0) {
            var rex = _exercise();

            // V2.3.0L: recupero rifinito con colonna centrale più coesa.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 18, Gfx.FONT_XTINY, _formatTime(_elapsedSec));

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 58, Gfx.FONT_XTINY, "RECUPERO");

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 96, Gfx.FONT_LARGE, _formatTime(_restRemaining));

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 150, Gfx.FONT_XTINY, "PROSSIMO  ·  " + _setProgressText(rex));

            var nextNameLines = _exerciseNameLines(rex["name"]);
            var nextNameFont = Gfx.FONT_SMALL;

            if (nextNameLines.size() > 1) {
                var nextNameH = dc.getFontHeight(nextNameFont);

                dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                _drawCenteredTextExact(dc, w / 2, 178, nextNameFont, nextNameLines[0]);
                _drawCenteredTextExact(dc, w / 2, 178 + nextNameH, nextNameFont, nextNameLines[1]);
            } else {
                if (nextNameLines[0].length() > 18) {
                    nextNameFont = Gfx.FONT_XTINY;
                }

                dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                _drawCenteredTextExact(dc, w / 2, 192, nextNameFont, nextNameLines[0]);
            }

            _drawPillButton(dc, 48, 278, 82, 42, softFill, white, "-15s");
            _drawPillButton(dc, 138, 278, 82, 42, softFill, white, "+15s");
            _drawPillButton(dc, 228, 278, 112, 42, accentSoft, white, "SALTA");
            return;
        }

        var ex = _exercise();

        if (_screen == SCREEN_EXERCISE) {
            // V2.3.0L: tutto centrato anche nella schermata esercizio.
            // Timer, contatore serie e contenuto seguono un'unica colonna centrale.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 18, Gfx.FONT_XTINY, _formatTime(_elapsedSec));

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 48, Gfx.FONT_XTINY, _compactProgressText(ex));

            var nameLines = _exerciseNameLines(ex["name"]);
            var nameFont = Gfx.FONT_MEDIUM;

            if (nameLines.size() > 1) {
                nameFont = Gfx.FONT_SMALL;
                var nameH = dc.getFontHeight(nameFont);
                var nameY = 80;

                dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                _drawCenteredTextExact(dc, w / 2, nameY, nameFont, nameLines[0]);
                _drawCenteredTextExact(dc, w / 2, nameY + nameH, nameFont, nameLines[1]);
            } else {
                if (nameLines[0].length() > 18) {
                    nameFont = Gfx.FONT_SMALL;
                }

                dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                _drawCenteredTextExact(dc, w / 2, 96, nameFont, nameLines[0]);
            }

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 174, Gfx.FONT_XTINY, ex["repsLow"].toString() + "-" + ex["repsHigh"].toString() + " REP  •  RIR " + ex["rir"]);

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 206, Gfx.FONT_XTINY, "ULTIMA VOLTA");

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 232, Gfx.FONT_XTINY, ex["lastReps"].toString() + " REP  ×  " + _formatKg(ex["lastKg"]) + " KG");

            _drawPillButton(dc, 96, 282, 198, 44, accentSoft, white, "INIZIA SERIE");
            return;
        }

        if (_screen == SCREEN_REPS) {
            // V2.2.30: layout REPS approvato.
            // Usa davvero il centro del display circolare e distribuisce i blocchi in altezza.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                18,
                Gfx.FONT_XTINY,
                _formatTime(_elapsedSec),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 72, Gfx.FONT_XTINY, "REPS");

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 108, Gfx.FONT_XTINY, "TARGET " + ex["repsLow"].toString() + "-" + ex["repsHigh"].toString());
            // Blocco principale al centro reale della pagina.
            var rowCenterY = 198;
            var repsFont = Gfx.FONT_NUMBER_MEDIUM;
            var repsFontH = dc.getFontHeight(repsFont);

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, rowCenterY - (repsFontH / 2), repsFont, _reps.toString());

            // Controlli grandi, uguali e simmetrici.
            // V2.3.0T: stessa apertura laterale della schermata PESO.
            _drawAdjustButton(dc, 68, rowCenterY, 28, accent, bg, false);
            _drawAdjustButton(dc, w - 68, rowCenterY, 28, accent, bg, true);

            // Azioni basse ma completamente dentro la safe area.
            _drawPillButton(dc, 116, 286, 158, 44, accentSoft, white, "VAI AI KG");
            _drawPillButton(dc, 54, 286, 54, 44, softFill, white, "<");
            return;
        }

        if (_screen == SCREEN_WEIGHT_KEYPAD) {
            // V2.2.13: gruppo valore+KG centrato come un unico elemento.
            // Anche il testo OK viene centrato usando l'altezza reale del font.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                14,
                Gfx.FONT_XTINY,
                _formatTime(_elapsedSec),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            // Campo manuale vuoto all'apertura.
            // Un'unica stringa centrata evita spostamenti quando cambia il numero di cifre.
            if (_kgDraft.length() > 0) {
                dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                dc.drawText(
                    w / 2,
                    50,
                    Gfx.FONT_MEDIUM,
                    _kgDraft + " KG",
                    Gfx.TEXT_JUSTIFY_CENTER
                );
            }

            // Griglia numerica centrata nella safe area.
            var xs = [124, 195, 266];
            var ys = [124, 174, 224, 274];
            var labels = [
                ["1", "2", "3"],
                ["4", "5", "6"],
                ["7", "8", "9"],
                [".", "0", "<"]
            ];

            var keyFont = Gfx.FONT_XTINY;
            var keyFontH = dc.getFontHeight(keyFont);

            for (var r = 0; r < 4; r += 1) {
                for (var c = 0; c < 3; c += 1) {
                    dc.setColor(softFill, softFill);
                    dc.fillCircle(xs[c], ys[r], 18);

                    dc.setColor(white, Gfx.COLOR_TRANSPARENT);
                    dc.drawText(
                        xs[c],
                        ys[r] - (keyFontH / 2),
                        keyFont,
                        labels[r][c],
                        Gfx.TEXT_JUSTIFY_CENTER
                    );
                }
            }

            // OK custom: centratura verticale precisa, non usa l'offset fisso della pill generica.
            var okX = 143;
            var okY = 320;
            var okW = 104;
            var okH = 36;
            _fillPill(dc, okX, okY, okW, okH, accentSoft);

            var okFont = Gfx.FONT_XTINY;
            var okFontH = dc.getFontHeight(okFont);
            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                okX + (okW / 2),
                okY + ((okH - okFontH) / 2),
                okFont,
                "OK",
                Gfx.TEXT_JUSTIFY_CENTER
            );

            return;
        }

        if (_screen == SCREEN_WEIGHT) {
            // V2.3.0M: PESO allineato alla schermata REPS.
            // Stesse fasce verticali, stessi controlli e stesso centro reale.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                18,
                Gfx.FONT_XTINY,
                _formatTime(_elapsedSec),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 72, Gfx.FONT_XTINY, "PESO");

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 106, Gfx.FONT_XTINY, "ULTIMA VOLTA  ·  " + _formatKg(ex["lastKg"]) + " KG");

            // V2.3.0V: FONT_NUMBER_MEDIUM supporta solo cifre, quindi il numero
            // viene disegnato separatamente dall'unità per evitare glyph/box corrotti.
            var weightNumber = _formatKg(_kg);
            var valueFont = Gfx.FONT_NUMBER_MEDIUM;
            if (weightNumber.length() >= 5) {
                valueFont = Gfx.FONT_LARGE;
            }

            var rowCenterY = 198;
            var valueFontH = dc.getFontHeight(valueFont);

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, rowCenterY - (valueFontH / 2) - 7, valueFont, weightNumber);

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, rowCenterY + 38, Gfx.FONT_XTINY, "KG");

            _drawAdjustButton(dc, 68, rowCenterY, 28, accent, bg, false);
            _drawAdjustButton(dc, w - 68, rowCenterY, 28, accent, bg, true);
            // CTA identiche per ritmo e allineamento alla schermata REPS.
            _drawPillButton(dc, 116, 286, 158, 44, accentSoft, white, "CONTINUA");
            _drawPillButton(dc, 54, 286, 54, 44, softFill, white, "<");
            return;
        }

        if (_screen == SCREEN_FINISHED) {
            var trainedSec = _finishElapsedSec - _finishRestElapsedSec;
            if (trainedSec < 0) {
                trainedSec = 0;
            }

            // V2.3.0O: schermata finale centrata, compatta e senza sovrapposizioni.
            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 26, Gfx.FONT_XTINY, "ALLENAMENTO");

            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 50, Gfx.FONT_XTINY, "COMPLETATO");

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 82, Gfx.FONT_LARGE, _formatTime(_finishElapsedSec));

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 136, Gfx.FONT_XTINY, "TOTALE");

            var leftX = 125;
            var rightX = w - 125;

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, leftX, 164, Gfx.FONT_XTINY, "ALLENATO");
            _drawCenteredTextExact(dc, rightX, 164, Gfx.FONT_XTINY, "RIPOSO");

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, leftX, 188, Gfx.FONT_SMALL, _formatTime(trainedSec));
            _drawCenteredTextExact(dc, rightX, 188, Gfx.FONT_SMALL, _formatTime(_finishRestElapsedSec));

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 238, Gfx.FONT_XTINY, _workout["exercises"].size().toString() + " ESERCIZI  ·  " + _completedSets.toString() + " SERIE");

            if (_remoteSessionId != null) {
                dc.setColor(_syncPushState == 2 ? accent : muted, Gfx.COLOR_TRANSPARENT);
                var syncLabel = _syncPushState == 2
                    ? "SYNC OK"
                    : (_syncPushState == 3
                        ? "SYNC ERRORE " + _syncPushCode.toString()
                        : "SYNC...");
                _drawCenteredTextExact(dc, w / 2, 264, Gfx.FONT_XTINY, syncLabel);
            }

            _drawPillButton(dc, 120, 300, 150, 40, accentSoft, white, "FINE");
            return;
        }

        if (_screen == SCREEN_CONFIRM) {
            // V2.3.0L: riepilogo centrato e più coeso.
            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                16,
                Gfx.FONT_XTINY,
                _formatTime(_elapsedSec),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 56, Gfx.FONT_XTINY, "RIEPILOGO  ·  " + _setProgressText(ex));

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            _drawCenteredTextExact(dc, w / 2, 90, Gfx.FONT_MEDIUM, _reps.toString() + " REP");
            _drawCenteredTextExact(dc, w / 2, 130, Gfx.FONT_MEDIUM, _formatKg(_kg) + " KG");

            var summaryNameLines = _exerciseNameLines(ex["name"]);
            var summaryNameFont = Gfx.FONT_XTINY;

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            if (summaryNameLines.size() > 1) {
                var summaryNameH = dc.getFontHeight(summaryNameFont);
                _drawCenteredTextExact(dc, w / 2, 180, summaryNameFont, summaryNameLines[0]);
                _drawCenteredTextExact(dc, w / 2, 180 + summaryNameH, summaryNameFont, summaryNameLines[1]);
            } else {
                _drawCenteredTextExact(dc, w / 2, 192, summaryNameFont, summaryNameLines[0]);
            }

            _drawPillButton(dc, 52, 274, 134, 42, softFill, white, "MODIFICA");
            _drawPillButton(dc, 204, 274, 134, 42, accentSoft, white, "SALVA");
            return;
        }
    }
}
