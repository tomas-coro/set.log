using Toybox.Application as App;
using Toybox.WatchUi as Ui;

class SetLogApp extends App.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new WorkoutView();
        return [ view, new WorkoutDelegate(view) ];
    }
}
