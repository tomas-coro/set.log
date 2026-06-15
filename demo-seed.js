// demo-seed.js
// Seed DEMO: blob schema-6 curato e DETERMINISTICO (a parità di `now`).
// Dati finti — mai i dati veri dell'utente. now iniettato per i test.
import { isoWeekKey } from "./store.js";
import { seedCatalogIfAbsent } from "./catalog.js";

const SHEET_ID = "demo-sheet";

// Giorni della scheda. id esercizio HARDCODATI e stabili: servono per chiavare i
// log (app.js exIdOf usa e.id) e per i grafici (openChartDialog(ex.id)).
function demoPlan() {
  return [
    { day: "A", title: "Spinta · Petto/Spalle/Tricipiti", exercises: [
      { id: "da1", name: "Panca piana bilanciere", setsReps: "4 × 6", recText: "2 min", restSeconds: 120, superset: false, muscle: "Petto", bar: 20 },
      { id: "da2", name: "Spinte manubri inclinata", setsReps: "3 × 8-10", recText: "90 sec", restSeconds: 90, superset: false, muscle: "Petto" },
      { id: "da3", name: "Croci ai cavi in piedi", setsReps: "3 × 12", recText: "75 sec", restSeconds: 75, superset: false, muscle: "Petto" },
      { id: "da4", name: "Alzate laterali + Pushdown tricipiti", setsReps: "3 × 15 / 3 × 12", recText: "60 sec", restSeconds: 60, superset: true, muscle: "Spalle", muscleB: "Tricipiti" },
    ] },
    { day: "B", title: "Tirata · Schiena/Bicipiti", exercises: [
      { id: "db1", name: "Stacco da terra", setsReps: "4 × 5", recText: "2.5 min", restSeconds: 150, superset: false, muscle: "Schiena", bar: 20 },
      { id: "db2", name: "Trazioni alla sbarra", setsReps: "4 × 8", recText: "2 min", restSeconds: 120, superset: false, muscle: "Schiena" },
      { id: "db3", name: "Rematore con bilanciere", setsReps: "3 × 10", recText: "90 sec", restSeconds: 90, superset: false, muscle: "Schiena", bar: 20 },
      { id: "db4", name: "Curl manubri", setsReps: "3 × 12", recText: "60 sec", restSeconds: 60, superset: false, muscle: "Bicipiti" },
    ] },
    { day: "C", title: "Gambe · Quadricipiti/Femorali", exercises: [
      { id: "dc1", name: "Squat con bilanciere", setsReps: "4 × 6", recText: "2.5 min", restSeconds: 150, superset: false, muscle: "Quadricipiti", bar: 20 },
      { id: "dc2", name: "Pressa", setsReps: "3 × 10", recText: "2 min", restSeconds: 120, superset: false, muscle: "Quadricipiti" },
      { id: "dc3", name: "Leg curl", setsReps: "3 × 12", recText: "75 sec", restSeconds: 75, superset: false, muscle: "Femorali" },
      { id: "dc4", name: "Calf in piedi", setsReps: "4 × 15", recText: "45 sec", restSeconds: 45, superset: false, muscle: "Polpacci" },
    ] },
  ];
}

// 3 chiavi settimana ISO consecutive che terminano nella settimana di `now`.
function lastThreeWeekKeys(now) {
  const keys = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    keys.push(isoWeekKey(d));
  }
  return keys;
}

// Una serie loggata "fatta".
const S = (reps, kg) => ({ reps: String(reps), kg: String(kg), done: true, feel: "", warmup: false, failed: false, failNote: "", comments: [] });

// Entry per un esercizio normale (n serie a stesso reps/kg) o superset (a/b).
function entryFor(ex, kg) {
  if (ex.superset) {
    return {
      a: { sets: [S(15, kg.a), S(15, kg.a), S(15, kg.a)], note: "" },
      b: { sets: [S(12, kg.b), S(12, kg.b), S(12, kg.b)], note: "" },
      c: { sets: [], note: "" },
      note: "",
    };
  }
  return { sets: [S(ex._reps, kg), S(ex._reps, kg), S(ex._reps, kg)], note: "" };
}

// Carico per esercizio e per indice-settimana (0,1,2): progressione +incremento.
function kgFor(ex, w) {
  if (ex.superset) return { a: 8 + w * 2, b: 14 + w * 2.5 };       // alzate / pushdown
  const base = { da1: 60, da2: 24, da3: 12, db1: 90, db2: 0, db3: 50, db4: 12, dc1: 80, dc2: 120, dc3: 35, dc4: 60 }[ex.id] ?? 20;
  return Math.round((base + w * 2.5) * 10) / 10;
}

export function seedDemoData(now = new Date()) {
  const plan = demoPlan();
  const weekKeys = lastThreeWeekKeys(now);
  const weeks = {};
  weekKeys.forEach((wk, w) => {
    // Una data per giorno dentro la settimana (lun/mer/ven), derivata da `now`.
    const monday = new Date(now);
    monday.setDate(monday.getDate() - (w === 2 ? 0 : (2 - w) * 7) - ((monday.getDay() + 6) % 7));
    const dateFor = (offset) => {
      const d = new Date(monday); d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const entries = { A: {}, B: {}, C: {} };
    for (const d of plan) {
      for (const ex of d.exercises) {
        const reps = parseInt(String(ex.setsReps).split("×")[1], 10) || 8;
        entries[d.day][ex.id] = entryFor({ ...ex, _reps: reps }, kgFor(ex, w));
      }
    }
    weeks[wk] = {
      label: wk,
      entries,
      dates: { A: dateFor(0), B: dateFor(2), C: dateFor(4) },
    };
  });

  const blob = {
    schema: 6,
    updatedAt: now.toISOString(),
    activeSheetId: SHEET_ID,
    sheets: [{ id: SHEET_ID, name: "Scheda demo", plan, weeks }],
  };
  return seedCatalogIfAbsent(blob); // aggiunge blob.catalog standard
}

// "Modificato" = il blob differisce dal seed fresco (a parità di `now`).
// Confronto strutturale: se l'utente ha loggato/editato qualcosa, cambia.
export function isDemoModified(blob, now = new Date()) {
  return JSON.stringify(blob) !== JSON.stringify(seedDemoData(now));
}
