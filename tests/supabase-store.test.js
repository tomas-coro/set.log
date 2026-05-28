import { test } from "node:test";
import assert from "node:assert/strict";
import { SupabaseStore, ConflictError, AuthError } from "../store.js";

// Mock minimale del client Supabase. Le firme replicano quelle usate da SupabaseStore.
function mockClient({ session = { user: { id: "u1" } }, queries = [] } = {}) {
  let queryIdx = 0;
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
    },
    from(table) {
      assert.equal(table, "user_data");
      return {
        select() { return this; },
        eq(col, val) {
          assert.equal(col, "user_id");
          assert.equal(val, session.user.id);
          return this;
        },
        maybeSingle: async () => {
          const next = queries[queryIdx++];
          if (!next) throw new Error("mock: queries esaurite");
          return next;
        },
        update(payload) { this._upd = payload; return this; },
        match(filter) { this._match = filter; return this; },
        select_after_update() { return this; },
      };
    },
  };
}

test("SupabaseStore.load ritorna {data, version} dalla riga utente", async () => {
  const remote = { weeks: { "2026-W22": { label: "1", entries: {} } }, updatedAt: "2026-05-25T10:00:00Z" };
  const client = mockClient({
    queries: [{ data: { data: remote, version: 7 }, error: null }],
  });
  const store = new SupabaseStore(client);
  const result = await store.load();
  assert.deepEqual(result, { data: remote, version: 7 });
});

test("SupabaseStore.load ritorna emptyData quando nessuna riga ancora", async () => {
  const client = mockClient({ queries: [{ data: null, error: null }] });
  const store = new SupabaseStore(client);
  const result = await store.load();
  assert.deepEqual(result, { data: { weeks: {}, updatedAt: null }, version: 0 });
});

test("SupabaseStore.load lancia AuthError quando non c'è sessione", async () => {
  const client = mockClient({ session: null });
  const store = new SupabaseStore(client);
  await assert.rejects(() => store.load(), AuthError);
});
