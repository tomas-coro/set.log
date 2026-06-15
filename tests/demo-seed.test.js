import { test } from "node:test";
import assert from "node:assert/strict";
import { seedDemoData, isDemoModified } from "../demo-seed.js";
import { hydrate, activeSheet } from "../sheets.js";
import { isoWeekKey } from "../store.js";

const NOW = new Date("2026-06-15T10:00:00Z"); // lunedì fisso → keys deterministiche

test("seed: blob schema 6 con 1 scheda e catalogo", () => {
  const b = seedDemoData(NOW);
  assert.equal(b.schema, 6);
  assert.equal(b.sheets.length, 1);
  assert.ok(Array.isArray(b.catalog) && b.catalog.length > 0);
});

test("seed: scheda Push/Pull/Gambe con giorni A/B/C", () => {
  const sh = activeSheet(seedDemoData(NOW));
  assert.deepEqual(sh.plan.map((d) => d.day), ["A", "B", "C"]);
  assert.ok(sh.plan.every((d) => d.exercises.length >= 4));
});

test("seed: un superset sul giorno A", () => {
  const sh = activeSheet(seedDemoData(NOW));
  const a = sh.plan.find((d) => d.day === "A");
  assert.equal(a.exercises.filter((e) => e.superset).length, 1);
});

test("seed: 3 settimane loggate con date", () => {
  const sh = activeSheet(seedDemoData(NOW));
  const wks = Object.keys(sh.weeks);
  assert.equal(wks.length, 3);
  assert.ok(wks.includes(isoWeekKey(NOW))); // la settimana corrente è inclusa
  for (const wk of wks) assert.ok(Object.keys(sh.weeks[wk].dates).length >= 1);
});

test("seed: hydrate non lancia e proietta plan/weeks", () => {
  const mem = hydrate(seedDemoData(NOW));
  assert.ok(mem.plan.length === 3);
  assert.ok(Object.keys(mem.weeks).length === 3);
});

test("isDemoModified: seed fresco = non modificato; con edit = modificato", () => {
  const fresh = seedDemoData(NOW);
  assert.equal(isDemoModified(fresh, NOW), false);
  const edited = structuredClone(fresh);
  const wk = Object.keys(edited.sheets[0].weeks)[0];
  edited.sheets[0].weeks[wk].entries.A = { extraId: { sets: [{ reps: "5", kg: "99", done: true }], note: "" } };
  assert.equal(isDemoModified(edited, NOW), true);
});
