import { test } from "node:test";
import assert from "node:assert/strict";
import { FRONT_PARTS, BACK_PARTS, BASE_FRONT, BASE_BACK } from "../body-data.js";

test("body-data: parti fronte/retro presenti e con path", () => {
  assert.ok(FRONT_PARTS.length >= 10);
  assert.ok(BACK_PARTS.length >= 10);
  for (const p of [...FRONT_PARTS, ...BACK_PARTS]) {
    assert.ok(p.slug && Array.isArray(p.paths) && p.paths.length >= 1);
  }
  assert.ok(BASE_FRONT.startsWith("M") || BASE_FRONT.startsWith("m"));
  assert.ok(BASE_BACK.startsWith("M") || BASE_BACK.startsWith("m"));
});

test("body-data: le zone chiave della figura esistono", () => {
  const slugs = new Set([...FRONT_PARTS, ...BACK_PARTS].map((p) => p.slug));
  for (const z of ["chest", "abs", "obliques", "biceps", "triceps", "deltoids",
    "trapezius", "upper-back", "lower-back", "quadriceps", "hamstring",
    "gluteal", "adductors", "calves"]) {
    assert.ok(slugs.has(z), `zona mancante: ${z}`);
  }
});
