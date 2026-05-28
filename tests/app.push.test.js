import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createPusher } from "../sync.js";

function fakeStore(saveImpl) {
  return { save: saveImpl };
}

test("pusher: dopo schedule() debounce 2000ms chiama save una sola volta", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const store = fakeStore(async () => { calls++; return 8; });
  const pusher = createPusher({
    getData: () => ({ x: 1 }),
    getVersion: () => 7,
    setVersion: () => {},
    setDirty: () => {},
    store,
    debounceMs: 2000,
  });
  pusher.schedule();
  pusher.schedule();
  pusher.schedule();
  assert.equal(calls, 0);
  mock.timers.tick(1999);
  assert.equal(calls, 0);
  mock.timers.tick(2);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  mock.timers.reset();
});

test("pusher: su error di rete ritenta con backoff 10s, 30s, 60s", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const store = fakeStore(async () => {
    calls++;
    if (calls < 3) throw new Error("network");
    return 9;
  });
  const pusher = createPusher({
    getData: () => ({}),
    getVersion: () => 1,
    setVersion: () => {},
    setDirty: () => {},
    store,
    debounceMs: 0,
    backoffSchedule: [10000, 30000, 60000],
  });
  pusher.schedule();
  mock.timers.tick(1);
  await new Promise((r) => setImmediate(r)); // call 1: fail
  assert.equal(calls, 1);
  mock.timers.tick(10000);
  await new Promise((r) => setImmediate(r)); // call 2: fail
  assert.equal(calls, 2);
  mock.timers.tick(30000);
  await new Promise((r) => setImmediate(r)); // call 3: success
  assert.equal(calls, 3);
  mock.timers.reset();
});

test("pusher: flush() forza push immediato annullando debounce", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const store = fakeStore(async () => { calls++; return 2; });
  const pusher = createPusher({
    getData: () => ({}),
    getVersion: () => 1,
    setVersion: () => {},
    setDirty: () => {},
    store,
    debounceMs: 2000,
  });
  pusher.schedule();
  await pusher.flush();
  assert.equal(calls, 1);
  mock.timers.reset();
});
