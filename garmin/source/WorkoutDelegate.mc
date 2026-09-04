using Toybox.WatchUi as Ui;

class WorkoutDelegate extends Ui.InputDelegate {
    private var _view;

    function initialize(view) {
        InputDelegate.initialize();
        _view = view;
    }

    function onTap(event) {
        var xy = event.getCoordinates();
        var x = xy[0];
        var y = xy[1];

        if (y >= 160 && y < 220) {
            _view.changeKg(x < 195 ? -2.5 : 2.5);
            return true;
        }

        if (y >= 220 && y < 285) {
            _view.changeReps(x < 195 ? -1 : 1);
            return true;
        }

        if (y >= 285) {
            _view.completeSet();
            return true;
        }

        return false;
    }

    function onKey(event) {
        var key = event.getKey();
        if (key == Ui.KEY_ENTER) {
            _view.completeSet();
            return true;
        }
        return false;
    }
}
