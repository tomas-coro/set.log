import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemoActive, enterDemo, exitDemo, DEMO_UID } from "../demo.js";

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

test("demo non attiva di default", () => {
  assert.equal(isDemoActive(memStorage()), false);
});

test("enterDemo attiva il flag, persiste a un reload simulato", () => {
  const st = memStorage();
  enterDemo(st);
  assert.equal(isDemoActive(st), true); // sopravvive: il flag resta in storage
});

test("exitDemo pulisce flag, store demo e namespace ospite", () => {
  const st = memStorage();
  enterDemo(st);
  st.setItem("gymsched_demo_store", "{}");
  st.setItem(`gymsched_user_${DEMO_UID}_data`, "{}");
  st.setItem("gymsched_user_REALUID_data", "{}"); // dati veri: NON toccare
  exitDemo(st);
  assert.equal(isDemoActive(st), false);
  assert.equal(st.getItem("gymsched_demo_store"), null);
  assert.equal(st.getItem(`gymsched_user_${DEMO_UID}_data`), null);
  assert.equal(st.getItem("gymsched_user_REALUID_data"), "{}"); // intatto
});
