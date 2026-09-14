using Toybox.WatchUi as Ui;

class WorkoutDelegate extends Ui.InputDelegate {
    private var _view;

    function initialize(view) {
        InputDelegate.initialize();
        _view = view;
    }

    function _insideCircle(x, y, cx, cy, radius) {
        var dx = x - cx;
        var dy = y - cy;
        return ((dx * dx) + (dy * dy)) <= (radius * radius);
    }

    function onTap(event) {
        var xy = event.getCoordinates();
        var x = xy[0];
        var y = xy[1];

        if (_view.isResting()) {
            if (y >= 270 && y <= 330) {
                if (x >= 40 && x < 134) {
                    _view.subtractRest15();
                    return true;
                }

                if (x >= 134 && x < 224) {
                    _view.addRest15();
                    return true;
                }

                if (x >= 224 && x <= 350) {
                    _view.skipRest();
                    return true;
                }
            }

            return false;
        }

        var screen = _view.getScreen();

        // 0 = ESERCIZIO
        if (screen == 0) {
            if (y >= 270 && y <= 338) {
                _view.openReps();
                return true;
            }
            return false;
        }

        // 1 = REPS
        if (screen == 1) {
            if (_insideCircle(x, y, 82, 198, 44)) {
                _view.changeReps(-1);
                return true;
            }

            if (_insideCircle(x, y, 308, 198, 44)) {
                _view.changeReps(1);
                return true;
            }

            if (y >= 276 && y <= 340) {
                if (x >= 42 && x < 112) {
                    _view.backStep();
                    return true;
                }

                if (x >= 110 && x <= 286) {
                    _view.openWeight();
                    return true;
                }
            }

            return false;
        }

        // 2 = PESO
        if (screen == 2) {
            if (_insideCircle(x, y, 82, 198, 44)) {
                _view.changeKg(-2.5);
                return true;
            }

            if (_insideCircle(x, y, 308, 198, 44)) {
                _view.changeKg(2.5);
                return true;
            }

            // Tap sul valore centrale = inserimento manuale.
            if (x >= 125 && x <= 265 && y >= 145 && y <= 245) {
                _view.openKgKeypad();
                return true;
            }

            if (y >= 276 && y <= 340) {
                if (x >= 42 && x < 112) {
                    _view.backStep();
                    return true;
                }

                if (x >= 110 && x <= 286) {
                    _view.openConfirm();
                    return true;
                }
            }

            return false;
        }

        // 3 = RIEPILOGO
        if (screen == 3) {
            if (y >= 264 && y <= 326) {
                if (x >= 42 && x < 196) {
                    _view.editFromConfirm();
                    return true;
                }

                if (x >= 196 && x <= 348) {
                    _view.saveSet();
                    return true;
                }
            }

            return false;
        }

        // 4 = TASTIERINO PESO
        if (screen == 4) {
            var xs = [124, 195, 266];
            var ys = [124, 174, 224, 274];
            var labels = [
                ["1", "2", "3"],
                ["4", "5", "6"],
                ["7", "8", "9"],
                [".", "0", "<"]
            ];

            for (var r = 0; r < 4; r += 1) {
                for (var c = 0; c < 3; c += 1) {
                    if (_insideCircle(x, y, xs[c], ys[r], 26)) {
                        var label = labels[r][c];

                        if (label.equals("<")) {
                            _view.keypadDelete();
                        } else {
                            _view.keypadAppend(label);
                        }

                        return true;
                    }
                }
            }

            if (x >= 132 && x <= 258 && y >= 310 && y <= 366) {
                _view.keypadConfirm();
                return true;
            }

            return false;
        }

        // 5 = FINE
        if (screen == 5) {
            if (y >= 290 && y <= 350) {
                _view.finishWorkout();
                return true;
            }
            return false;
        }

        return false;
    }

    function onKey(event) {
        var key = event.getKey();

        // Hold su ESC/back da qualunque schermata: chiede conferma prima
        // di annullare l'allenamento (invece di uscire e basta lasciandolo
        // in sospeso, ripreso automaticamente al prossimo avvio).
        if (key == Ui.KEY_ESC && (event has :getType) && event.getType() == Ui.PRESS_TYPE_HOLD) {
            _view.confirmCancelWorkout();
            return true;
        }

        if (key == Ui.KEY_ENTER) {
            var screen = _view.getScreen();

            if (_view.isResting()) {
                _view.skipRest();
                return true;
            }

            if (screen == 0) {
                _view.openReps();
                return true;
            }

            if (screen == 1) {
                _view.openWeight();
                return true;
            }

            if (screen == 2) {
                _view.openConfirm();
                return true;
            }

            if (screen == 3) {
                _view.saveSet();
                return true;
            }

            if (screen == 4) {
                _view.keypadConfirm();
                return true;
            }

            if (screen == 5) {
                _view.finishWorkout();
                return true;
            }
        }

        if (key == Ui.KEY_ESC) {
            var current = _view.getScreen();

            if (current == 4) {
                _view.keypadCancel();
                return true;
            }

            if (current == 1 || current == 2 || current == 3) {
                _view.backStep();
                return true;
            }
        }

        return false;
    }
}
