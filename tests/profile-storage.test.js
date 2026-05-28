import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileStorage } from "../profile-storage.js";

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
    _dump: () => Array.from(m.entries()),
  };
}

test("ProfileStorage: chiavi sono prefissate per uid", () => {
  const st = memStorage();
  const ps = new ProfileStorage(st, "user-abc");
  ps.set("data", { foo: 1 });
  assert.equal(st.getItem("gymsched_user_user-abc_data"), JSON.stringify({ foo: 1 }));
});

test("ProfileStorage: get ritorna null se assente", () => {
  const ps = new ProfileStorage(memStorage(), "u1");
  assert.equal(ps.get("dirty"), null);
});

test("ProfileStorage: get parsa JSON", () => {
  const st = memStorage();
  st.setItem("gymsched_user_u1_data", JSON.stringify({ x: 7 }));
  const ps = new ProfileStorage(st, "u1");
  assert.deepEqual(ps.get("data"), { x: 7 });
});

test("ProfileStorage: clear() rimuove solo le chiavi del profilo corrente", () => {
  const st = memStorage();
  st.setItem("gymsched_user_u1_data", "x");
  st.setItem("gymsched_user_u1_dirty", "true");
  st.setItem("gymsched_user_u2_data", "y");
  st.setItem("gymsched_legacy", "z");
  const ps = new ProfileStorage(st, "u1");
  ps.clear();
  assert.equal(st.getItem("gymsched_user_u1_data"), null);
  assert.equal(st.getItem("gymsched_user_u1_dirty"), null);
  assert.equal(st.getItem("gymsched_user_u2_data"), "y");
  assert.equal(st.getItem("gymsched_legacy"), "z");
});

test("ProfileStorage: remove() rimuove una singola chiave", () => {
  const st = memStorage();
  const ps = new ProfileStorage(st, "u1");
  ps.set("data", { x: 1 });
  ps.remove("data");
  assert.equal(ps.get("data"), null);
});
