using Toybox.Graphics as Gfx;
using Toybox.Timer as Timer;
using Toybox.WatchUi as Ui;

class WorkoutView extends Ui.View {
    private var _workout;
    private var _exerciseIndex = 0;
    private var _setIndex = 0;
    private var _kg = 0.0;
    private var _reps = 0;
    private var _restRemaining = 0;
    private var _timer;

    function initialize() {
        View.initialize();
        _workout = new WorkoutStore().demoWorkout();
        _loadCurrentDefaults();
    }

    function onHide() {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    function _exercise() {
        return _workout["exercises"][_exerciseIndex];
    }

    function _nextExerciseName() {
        if ((_exerciseIndex + 1) < _workout["exercises"].size()) {
            return _workout["exercises"][_exerciseIndex + 1]["name"];
        }
        return "Fine workout";
    }

    function _loadCurrentDefaults() {
        var ex = _exercise();
        _kg = ex["lastKg"];
        _reps = ex["lastReps"];
    }

    function changeKg(delta) {
        _kg += delta;
        if (_kg < 0) {
            _kg = 0.0;
        }
        Ui.requestUpdate();
    }

    function changeReps(delta) {
        _reps += delta;
        if (_reps < 0) {
            _reps = 0;
        }
        Ui.requestUpdate();
    }

    function completeSet() {
        if (_restRemaining > 0) {
            _stopRest();
            return;
        }

        var ex = _exercise();

        if ((_setIndex + 1) < ex["sets"]) {
            _setIndex += 1;
            _startRest(ex["restSec"]);
            return;
        }

        if ((_exerciseIndex + 1) < _workout["exercises"].size()) {
            _exerciseIndex += 1;
        } else {
            _exerciseIndex = 0;
        }

        _setIndex = 0;
        _loadCurrentDefaults();
        Ui.requestUpdate();
    }

    function _startRest(seconds) {
        _restRemaining = seconds;
        if (_timer != null) {
            _timer.stop();
        }
        _timer = new Timer.Timer();
        _timer.start(method(:_tick), 1000, true);
        Ui.requestUpdate();
    }

    function _stopRest() {
        _restRemaining = 0;
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        Ui.requestUpdate();
    }

    function _tick() as Void {
        if (_restRemaining > 0) {
            _restRemaining -= 1;
        }

        if (_restRemaining <= 0) {
            _stopRest();
        } else {
            Ui.requestUpdate();
        }
    }

    function _restText() {
        var min = (_restRemaining / 60).toNumber();
        var sec = (_restRemaining % 60).toNumber();
        var secText = sec < 10 ? "0" + sec.toString() : sec.toString();
        return min.toString() + ":" + secText;
    }

    function _formatKg(value) {
        var halfSteps = (value * 2).toNumber();

        if ((halfSteps % 2) == 0) {
            return ((halfSteps / 2).toNumber()).toString();
        }

        return ((((halfSteps - 1) / 2).toNumber()).toString() + ".5");
    }

    function onUpdate(dc) {
        var w = dc.getWidth();

        var bg = 0x0B1016;
        var accent = 0x4DA6FF;
        var accentDark = 0x173A5E;
        var text = Gfx.COLOR_WHITE;
        var muted = 0xB7C3CF;
        var subtle = 0x7A8796;

        dc.setColor(bg, bg);
        dc.clear();

        dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 24, Gfx.FONT_SMALL, _workout["name"], Gfx.TEXT_JUSTIFY_CENTER);

        if (_restRemaining > 0) {
            var restEx = _exercise();

            dc.setColor(text, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, 88, Gfx.FONT_MEDIUM, "RECUPERO", Gfx.TEXT_JUSTIFY_CENTER);

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, 122, Gfx.FONT_XTINY, restEx["name"], Gfx.TEXT_JUSTIFY_CENTER);

            dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, 176, Gfx.FONT_NUMBER_HOT, _restText(), Gfx.TEXT_JUSTIFY_CENTER);

            dc.setColor(accentDark, accentDark);
            dc.fillRectangle(60, 248, 270, 36);

            dc.setColor(text, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, 272, Gfx.FONT_SMALL, "SALTA RECUPERO", Gfx.TEXT_JUSTIFY_CENTER);

            dc.setColor(subtle, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, 322, Gfx.FONT_XTINY, "Prossimo: " + _nextExerciseName(), Gfx.TEXT_JUSTIFY_CENTER);
            return;
        }

        var ex = _exercise();

        dc.setColor(text, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 68, Gfx.FONT_MEDIUM, ex["name"], Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            100,
            Gfx.FONT_XTINY,
            "Serie " + (_setIndex + 1).toString() + "/" + ex["sets"].toString(),
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.drawText(
            w / 2,
            122,
            Gfx.FONT_XTINY,
            "Target " + ex["repsLow"].toString() + "-" + ex["repsHigh"].toString() + " • RIR " + ex["rir"],
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.setColor(subtle, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            144,
            Gfx.FONT_XTINY,
            "Ultima: " + _formatKg(ex["lastKg"]) + " kg × " + ex["lastReps"].toString(),
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 170, Gfx.FONT_XTINY, "KG OGGI", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(text, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 198, Gfx.FONT_MEDIUM, _formatKg(_kg) + " kg", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
        dc.drawText(40, 198, Gfx.FONT_SMALL, "−", Gfx.TEXT_JUSTIFY_CENTER);
        dc.drawText(w - 40, 198, Gfx.FONT_SMALL, "+", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 224, Gfx.FONT_XTINY, "REPS OGGI", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(text, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 252, Gfx.FONT_MEDIUM, _reps.toString() + " reps", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(accent, Gfx.COLOR_TRANSPARENT);
        dc.drawText(40, 252, Gfx.FONT_SMALL, "−", Gfx.TEXT_JUSTIFY_CENTER);
        dc.drawText(w - 40, 252, Gfx.FONT_SMALL, "+", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(accentDark, accentDark);
        dc.fillRectangle(60, 284, 270, 36);

        dc.setColor(text, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 308, Gfx.FONT_SMALL, "COMPLETA", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(subtle, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, 344, Gfx.FONT_XTINY, "Prossimo: " + _nextExerciseName(), Gfx.TEXT_JUSTIFY_CENTER);
    }
}