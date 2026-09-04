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

        // Se siamo nel recupero, il tap serve per saltarlo
        if (_restRemaining > 0) {
            _stopRest();
            return;
        }

        var ex = _exercise();

        // Altra serie dello stesso esercizio
        if ((_setIndex + 1) < ex["sets"]) {
            _setIndex += 1;
            _startRest(ex["restSec"]);
            return;
        }

        // Fine esercizio -> prossimo esercizio
        if ((_exerciseIndex + 1) < _workout["exercises"].size()) {
            _exerciseIndex += 1;
        } else {
            // Per ora, nella demo, ricomincia dal primo
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

        var secText = sec < 10
            ? "0" + sec.toString()
            : sec.toString();

        return min.toString() + ":" + secText;
    }

    function _formatKg(value) {

        var halfSteps = (value * 2).toNumber();

        if ((halfSteps % 2) == 0) {
            return ((halfSteps / 2).toNumber()).toString();
        }

        return (((halfSteps - 1) / 2).toNumber()).toString() + ".5";
    }

    function onUpdate(dc) {

        var w = dc.getWidth();

        // Palette blu stile vívoactive
        var bg = 0x071018;
        var blue = 0x45A8FF;
        var blueDark = 0x123D61;
        var white = Gfx.COLOR_WHITE;
        var muted = 0xA8B5C2;
        var faint = 0x6F7D8A;

        dc.setColor(bg, bg);
        dc.clear();

        // =====================================================
        // RECUPERO
        // =====================================================

        if (_restRemaining > 0) {

            dc.setColor(blue, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                36,
                Gfx.FONT_SMALL,
                _workout["name"],
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                84,
                Gfx.FONT_MEDIUM,
                "RECUPERO",
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(blue, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                145,
                Gfx.FONT_NUMBER_HOT,
                _restText(),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                218,
                Gfx.FONT_XTINY,
                "Serie "
                    + (_setIndex + 1).toString()
                    + "/"
                    + _exercise()["sets"].toString(),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(blueDark, blueDark);
            dc.fillRectangle(
                105,
                260,
                180,
                38
            );

            dc.setColor(white, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                270,
                Gfx.FONT_XTINY,
                "SALTA",
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
            dc.drawText(
                w / 2,
                318,
                Gfx.FONT_XTINY,
                "Prossimo:",
                Gfx.TEXT_JUSTIFY_CENTER
            );

            dc.drawText(
                w / 2,
                338,
                Gfx.FONT_XTINY,
                _nextExerciseName(),
                Gfx.TEXT_JUSTIFY_CENTER
            );

            return;
        }

        // =====================================================
        // ESERCIZIO
        // =====================================================

        var ex = _exercise();

        // Nome workout
        dc.setColor(blue, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            26,
            Gfx.FONT_SMALL,
            _workout["name"],
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // Nome esercizio
        dc.setColor(white, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            62,
            Gfx.FONT_MEDIUM,
            ex["name"],
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // Serie / reps target / RIR
        dc.setColor(muted, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            103,
            Gfx.FONT_XTINY,
            "Serie "
                + (_setIndex + 1).toString()
                + "/"
                + ex["sets"].toString()
                + "  •  "
                + ex["repsLow"].toString()
                + "-"
                + ex["repsHigh"].toString()
                + "  •  RIR "
                + ex["rir"],
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // Prestazione precedente
        dc.setColor(faint, Gfx.COLOR_TRANSPARENT);
        dc.drawText(
            w / 2,
            130,
            Gfx.FONT_XTINY,
            "Scorsa: "
                + _formatKg(ex["lastKg"])
                + " kg × "
                + ex["lastReps"].toString(),
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // =====================================================
        // KG
        // =====================================================

        dc.setColor(blue, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            67,
            176,
            Gfx.FONT_MEDIUM,
            "−",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.drawText(
            w - 67,
            176,
            Gfx.FONT_MEDIUM,
            "+",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.setColor(white, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            w / 2,
            176,
            Gfx.FONT_MEDIUM,
            _formatKg(_kg) + " KG",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // =====================================================
        // REPS
        // =====================================================

        dc.setColor(blue, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            67,
            224,
            Gfx.FONT_MEDIUM,
            "−",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.drawText(
            w - 67,
            224,
            Gfx.FONT_MEDIUM,
            "+",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.setColor(white, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            w / 2,
            224,
            Gfx.FONT_MEDIUM,
            _reps.toString() + " REP",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // =====================================================
        // COMPLETA
        // =====================================================

        dc.setColor(blueDark, blueDark);

        dc.fillRectangle(
            105,
            282,
            180,
            38
        );

        dc.setColor(white, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            w / 2,
            292,
            Gfx.FONT_XTINY,
            "COMPLETA",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        // =====================================================
        // PROSSIMO ESERCIZIO
        // =====================================================

        dc.setColor(faint, Gfx.COLOR_TRANSPARENT);

        dc.drawText(
            w / 2,
            332,
            Gfx.FONT_XTINY,
            "Prossimo:",
            Gfx.TEXT_JUSTIFY_CENTER
        );

        dc.drawText(
            w / 2,
            350,
            Gfx.FONT_XTINY,
            _nextExerciseName(),
            Gfx.TEXT_JUSTIFY_CENTER
        );
    }
}