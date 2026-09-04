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

    function _loadCurrentDefaults() {
        var ex = _exercise();
        _kg = ex["lastKg"];
        _reps = ex["lastReps"];
    }

    function changeKg(delta) {
        _kg += delta;
        if (_kg < 0) { _kg = 0; }
        Ui.requestUpdate();
    }

    function changeReps(delta) {
        _reps += delta;
        if (_reps < 0) { _reps = 0; }
        Ui.requestUpdate();
    }

    function completeSet() {
        if (_restRemaining > 0) {
            _stopRest();
            return;
        }

        var ex = _exercise();
        if (_setIndex + 1 < ex["sets"]) {
            _setIndex += 1;
            _startRest(ex["restSec"]);
        } else {
            if (_exerciseIndex + 1 < _workout["exercises"].size()) {
                _exerciseIndex += 1;
                _setIndex = 0;
                _loadCurrentDefaults();
            } else {
                _exerciseIndex = 0;
                _setIndex = 0;
                _loadCurrentDefaults();
            }
            Ui.requestUpdate();
        }
    }

    function _startRest(seconds) {
        _restRemaining = seconds;
        if (_timer != null) { _timer.stop(); }
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

    function _tick() {
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

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();

        dc.setColor(0x12100e, 0x12100e);
        dc.clear();

        dc.setColor(0xff6a1a, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 25, Gfx.FONT_SMALL, _workout["name"], Gfx.TEXT_JUSTIFY_CENTER);

        if (_restRemaining > 0) {
            dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w/2, 105, Gfx.FONT_MEDIUM, "RECUPERO", Gfx.TEXT_JUSTIFY_CENTER);
            dc.setColor(0xff6a1a, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w/2, 170, Gfx.FONT_NUMBER_HOT, _restText(), Gfx.TEXT_JUSTIFY_CENTER);
            dc.setColor(0xb3a897, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w/2, 285, Gfx.FONT_SMALL, "Tocca per saltare", Gfx.TEXT_JUSTIFY_CENTER);
            return;
        }

        var ex = _exercise();
        var nextName = "Fine";
        if (_exerciseIndex + 1 < _workout["exercises"].size()) {
            nextName = _workout["exercises"][_exerciseIndex + 1]["name"];
        }

        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 67, Gfx.FONT_MEDIUM, ex["name"], Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(0xb3a897, Gfx.COLOR_TRANSPARENT);
        var setLine = "Serie " + (_setIndex + 1).toString() + "/" + ex["sets"].toString()
                    + "  •  " + ex["repsLow"].toString() + "-" + ex["repsHigh"].toString()
                    + "  •  RIR " + ex["rir"];
        dc.drawText(w/2, 111, Gfx.FONT_XTINY, setLine, Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(0x857c6d, Gfx.COLOR_TRANSPARENT);
        var lastLine = "Ultima: " + ex["lastKg"].toString() + " kg × " + ex["lastReps"].toString();
        dc.drawText(w/2, 143, Gfx.FONT_XTINY, lastLine, Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 188, Gfx.FONT_MEDIUM, _kg.toString() + " kg", Gfx.TEXT_JUSTIFY_CENTER);
        dc.setColor(0xb3a897, Gfx.COLOR_TRANSPARENT);
        dc.drawText(35, 190, Gfx.FONT_SMALL, "−", Gfx.TEXT_JUSTIFY_CENTER);
        dc.drawText(w-35, 190, Gfx.FONT_SMALL, "+", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 242, Gfx.FONT_MEDIUM, _reps.toString() + " reps", Gfx.TEXT_JUSTIFY_CENTER);
        dc.setColor(0xb3a897, Gfx.COLOR_TRANSPARENT);
        dc.drawText(35, 244, Gfx.FONT_SMALL, "−", Gfx.TEXT_JUSTIFY_CENTER);
        dc.drawText(w-35, 244, Gfx.FONT_SMALL, "+", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(0xff6a1a, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 302, Gfx.FONT_SMALL, "COMPLETA SERIE", Gfx.TEXT_JUSTIFY_CENTER);

        dc.setColor(0x857c6d, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w/2, 345, Gfx.FONT_XTINY, "Prossimo: " + nextName, Gfx.TEXT_JUSTIFY_CENTER);
    }
}
