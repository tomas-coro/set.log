class WorkoutStore {
    function initialize() {}

    function demoWorkout() {
        return {
            "name" => "D - Upper",
            "exercises" => [
                {
                    "name" => "Chest press",
                    "sets" => 3,
                    "repsLow" => 6,
                    "repsHigh" => 10,
                    "rir" => "2",
                    "restSec" => 150,
                    "lastKg" => 60.0,
                    "lastReps" => 9
                },
                {
                    "name" => "Shoulder press",
                    "sets" => 3,
                    "repsLow" => 6,
                    "repsHigh" => 10,
                    "rir" => "1-2",
                    "restSec" => 150,
                    "lastKg" => 35.0,
                    "lastReps" => 8
                },
                {
                    "name" => "Lat machine",
                    "sets" => 3,
                    "repsLow" => 8,
                    "repsHigh" => 12,
                    "rir" => "1-2",
                    "restSec" => 120,
                    "lastKg" => 55.0,
                    "lastReps" => 10
                }
            ]
        };
    }
}
