using Toybox.WatchUi as Ui;

class CancelWorkoutDelegate extends Ui.ConfirmationDelegate {
    private var _view;

    function initialize(view) {
        ConfirmationDelegate.initialize();
        _view = view;
    }

    function onResponse(response) {
        if (response == Ui.CONFIRM_YES) {
            _view.cancelWorkout();
        }
        return true;
    }
}
