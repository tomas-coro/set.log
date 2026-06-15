import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalStore } from "../local-store.js";

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
}

test("load: store vuoto → emptyData() + version 0", async () => {
  const s = new LocalStore(memStorage());
  const { data, version } = await s.load();
  assert.equal(version, 0);
  assert.deepEqual(data, { updatedAt: null, weeks: {}, plan: [], schema: 5 });
});

test("save poi load: ritorna il blob e incrementa la version", async () => {
  const st = memStorage();
  const s = new LocalStore(st);
  const v1 = await s.save({ schema: 6, sheets: [] }, 0);
  assert.equal(v1, 1);
  const v2 = await s.save({ schema: 6, sheets: [{ id: "x" }] }, v1);
  assert.equal(v2, 2);
  const { data, version } = await s.load();
  assert.equal(version, 2);
  assert.deepEqual(data, { schema: 6, sheets: [{ id: "x" }] });
});

test("costruttore senza storage → errore esplicito", () => {
  assert.throws(() => new LocalStore(null), /storage/);
});
