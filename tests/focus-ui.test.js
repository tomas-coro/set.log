import { test } from "node:test";
import assert from "node:assert/strict";
import { actionBarSpec } from "../focus-ui.js";

test("actionBarSpec: serie in corso → 4 pulsanti nell'ordine giusto", () => {
  const keys = actionBarSpec({ allDone: false, drawerOpen: false }).map((b) => b.key);
  assert.deepEqual(keys, ["rest", "comment", "fail", "more"]);
});

test("actionBarSpec: esercizio completato → solo recupero e altro", () => {
  const keys = actionBarSpec({ allDone: true, drawerOpen: false }).map((b) => b.key);
  assert.deepEqual(keys, ["rest", "more"]);
});

test("actionBarSpec: drawerOpen marca attivo il pulsante 'more'", () => {
  const open = actionBarSpec({ allDone: false, drawerOpen: true });
  const closed = actionBarSpec({ allDone: false, drawerOpen: false });
  assert.equal(open.find((b) => b.key === "more").active, true);
  assert.equal(closed.find((b) => b.key === "more").active, false);
});

test("actionBarSpec: ogni pulsante ha glyph e label non vuoti", () => {
  for (const b of actionBarSpec({ allDone: false, drawerOpen: false })) {
    assert.ok(b.glyph && b.label, `manca glyph/label per ${b.key}`);
  }
});
