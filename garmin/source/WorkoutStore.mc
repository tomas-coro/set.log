class WorkoutStore {

    function initialize() {
    }

    // Fallback locale: viene usato solo se il sync remoto non ha ancora
    // caricato una sessione reale dal telefono.
    function demoWorkout() {
        return {
            "name" => "SET.LOG DEMO",
            "exercises" => [
                {
                    "name" => "Chest press",
                    "sets" => 3,
                    "repsLow" => 6,
                    "repsHigh" => 10,
                    "rir" => "1-2",
                    "restSec" => 90,
                    "lastKg" => 60.0,
                    "lastReps" => 9
                },
                {
                    "name" => "Lat machine",
                    "sets" => 3,
                    "repsLow" => 8,
                    "repsHigh" => 12,
                    "rir" => "1-2",
                    "restSec" => 90,
                    "lastKg" => 55.0,
                    "lastReps" => 10
                },
                {
                    "name" => "Alzate laterali",
                    "sets" => 3,
                    "repsLow" => 12,
                    "repsHigh" => 20,
                    "rir" => "1",
                    "restSec" => 75,
                    "lastKg" => 8.0,
                    "lastReps" => 15
                }
            ]
        };
    }
}
