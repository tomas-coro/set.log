// tests/demo-export.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoExport } from "../demo-export.js";

const NOW = new Date("2026-06-15T10:00:00Z");

test("buildDemoExport: filename datato + JSON valido del blob", () => {
  const blob = { schema: 6, sheets: [{ id: "x", name: "Scheda demo" }] };
  const { filename, json } = buildDemoExport(blob, NOW);
  assert.match(filename, /^set-log-demo-2026-06-15\.json$/);
  assert.deepEqual(JSON.parse(json), blob);
});
