using Toybox.Application as App;
using Toybox.WatchUi as Ui;

class SetLogApp extends App.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
    }

    function onStop(state) {
    }

    function getInitialView() {
        var view = new WorkoutView();
        return [view, new WorkoutDelegate(view)];
    }
}
