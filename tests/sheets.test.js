// tests/sheets.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS_SCHEMA, defaultSheetName, toSheetsBlob, hydrate, dehydrate } from "../sheets.js";

test("SHEETS_SCHEMA è 6", () => {
  assert.equal(SHEETS_SCHEMA, 6);
});

test("defaultSheetName: progressivo sul numero di schede", () => {
  assert.equal(defaultSheetName([]), "Scheda 1");
  assert.equal(defaultSheetName([{ id: "a", name: "X" }]), "Scheda 2");
  assert.equal(defaultSheetName([{ id: "a" }, { id: "b" }]), "Scheda 3");
});

test("toSheetsBlob: avvolge plan/weeks legacy in Scheda 1", () => {
  const legacy = { schema: 5, updatedAt: "2026-01-01", plan: [{ day: "A", title: "A", exercises: [] }], weeks: { "2026-W01": { label: "W1", entries: {} } } };
  const b = toSheetsBlob(legacy);
  assert.equal(b.schema, 6);
  assert.equal(b.sheets.length, 1);
  assert.equal(b.sheets[0].name, "Scheda 1");
  assert.equal(b.activeSheetId, b.sheets[0].id);
  assert.deepEqual(b.sheets[0].plan, legacy.plan);
  assert.deepEqual(b.sheets[0].weeks, legacy.weeks);
  assert.equal(b.updatedAt, "2026-01-01");
  assert.equal("plan" in b, false);   // normalizzato: niente plan/weeks top-level
  assert.equal("weeks" in b, false);
});

test("toSheetsBlob: idempotente su blob già schema 6", () => {
  const b1 = toSheetsBlob({ schema: 5, plan: [], weeks: {}, updatedAt: null });
  const b2 = toSheetsBlob(b1);
  assert.deepEqual(b2, b1);
});

test("toSheetsBlob: dati vuoti/null → una Scheda 1 vuota", () => {
  const b = toSheetsBlob(null);
  assert.equal(b.sheets.length, 1);
  assert.deepEqual(b.sheets[0].plan, []);
  assert.deepEqual(b.sheets[0].weeks, {});
});

test("toSheetsBlob: activeSheetId orfano → ripiega sulla prima scheda", () => {
  const b = toSheetsBlob({ schema: 6, updatedAt: null, activeSheetId: "ghost", sheets: [{ id: "real", name: "X", plan: [], weeks: {} }] });
  assert.equal(b.activeSheetId, "real");
});

test("hydrate: proietta plan/weeks della scheda attiva al top-level", () => {
  const blob = {
    schema: 6, updatedAt: "t", activeSheetId: "b",
    sheets: [
      { id: "a", name: "A", plan: [{ day: "A" }], weeks: { w1: {} } },
      { id: "b", name: "B", plan: [{ day: "B" }], weeks: { w2: {} } },
    ],
  };
  const d = hydrate(blob);
  assert.deepEqual(d.plan, [{ day: "B" }]);   // scheda attiva = b
  assert.deepEqual(d.weeks, { w2: {} });
  assert.equal(d.activeSheetId, "b");
  assert.equal(d.schema, 6);
  assert.equal(d.sheets.length, 2);
});

test("dehydrate: riscrive plan/weeks top-level nella scheda attiva, normalizza", () => {
  const data = hydrate({
    schema: 6, updatedAt: "t", activeSheetId: "b",
    sheets: [
      { id: "a", name: "A", plan: [{ day: "A" }], weeks: {} },
      { id: "b", name: "B", plan: [], weeks: {} },
    ],
  });
  data.plan = [{ day: "B", title: "nuovo" }];        // simula edit in-memory
  data.weeks = { wX: { label: "wX", entries: {} } };
  const blob = dehydrate(data);
  assert.equal("plan" in blob, false);
  assert.equal("weeks" in blob, false);
  const b = blob.sheets.find((s) => s.id === "b");
  assert.deepEqual(b.plan, [{ day: "B", title: "nuovo" }]);
  assert.deepEqual(b.weeks, { wX: { label: "wX", entries: {} } });
  const a = blob.sheets.find((s) => s.id === "a");
  assert.deepEqual(a.plan, [{ day: "A" }]);          // scheda inattiva intatta
});

test("hydrate∘dehydrate è round-trip stabile", () => {
  const blob = toSheetsBlob({ schema: 5, plan: [{ day: "A" }], weeks: { w: { label: "w", entries: {} } }, updatedAt: "t" });
  assert.deepEqual(dehydrate(hydrate(blob)), blob);
});
