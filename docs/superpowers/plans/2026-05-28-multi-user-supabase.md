# Multi-utente con Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare gym-schedule da single-tenant (scheda Tomas hardcoded, `data.json` unico, token GitHub condiviso) a multi-utente con signup pubblico via Supabase, preservando offline-first e tutta la logica applicativa (PR, volume per muscolo, prefill, editor).

**Architecture:** Sito statico GitHub Pages invariato. Cambia solo il *trasporto* dei dati: invece di GitHub Contents API, una tabella Supabase `user_data(user_id PK, data jsonb, version, updated_at)` con Row Level Security che isola ogni utente. `SupabaseStore` rimpiazza `GitHubStore` con la stessa interfaccia. localStorage resta SoT in-session (chiavi prefissate per `<uid>`); push debounced al backend con optimistic locking; reconcile via funzione pura `mergeBlobs` su `ConflictError`.

**Tech Stack:** Supabase JS SDK v2 (CDN via esm.sh), Postgres + RLS, JWT auth con email+password, `node --test` (ES modules), service worker (cache bump v30→v31).

**Spec:** `docs/superpowers/specs/2026-05-28-multi-user-supabase-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `supabase-client.js` | **new** | Singleton `createClient(URL, ANON_KEY)`. Solo configurazione. |
| `auth.js` | **new** | UI login/signup/reset. Wrapper testabili attorno a `supabase.auth.*`. Mapping errori in italiano. |
| `profile-storage.js` | **new** | Helper localStorage prefissati per `<uid>`. Funzioni pure. |
| `store.js` | modify | Aggiunge `SupabaseStore` e `mergeBlobs`. `GitHubStore` rimosso solo nel task finale di cut-over. |
| `app.js` | modify | Boot con auth gate; `pushIfDirty()` (sostituisce `saveToCloud`); reconcile on focus; logout. Chiavi localStorage ri-namespacizzate. |
| `index.html` | modify | `<section id="auth-screen">`; import Supabase SDK; ⚙ Impostazioni: rimuovi token, aggiungi Account. |
| `plan.js` | modify | `seedPlan({empty})` per nuovi signup. |
| `sw.js` | modify | Bump `gymsched-v31`, aggiungi nuovi asset, bypass Supabase URL. |
| `README.md` | modify | Riscritto: signup, niente più token GitHub. |
| `tests/supabase-store.test.js` | **new** | Mock fetch su `load`/`save`, error mapping. |
| `tests/store.merge.test.js` | **new** | ~20 casi puri su `mergeBlobs`. |
| `tests/auth.test.js` | **new** | `mapAuthError`, wrapper signIn/signUp con mock client. |
| `tests/profile-storage.test.js` | **new** | Helper localStorage prefissati. |
| `tests/app.push.test.js` | **new** | `pushIfDirty` con `node:test` mock timers. |

---

## Task 0: Setup Supabase project (one-shot, manuale)

**Files:** none (configurazione esterna).

**Cosa fai con le tue mani prima di toccare il codice. Risultato: URL progetto + anon key + tabella creata.**

- [ ] **Step 1: Crea il progetto Supabase**

  1. Vai su https://supabase.com/dashboard.
  2. Sign in (account nuovo o esistente).
  3. *New Project*: nome `gym-schedule`, password DB casuale (salvala in 1password/locale), region più vicina (eu-west).
  4. Aspetta ~2 minuti il provisioning.

- [ ] **Step 2: Copia le credenziali**

  In *Project Settings → API*, copia:
  - **Project URL** (es. `https://abcdef1234.supabase.co`).
  - **anon public** key (la chiave lunga jwt-like, NON la `service_role`).

  Tieni queste due stringhe a portata di mano: serviranno nel Task 1.

- [ ] **Step 3: Crea la tabella + RLS + trigger**

  In *SQL Editor → New query*, incolla ed esegui:

```sql
create table public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{"weeks":{},"updatedAt":null}'::jsonb,
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "own row select" on public.user_data
  for select using (auth.uid() = user_id);

create policy "own row insert" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "own row update" on public.user_data
  for update using (auth.uid() = user_id)
              with check (auth.uid() = user_id);

create or replace function public.user_data_touch() returns trigger as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$ language plpgsql;

create trigger user_data_touch_trg
  before update on public.user_data
  for each row execute function public.user_data_touch();

create or replace function public.on_auth_user_created() returns trigger as $$
begin
  insert into public.user_data (user_id) values (new.id);
  return new;
end $$ language plpgsql security definer;

create trigger on_auth_user_created_trg
  after insert on auth.users
  for each row execute function public.on_auth_user_created();
```

  Atteso: messaggio `Success. No rows returned`.

- [ ] **Step 4: Configura Auth settings**

  In *Authentication → Providers*:
  - **Email**: enabled, *Confirm email* = ON, *Secure email change* = ON.
  - Tutti gli altri provider: disabled.

  In *Authentication → URL Configuration*:
  - **Site URL**: `https://xbacco.github.io/gym-schedule/`
  - **Redirect URLs**: aggiungi `https://xbacco.github.io/gym-schedule/`, `http://localhost:8000/`.

  In *Authentication → Policies → Password*:
  - **Minimum password length**: 8.

- [ ] **Step 5: Verifica RLS smoke test**

  In *SQL Editor*:

```sql
-- Senza login, dovrebbe ritornare 0 righe (anche se la tabella è vuota, deve girare senza errore).
set role anon;
select * from public.user_data;
reset role;
```

  Atteso: 0 righe, nessun errore.

- [ ] **Step 6: Salva le credenziali nel plan**

  Apri `docs/superpowers/plans/2026-05-28-multi-user-supabase.md` e sostituisci `<SUPABASE_URL_HERE>` e `<SUPABASE_ANON_KEY_HERE>` (cerca le occorrenze nel file) con i valori reali. Commit:

```powershell
git -C C:\Users\TomasCoro\gym-schedule add docs/superpowers/plans/2026-05-28-multi-user-supabase.md
git -C C:\Users\TomasCoro\gym-schedule commit -m "chore(plan): inietta credenziali Supabase nel plan"
```

  *Nota:* l'anon key è una chiave pubblica per design (RLS è il gate vero), quindi finire in git è OK.

---

## Task 1: `supabase-client.js` singleton

**Files:**
- Create: `C:\Users\TomasCoro\gym-schedule\supabase-client.js`

- [ ] **Step 1: Crea il file**

```javascript
// Singleton del client Supabase. Importato sia da auth.js sia da store.js.
// L'anon key è pubblica per design: RLS è il vero gate di sicurezza.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "<SUPABASE_URL_HERE>";
const SUPABASE_ANON_KEY = "<SUPABASE_ANON_KEY_HERE>";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // gestisce il redirect del reset password
  },
});
```

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add supabase-client.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(supabase): singleton client con anon key"
```

---

## Task 2: `SupabaseStore.load()` TDD

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\store.js` (in fondo al file, dopo `GitHubStore`)
- Create: `C:\Users\TomasCoro\gym-schedule\tests\supabase-store.test.js`

- [ ] **Step 1: Scrivi il test che fallisce**

  Crea `tests/supabase-store.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test → atteso FAIL (SupabaseStore non esiste)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

  Atteso: errore `SyntaxError` o `SupabaseStore is not defined` o simile.

- [ ] **Step 3: Implementa `SupabaseStore.load()`**

  Aggiungi in fondo a `store.js` (dopo la classe `GitHubStore`):

```javascript
// ---- Supabase persistence (multi-tenant via RLS) ----

export class SupabaseStore {
  constructor(client) {
    if (!client) throw new Error("SupabaseStore richiede un client Supabase");
    this.client = client;
  }

  async _requireSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new AuthError(error.message || "Errore sessione");
    if (!data?.session?.user?.id) throw new AuthError("Nessuna sessione attiva");
    return data.session.user.id;
  }

  // Ritorna { data, version }. Se la riga non esiste ancora ritorna emptyData() + version=0.
  async load() {
    const userId = await this._requireSession();
    const { data: row, error } = await this.client
      .from("user_data")
      .select()
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (error.code === "PGRST301" || error.status === 401 || error.status === 403) {
        throw new AuthError(error.message || "Non autorizzato");
      }
      throw new Error(`Supabase load failed: ${error.message}`);
    }
    if (!row) return { data: emptyData(), version: 0 };
    return { data: row.data, version: row.version };
  }
}
```

- [ ] **Step 4: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

  Atteso: i 3 nuovi test passano. 183 vecchi test invariati.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add store.js tests/supabase-store.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(store): SupabaseStore.load con AuthError"
```

---

## Task 3: `SupabaseStore.save()` happy path TDD

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\store.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\tests\supabase-store.test.js`

- [ ] **Step 1: Aggiungi i test in fondo a `tests/supabase-store.test.js`**

  Rimpiazza il mock con uno più espressivo (sovrascrivi `mockClient`):

```javascript
function mockClient({ session = { user: { id: "u1" } }, loads = [], saves = [] } = {}) {
  let loadIdx = 0, saveIdx = 0;
  return {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    from(table) {
      assert.equal(table, "user_data");
      const builder = {
        _filters: {},
        select() { return this; },
        eq(col, val) { this._filters[col] = val; return this; },
        match(f) { this._filters = { ...this._filters, ...f }; return this; },
        maybeSingle: async () => {
          const next = loads[loadIdx++];
          if (!next) throw new Error("mock: loads esauriti");
          return next;
        },
        update(payload) {
          this._update = payload;
          return this;
        },
        single: async () => {
          const next = saves[saveIdx++];
          if (!next) throw new Error("mock: saves esauriti");
          return next;
        },
        insert(payload) {
          this._insert = payload;
          return this;
        },
      };
      return builder;
    },
  };
}

test("SupabaseStore.save aggiorna riga esistente e ritorna nuova version", async () => {
  const blob = { weeks: { "2026-W22": {} }, updatedAt: "2026-05-25T10:00:00Z" };
  const client = mockClient({
    saves: [{ data: { version: 8 }, error: null, count: 1 }],
  });
  const store = new SupabaseStore(client);
  const newVersion = await store.save(blob, 7);
  assert.equal(newVersion, 8);
});

test("SupabaseStore.save su version=0 fa insert iniziale", async () => {
  const blob = { weeks: {}, updatedAt: null };
  const client = mockClient({
    saves: [{ data: { version: 1 }, error: null, count: 1 }],
  });
  const store = new SupabaseStore(client);
  const newVersion = await store.save(blob, 0);
  assert.equal(newVersion, 1);
});
```

- [ ] **Step 2: Run test → atteso FAIL (`save` non implementato)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Implementa `save()` in `SupabaseStore`**

  Aggiungi il metodo dentro la classe `SupabaseStore` (dopo `load()`):

```javascript
  // Salva il blob con optimistic locking su version. Ritorna newVersion.
  // - expectedVersion = 0  → INSERT (prima save dell'utente)
  // - expectedVersion > 0  → UPDATE con WHERE version = expectedVersion
  // Se l'update tocca 0 righe → ConflictError.
  async save(blob, expectedVersion) {
    const userId = await this._requireSession();
    if (expectedVersion === 0) {
      const { data: row, error } = await this.client
        .from("user_data")
        .upsert({ user_id: userId, data: blob, version: 1 }, { onConflict: "user_id", ignoreDuplicates: false })
        .select("version")
        .single();
      if (error) {
        if (error.status === 401 || error.status === 403) throw new AuthError(error.message);
        throw new Error(`Supabase save (insert) failed: ${error.message}`);
      }
      return row.version;
    }
    const { data: row, error } = await this.client
      .from("user_data")
      .update({ data: blob })
      .match({ user_id: userId, version: expectedVersion })
      .select("version")
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 = "Cannot coerce the result to a single object" → 0 righe
        throw new ConflictError("Conflitto: versione cambiata sul server");
      }
      if (error.status === 401 || error.status === 403) throw new AuthError(error.message);
      throw new Error(`Supabase save failed: ${error.message}`);
    }
    return row.version;
  }
```

- [ ] **Step 4: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add store.js tests/supabase-store.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(store): SupabaseStore.save con optimistic locking"
```

---

## Task 4: `SupabaseStore.save()` error paths TDD

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\tests\supabase-store.test.js`

- [ ] **Step 1: Aggiungi i test in fondo a `tests/supabase-store.test.js`**

```javascript
test("SupabaseStore.save lancia ConflictError su PGRST116 (zero rows)", async () => {
  const client = mockClient({
    saves: [{ data: null, error: { code: "PGRST116", message: "0 rows" } }],
  });
  const store = new SupabaseStore(client);
  await assert.rejects(() => store.save({ weeks: {} }, 5), ConflictError);
});

test("SupabaseStore.save lancia AuthError su 401", async () => {
  const client = mockClient({
    saves: [{ data: null, error: { status: 401, message: "Unauthorized" } }],
  });
  const store = new SupabaseStore(client);
  await assert.rejects(() => store.save({ weeks: {} }, 5), AuthError);
});

test("SupabaseStore.save propaga Error generico su altri fallimenti", async () => {
  const client = mockClient({
    saves: [{ data: null, error: { code: "PGRST500", message: "boom" } }],
  });
  const store = new SupabaseStore(client);
  await assert.rejects(() => store.save({ weeks: {} }, 5), /Supabase save failed/);
});
```

- [ ] **Step 2: Run test → atteso PASS (la logica c'è già dal Task 3)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add tests/supabase-store.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "test(store): error path di SupabaseStore.save"
```

---

## Task 5: `mergeBlobs(local, remote)` TDD

**Files:**
- Create: `C:\Users\TomasCoro\gym-schedule\tests\store.merge.test.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\store.js`

- [ ] **Step 1: Scrivi il test**

  Crea `tests/store.merge.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBlobs } from "../store.js";

const baseBlob = () => ({ weeks: {}, plan: [], updatedAt: null });

function withWeek(blob, wk, entries = {}, dates = {}) {
  return {
    ...blob,
    weeks: { ...blob.weeks, [wk]: { label: wk, entries, dates } },
  };
}

test("mergeBlobs: plan locale vince se differisce dal remoto", () => {
  const local = { ...baseBlob(), plan: [{ day: "A", exercises: [{ id: "x1" }] }] };
  const remote = { ...baseBlob(), plan: [{ day: "A", exercises: [] }] };
  const merged = mergeBlobs(local, remote);
  assert.deepEqual(merged.plan, local.plan);
});

test("mergeBlobs: plan remoto vince se locale ha plan vuoto", () => {
  const local = { ...baseBlob(), plan: [] };
  const remote = { ...baseBlob(), plan: [{ day: "A", exercises: [{ id: "x1" }] }] };
  const merged = mergeBlobs(local, remote);
  assert.deepEqual(merged.plan, remote.plan);
});

test("mergeBlobs: sets — vince quello con più set non-vuoti", () => {
  const wk = "2026-W22";
  const local = withWeek(baseBlob(), wk, {
    A: { "0": { sets: [{ reps: "8", kg: "60", done: true }, { reps: "8", kg: "60", done: true }], note: "" } },
  });
  const remote = withWeek(baseBlob(), wk, {
    A: { "0": { sets: [{ reps: "8", kg: "60", done: true }], note: "" } },
  });
  const merged = mergeBlobs(local, remote);
  assert.equal(merged.weeks[wk].entries.A["0"].sets.length, 2);
});

test("mergeBlobs: sets pareggio → vince per updatedAt più recente top-level", () => {
  const wk = "2026-W22";
  const local = withWeek({ ...baseBlob(), updatedAt: "2026-05-25T10:00:00Z" }, wk, {
    A: { "0": { sets: [{ reps: "8", kg: "60", done: true }], note: "local" } },
  });
  const remote = withWeek({ ...baseBlob(), updatedAt: "2026-05-26T10:00:00Z" }, wk, {
    A: { "0": { sets: [{ reps: "8", kg: "65", done: true }], note: "remote" } },
  });
  const merged = mergeBlobs(local, remote);
  assert.equal(merged.weeks[wk].entries.A["0"].note, "remote");
});

test("mergeBlobs: dates fa union set-if-absent", () => {
  const wk = "2026-W22";
  const local = withWeek(baseBlob(), wk, {}, { A: "2026-05-25" });
  const remote = withWeek(baseBlob(), wk, {}, { B: "2026-05-26" });
  const merged = mergeBlobs(local, remote);
  assert.deepEqual(merged.weeks[wk].dates, { A: "2026-05-25", B: "2026-05-26" });
});

test("mergeBlobs: dates collisione → vince local (set-if-absent + local first)", () => {
  const wk = "2026-W22";
  const local = withWeek(baseBlob(), wk, {}, { A: "2026-05-25" });
  const remote = withWeek(baseBlob(), wk, {}, { A: "2026-05-27" });
  const merged = mergeBlobs(local, remote);
  assert.equal(merged.weeks[wk].dates.A, "2026-05-25");
});

test("mergeBlobs: weeks presenti solo in remote vengono mantenute", () => {
  const local = withWeek(baseBlob(), "2026-W22", { A: { "0": { sets: [], note: "" } } });
  const remote = withWeek(baseBlob(), "2026-W23", { A: { "0": { sets: [], note: "" } } });
  const merged = mergeBlobs(local, remote);
  assert.ok(merged.weeks["2026-W22"]);
  assert.ok(merged.weeks["2026-W23"]);
});

test("mergeBlobs: updatedAt top-level = max(local, remote)", () => {
  const local = { ...baseBlob(), updatedAt: "2026-05-25T10:00:00Z" };
  const remote = { ...baseBlob(), updatedAt: "2026-05-26T11:00:00Z" };
  assert.equal(mergeBlobs(local, remote).updatedAt, "2026-05-26T11:00:00Z");
  assert.equal(mergeBlobs(remote, local).updatedAt, "2026-05-26T11:00:00Z");
});

test("mergeBlobs: immutabile (non muta gli input)", () => {
  const local = withWeek(baseBlob(), "2026-W22", { A: { "0": { sets: [{ reps: "8", kg: "60" }], note: "" } } });
  const remote = withWeek(baseBlob(), "2026-W22", { A: { "0": { sets: [], note: "" } } });
  const localCopy = structuredClone(local);
  const remoteCopy = structuredClone(remote);
  mergeBlobs(local, remote);
  assert.deepEqual(local, localCopy);
  assert.deepEqual(remote, remoteCopy);
});
```

- [ ] **Step 2: Run test → atteso FAIL (`mergeBlobs` non esiste)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Implementa `mergeBlobs` in `store.js`**

  Aggiungi prima della sezione "GitHub Contents API persistence":

```javascript
// ---- Blob merge per reconcile multi-device (funzione pura) ----

function countNonEmptySets(sets) {
  if (!Array.isArray(sets)) return 0;
  return sets.filter((s) => (s?.reps ?? "") !== "" || (s?.kg ?? "") !== "").length;
}

function pickEntry(localEntry, remoteEntry, localUpdatedAt, remoteUpdatedAt) {
  if (!localEntry) return remoteEntry;
  if (!remoteEntry) return localEntry;
  const lSets = countNonEmptySets(localEntry.sets);
  const rSets = countNonEmptySets(remoteEntry.sets);
  if (lSets > rSets) return localEntry;
  if (rSets > lSets) return remoteEntry;
  // Pareggio: vince updatedAt top-level più recente.
  return (remoteUpdatedAt ?? "") > (localUpdatedAt ?? "") ? remoteEntry : localEntry;
}

function mergeWeekEntries(localWeek, remoteWeek, localUpdatedAt, remoteUpdatedAt) {
  const days = new Set([
    ...Object.keys(localWeek?.entries ?? {}),
    ...Object.keys(remoteWeek?.entries ?? {}),
  ]);
  const out = {};
  for (const day of days) {
    const lDay = localWeek?.entries?.[day] ?? {};
    const rDay = remoteWeek?.entries?.[day] ?? {};
    const exIds = new Set([...Object.keys(lDay), ...Object.keys(rDay)]);
    out[day] = {};
    for (const ex of exIds) {
      out[day][ex] = pickEntry(lDay[ex], rDay[ex], localUpdatedAt, remoteUpdatedAt);
    }
  }
  return out;
}

function mergeWeekDates(localDates, remoteDates) {
  // Union set-if-absent: local vince in caso di collisione.
  const out = { ...(remoteDates ?? {}) };
  for (const [day, dt] of Object.entries(localDates ?? {})) {
    if (dt) out[day] = dt;
  }
  return out;
}

export function mergeBlobs(local, remote) {
  const safeLocal = local ?? emptyData();
  const safeRemote = remote ?? emptyData();
  const lUpd = safeLocal.updatedAt;
  const rUpd = safeRemote.updatedAt;

  // Plan: vince local se non vuoto E differente; altrimenti remote.
  const localPlanFilled = Array.isArray(safeLocal.plan) && safeLocal.plan.length > 0;
  const plan = localPlanFilled ? safeLocal.plan : (safeRemote.plan ?? []);

  // Weeks: union per chiave settimana.
  const wkKeys = new Set([
    ...Object.keys(safeLocal.weeks ?? {}),
    ...Object.keys(safeRemote.weeks ?? {}),
  ]);
  const weeks = {};
  for (const wk of wkKeys) {
    const lw = safeLocal.weeks?.[wk];
    const rw = safeRemote.weeks?.[wk];
    weeks[wk] = {
      label: lw?.label ?? rw?.label ?? wk,
      entries: mergeWeekEntries(lw, rw, lUpd, rUpd),
      dates: mergeWeekDates(lw?.dates, rw?.dates),
    };
  }

  const updatedAt = (lUpd ?? "") > (rUpd ?? "") ? lUpd : rUpd;
  return { ...safeRemote, ...safeLocal, plan, weeks, updatedAt };
}
```

- [ ] **Step 4: Run test → atteso PASS (tutti i nuovi test verdi)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add store.js tests/store.merge.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(store): mergeBlobs pura per reconcile multi-device"
```

---

## Task 6: `profile-storage.js` — localStorage prefissato

**Files:**
- Create: `C:\Users\TomasCoro\gym-schedule\profile-storage.js`
- Create: `C:\Users\TomasCoro\gym-schedule\tests\profile-storage.test.js`

- [ ] **Step 1: Scrivi il test**

  Crea `tests/profile-storage.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test → atteso FAIL**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Implementa `profile-storage.js`**

```javascript
// Wrapper di localStorage namespacizzato per utente.
// Tutte le chiavi diventano "gymsched_user_<uid>_<name>".
// JSON-encoded automaticamente.

const PREFIX = "gymsched_user_";

export class ProfileStorage {
  constructor(storage, uid) {
    if (!storage) throw new Error("ProfileStorage richiede uno storage backend");
    if (!uid || typeof uid !== "string") throw new Error("ProfileStorage richiede un uid stringa");
    this.storage = storage;
    this.uid = uid;
    this._prefix = `${PREFIX}${uid}_`;
  }

  _key(name) {
    return `${this._prefix}${name}`;
  }

  get(name) {
    const raw = this.storage.getItem(this._key(name));
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  set(name, value) {
    this.storage.setItem(this._key(name), JSON.stringify(value));
  }

  remove(name) {
    this.storage.removeItem(this._key(name));
  }

  // Rimuove TUTTE le chiavi del profilo corrente (logout).
  clear() {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k && k.startsWith(this._prefix)) keys.push(k);
    }
    for (const k of keys) this.storage.removeItem(k);
  }
}
```

- [ ] **Step 4: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add profile-storage.js tests/profile-storage.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(storage): ProfileStorage namespacizzato per uid"
```

---

## Task 7: `mapAuthError` localizzato + helper auth — TDD

**Files:**
- Create: `C:\Users\TomasCoro\gym-schedule\auth.js`
- Create: `C:\Users\TomasCoro\gym-schedule\tests\auth.test.js`

- [ ] **Step 1: Scrivi il test**

  Crea `tests/auth.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapAuthError, signIn, signUp, resetPassword } from "../auth.js";

test("mapAuthError: invalid_credentials -> messaggio italiano", () => {
  assert.equal(
    mapAuthError({ code: "invalid_credentials", message: "Invalid login credentials" }),
    "Email o password errati."
  );
});

test("mapAuthError: email_not_confirmed", () => {
  assert.equal(
    mapAuthError({ code: "email_not_confirmed" }),
    "Conferma l'email prima di accedere (controlla la posta)."
  );
});

test("mapAuthError: user_already_registered", () => {
  assert.equal(
    mapAuthError({ code: "user_already_registered" }),
    "Questa email è già registrata."
  );
});

test("mapAuthError: codice ignoto -> messaggio generico", () => {
  assert.equal(
    mapAuthError({ code: "wat", message: "boom" }),
    "Errore di autenticazione: boom"
  );
});

test("mapAuthError: null/undefined -> generico", () => {
  assert.equal(mapAuthError(null), "Errore di autenticazione.");
});

test("signIn: ritorna {ok:true, user} su successo", async () => {
  const fakeClient = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        assert.equal(email, "a@b.com");
        assert.equal(password, "secret123");
        return { data: { user: { id: "u1", email } }, error: null };
      },
    },
  };
  const res = await signIn(fakeClient, "a@b.com", "secret123");
  assert.equal(res.ok, true);
  assert.equal(res.user.id, "u1");
});

test("signIn: ritorna {ok:false, error} su fallimento (mappato in italiano)", async () => {
  const fakeClient = {
    auth: {
      signInWithPassword: async () => ({ data: { user: null }, error: { code: "invalid_credentials" } }),
    },
  };
  const res = await signIn(fakeClient, "a@b.com", "x");
  assert.equal(res.ok, false);
  assert.equal(res.error, "Email o password errati.");
});

test("signUp: chiama supabase con emailRedirectTo e ritorna ok su successo", async () => {
  let calledWith = null;
  const fakeClient = {
    auth: {
      signUp: async (args) => { calledWith = args; return { data: { user: { id: "u2" } }, error: null }; },
    },
  };
  const res = await signUp(fakeClient, "x@y.it", "pass1234", "https://app/");
  assert.equal(res.ok, true);
  assert.equal(calledWith.email, "x@y.it");
  assert.equal(calledWith.options.emailRedirectTo, "https://app/");
});

test("resetPassword: chiama resetPasswordForEmail con redirectTo", async () => {
  let calledWith = null;
  const fakeClient = {
    auth: {
      resetPasswordForEmail: async (email, opts) => { calledWith = { email, opts }; return { data: {}, error: null }; },
    },
  };
  const res = await resetPassword(fakeClient, "x@y.it", "https://app/#reset");
  assert.equal(res.ok, true);
  assert.equal(calledWith.email, "x@y.it");
  assert.equal(calledWith.opts.redirectTo, "https://app/#reset");
});
```

- [ ] **Step 2: Run test → atteso FAIL**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Implementa `auth.js` (funzioni pure prima, DOM dopo)**

  Crea `auth.js`:

```javascript
// Wrapper testabili attorno a supabase.auth.*.
// Il rendering DOM (renderAuthScreen) è in fondo e non è coperto da test puri.

const ERR_MAP = {
  invalid_credentials: "Email o password errati.",
  email_not_confirmed: "Conferma l'email prima di accedere (controlla la posta).",
  user_already_registered: "Questa email è già registrata.",
  weak_password: "Password troppo debole (minimo 8 caratteri).",
  over_email_send_rate_limit: "Troppi tentativi. Riprova tra qualche minuto.",
  email_address_invalid: "Indirizzo email non valido.",
};

export function mapAuthError(err) {
  if (!err) return "Errore di autenticazione.";
  if (err.code && ERR_MAP[err.code]) return ERR_MAP[err.code];
  if (err.message) return `Errore di autenticazione: ${err.message}`;
  return "Errore di autenticazione.";
}

export async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true, user: data.user };
}

export async function signUp(client, email, password, redirectTo) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true, user: data.user };
}

export async function resetPassword(client, email, redirectTo) {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true };
}

export async function updatePassword(client, newPassword) {
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true };
}

export async function signOut(client) {
  const { error } = await client.auth.signOut();
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true };
}

export async function resendConfirmation(client, email) {
  const { error } = await client.auth.resend({ type: "signup", email });
  if (error) return { ok: false, error: mapAuthError(error) };
  return { ok: true };
}

// ---- DOM render (browser-only, non testato direttamente) ----
// Implementato nel Task 9 dopo che HTML+CSS sono pronti.
```

- [ ] **Step 4: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add auth.js tests/auth.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(auth): helpers signIn/signUp/reset + mapAuthError italiano"
```

---

## Task 8: Auth screen HTML + CSS

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\index.html`
- Modify: `C:\Users\TomasCoro\gym-schedule\style.css`

- [ ] **Step 1: Aggiungi il blocco HTML dell'auth screen**

  In `index.html`, individua il tag `<body>` di apertura. Subito dopo, prima di tutto il resto del contenuto, aggiungi:

```html
<section id="auth-screen" hidden>
  <div class="auth-card">
    <h1>🏋 scheda-palestra</h1>
    <nav class="auth-tabs">
      <button type="button" data-tab="login" class="auth-tab is-active">Accedi</button>
      <button type="button" data-tab="signup" class="auth-tab">Registrati</button>
    </nav>

    <form id="authForm" class="auth-form">
      <label>
        Email
        <input id="authEmail" type="email" autocomplete="email" required>
      </label>
      <label>
        Password
        <input id="authPassword" type="password" autocomplete="current-password" minlength="8" required>
      </label>
      <button type="submit" id="authSubmit">Entra</button>
      <p id="authError" class="auth-error" hidden></p>
      <p id="authInfo" class="auth-info" hidden></p>
      <button type="button" id="authForgot" class="auth-link">Password dimenticata?</button>
    </form>

    <form id="resetForm" class="auth-form" hidden>
      <p>Inserisci la tua email: ti mando un link per reimpostare la password.</p>
      <label>
        Email
        <input id="resetEmail" type="email" required>
      </label>
      <button type="submit">Invia link</button>
      <button type="button" id="resetBack" class="auth-link">↩ Torna al login</button>
      <p id="resetMsg" class="auth-info" hidden></p>
    </form>

    <form id="newPasswordForm" class="auth-form" hidden>
      <p>Imposta una nuova password.</p>
      <label>
        Nuova password
        <input id="newPassword" type="password" minlength="8" required>
      </label>
      <button type="submit">Aggiorna</button>
      <p id="newPasswordMsg" class="auth-info" hidden></p>
    </form>
  </div>
</section>
```

  E avvolgi tutto il resto del body in `<div id="app" hidden>...</div>` (cerca il primo `<header>` o `<main>` del file e apri il `<div>` prima, chiudilo prima di `</body>`). Questo nasconde l'app finché l'utente non è loggato.

- [ ] **Step 2: Aggiungi gli stili in fondo a `style.css`**

```css
/* ---- Auth screen ---- */
#auth-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg, #111);
  padding: 1rem;
  z-index: 1000;
}
#auth-screen[hidden] { display: none; }

.auth-card {
  width: 100%;
  max-width: 360px;
  padding: 1.5rem;
  border-radius: 12px;
  background: var(--card, #1a1a1a);
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.auth-card h1 { margin: 0 0 1rem; font-size: 1.4rem; text-align: center; }

.auth-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.auth-tab {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border, #333);
  background: transparent;
  color: inherit;
  border-radius: 8px;
  cursor: pointer;
}
.auth-tab.is-active {
  background: var(--accent, #2a7);
  border-color: var(--accent, #2a7);
}

.auth-form { display: flex; flex-direction: column; gap: 0.75rem; }
.auth-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.auth-form input { padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #333); background: var(--bg-input, #0e0e0e); color: inherit; }
.auth-form button[type="submit"] {
  padding: 0.7rem;
  border: none;
  background: var(--accent, #2a7);
  color: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.auth-link {
  background: none;
  border: none;
  color: var(--accent, #2a7);
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  padding: 0;
}
.auth-error { color: #e55; font-size: 0.9rem; margin: 0; }
.auth-info  { color: #6c6; font-size: 0.9rem; margin: 0; }
```

- [ ] **Step 3: Verifica visivamente (manuale)**

  Avvia:

```powershell
cd C:\Users\TomasCoro\gym-schedule
python -m http.server 8765
```

  Apri `http://localhost:8765/` e nel devtools rimuovi temporaneamente `hidden` dall'`#auth-screen` per vedere il rendering. Atteso: card centrata, due tab, form leggibile.

  Ripristina `hidden` quando hai finito.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add index.html style.css
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(ui): schermata login/signup/reset (HTML+CSS)"
```

---

## Task 9: `auth.js` rendering + binding DOM

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\auth.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\index.html`

- [ ] **Step 1: Aggiungi il render DOM in `auth.js`**

  In fondo ad `auth.js`, sostituisci il commento `// ---- DOM render ----` con:

```javascript
// ---- DOM render (browser-only) ----

let _dom = null;

function dom() {
  if (_dom) return _dom;
  _dom = {
    screen: document.getElementById("auth-screen"),
    app: document.getElementById("app"),
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    submit: document.getElementById("authSubmit"),
    error: document.getElementById("authError"),
    info: document.getElementById("authInfo"),
    forgot: document.getElementById("authForgot"),
    tabs: document.querySelectorAll(".auth-tab"),
    resetForm: document.getElementById("resetForm"),
    resetEmail: document.getElementById("resetEmail"),
    resetBack: document.getElementById("resetBack"),
    resetMsg: document.getElementById("resetMsg"),
    newPasswordForm: document.getElementById("newPasswordForm"),
    newPassword: document.getElementById("newPassword"),
    newPasswordMsg: document.getElementById("newPasswordMsg"),
  };
  return _dom;
}

let _mode = "login"; // "login" | "signup"

function setMode(mode) {
  _mode = mode;
  const d = dom();
  d.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === mode));
  d.submit.textContent = mode === "signup" ? "Registrati" : "Entra";
  d.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  d.error.hidden = true;
  d.info.hidden = true;
}

function showError(node, text) {
  node.textContent = text;
  node.hidden = false;
}

function showInfo(node, text) {
  node.textContent = text;
  node.hidden = false;
}

function showAuthScreen() {
  dom().screen.hidden = false;
  dom().app.hidden = true;
}

export function hideAuthScreen() {
  dom().screen.hidden = true;
  dom().app.hidden = false;
}

export function bindAuthScreen(client, { onLoggedIn, redirectTo }) {
  const d = dom();

  // Tab switch.
  d.tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.tab)));

  // Submit login/signup.
  d.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    d.error.hidden = true;
    d.info.hidden = true;
    d.submit.disabled = true;
    try {
      const email = d.email.value.trim();
      const password = d.password.value;
      const res = _mode === "signup"
        ? await signUp(client, email, password, redirectTo)
        : await signIn(client, email, password);
      if (!res.ok) { showError(d.error, res.error); return; }
      if (_mode === "signup") {
        showInfo(d.info, "Ti ho mandato un'email di conferma. Confermala, poi torna qui e fai login.");
      } else {
        onLoggedIn?.(res.user);
      }
    } finally {
      d.submit.disabled = false;
    }
  });

  // Password dimenticata.
  d.forgot.addEventListener("click", () => {
    d.form.hidden = true;
    d.resetForm.hidden = false;
  });
  d.resetBack.addEventListener("click", () => {
    d.resetForm.hidden = true;
    d.form.hidden = false;
  });
  d.resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = d.resetEmail.value.trim();
    const res = await resetPassword(client, email, `${redirectTo}#reset`);
    if (res.ok) showInfo(d.resetMsg, "Email inviata. Controlla la posta.");
    else showError(d.resetMsg, res.error);
  });

  // Nuova password dopo click sul link reset (hash #reset).
  if (location.hash.startsWith("#reset")) {
    d.form.hidden = true;
    d.newPasswordForm.hidden = false;
  }
  d.newPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await updatePassword(client, d.newPassword.value);
    if (res.ok) {
      showInfo(d.newPasswordMsg, "Password aggiornata. Sto entrando...");
      location.hash = "";
      onLoggedIn?.();
    } else {
      showError(d.newPasswordMsg, res.error);
    }
  });

  return { showAuthScreen };
}
```

- [ ] **Step 2: Aggiungi gli import all'`index.html`**

  Cerca lo `<script type="module" src="./app.js"></script>` in fondo al body. Sostituiscilo con:

```html
<script type="module" src="./app.js"></script>
```

  (Resta uguale; auth.js viene importato da app.js nel Task 10, non separatamente.)

- [ ] **Step 3: Smoke test manuale**

```powershell
cd C:\Users\TomasCoro\gym-schedule
python -m http.server 8765
```

  Apri `http://localhost:8765`, devtools console:

```javascript
const { bindAuthScreen } = await import("./auth.js");
const { supabase } = await import("./supabase-client.js");
document.getElementById("auth-screen").hidden = false;
bindAuthScreen(supabase, { redirectTo: location.origin + location.pathname, onLoggedIn: (u) => console.log("login!", u) });
```

  Clic sui tab → toggle visivo. Submit con email casuale → vedi error message.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add auth.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(auth): binding DOM per login/signup/reset/new-password"
```

---

## Task 10: Boot integration — auth gate in `app.js`

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`

- [ ] **Step 1: Aggiungi gli import in cima ad `app.js`**

  Trova il blocco import iniziale (intorno alle prime 10 righe). Subito dopo gli import esistenti, aggiungi:

```javascript
import { supabase } from "./supabase-client.js";
import { bindAuthScreen, hideAuthScreen, signOut } from "./auth.js";
import { ProfileStorage } from "./profile-storage.js";
```

  E modifica l'import di `store.js`: aggiungi `SupabaseStore, mergeBlobs`:

```javascript
import {
  GitHubStore, SupabaseStore, mergeBlobs, ConflictError, AuthError,
  // ...resto invariato
} from "./store.js";
```

- [ ] **Step 2: Aggiungi le variabili globali per il nuovo state**

  Vicino alle altre variabili globali in cima al file (dove c'è `let store = null;`, `let data = ...`, etc.) aggiungi:

```javascript
let session = null;        // { user: {id, email}, ... } da Supabase
let profileStorage = null; // ProfileStorage per la sessione corrente
let dataVersion = 0;       // optimistic lock version (sostituisce 'sha')
```

- [ ] **Step 3: Sostituisci il boot finale del file**

  Trova `window.addEventListener("load", () => {...})` in fondo. Sostituisci tutto il blocco di boot esistente con:

```javascript
async function boot() {
  // 1. Verifica sessione.
  const { data: sessionData } = await supabase.auth.getSession();
  session = sessionData.session;

  // 2. Bind dell'auth screen (idempotente, basta una volta).
  bindAuthScreen(supabase, {
    redirectTo: location.origin + location.pathname,
    onLoggedIn: () => location.reload(),
  });

  if (!session) {
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("app").hidden = true;
    return;
  }

  // 3. Sessione attiva → mostra app, inizializza store.
  hideAuthScreen();
  profileStorage = new ProfileStorage(localStorage, session.user.id);
  store = new SupabaseStore(supabase);

  // 4. Carica dati: prima da localStorage (mostra subito), poi da remote.
  const cached = profileStorage.get("data");
  if (cached) {
    data = cached;
    dataVersion = profileStorage.get("version") || 0;
    render();
  }

  try {
    const remote = await store.load();
    if (cached && profileStorage.get("dirty")) {
      // Locale dirty → merge + push.
      const merged = mergeBlobs(cached, remote.data);
      dataVersion = await store.save(merged, remote.version);
      data = merged;
      profileStorage.set("data", data);
      profileStorage.set("version", dataVersion);
      profileStorage.set("dirty", false);
    } else if (!cached || remote.version > (profileStorage.get("version") || 0)) {
      data = remote.data;
      dataVersion = remote.version;
      profileStorage.set("data", data);
      profileStorage.set("version", dataVersion);
    }
    // Backfill schema sui dati appena letti (riusa logica esistente).
    data = backfillMuscles(migrate(data), PLAN);
    render();
    setStatus("ok ✓", "ok");
  } catch (err) {
    if (err instanceof AuthError) {
      // Sessione invalidata: logout pulito.
      await signOut(supabase);
      location.reload();
      return;
    }
    setStatus("offline ⧗", "pending");
  }

  // 5. Listener auth changes (es. logout da altra tab).
  supabase.auth.onAuthStateChange((_event, newSession) => {
    if (!newSession && session) {
      // Logout
      profileStorage?.clear();
      location.reload();
    }
  });

  // 6. Reconcile on visibility change (telefono+PC).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reconcileFromRemote().catch(() => {});
    }
  });
}

async function reconcileFromRemote() {
  if (!store || !session) return;
  try {
    const remote = await store.load();
    if (remote.version === dataVersion) return; // nessun cambio
    const merged = mergeBlobs(data, remote.data);
    dataVersion = await store.save(merged, remote.version);
    data = merged;
    profileStorage.set("data", data);
    profileStorage.set("version", dataVersion);
    render();
  } catch (err) {
    if (err instanceof ConflictError) {
      // Race: ritenta una volta.
      return reconcileFromRemote();
    }
  }
}

window.addEventListener("load", boot);
```

  *Nota:* `render()` e `setStatus()` esistono già in `app.js`. `PLAN` e `migrate` sono i nomi già importati. Mantieni il resto della funzione di boot precedente (es. `addEventListener("click", saveExDialog)` ecc.) se serve — sposta i listener dentro `boot()` dopo `hideAuthScreen()`.

- [ ] **Step 4: Verifica manuale**

```powershell
cd C:\Users\TomasCoro\gym-schedule
python -m http.server 8765
```

  Apri http://localhost:8765 in incognito. Atteso:
  - Vedi l'auth screen (app nascosta).
  - Fai signup con un'email reale → ricevi mail di conferma.
  - Conferma → torna sull'app → fai login → vedi app vuota.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add app.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(app): auth gate Supabase + boot reconcile"
```

---

## Task 11: `pushIfDirty()` con debounce + retry/backoff — TDD

**Files:**
- Create: `C:\Users\TomasCoro\gym-schedule\tests\app.push.test.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`

*Nota:* `pushIfDirty` e la sua logica di debounce/backoff vengono estratte come **funzione pura** importabile da test, in un nuovo modulo o in fondo ad `app.js`. Visto che `app.js` è già grande, la mettiamo in un piccolo modulo nuovo `sync.js`.

**File aggiuntivo:** `C:\Users\TomasCoro\gym-schedule\sync.js`

- [ ] **Step 1: Scrivi il test**

  Crea `tests/app.push.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test → atteso FAIL (`sync.js` non esiste)**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Implementa `sync.js`**

  Crea `C:\Users\TomasCoro\gym-schedule\sync.js`:

```javascript
// createPusher: orchestratore di debounce + retry/backoff per push verso lo store.
// Indipendente dal DOM, testabile con mock.timers di node:test.

export function createPusher({
  getData,
  getVersion,
  setVersion,
  setDirty,
  store,
  debounceMs = 2000,
  backoffSchedule = [10000, 30000, 60000, 60000, 60000],
  onConflict = null,       // async (err) => void (chiamato per ConflictError)
  onAuthError = null,      // async (err) => void
  onStatus = null,         // (state) => void: "pending"|"ok"|"error"
}) {
  let debounceHandle = null;
  let backoffHandle = null;
  let backoffIdx = 0;
  let inflight = false;

  async function attemptOnce() {
    if (inflight) return;
    inflight = true;
    try {
      const newVersion = await store.save(getData(), getVersion());
      setVersion(newVersion);
      setDirty(false);
      backoffIdx = 0;
      onStatus?.("ok");
    } catch (err) {
      onStatus?.("error");
      if (err && err.name === "ConflictError") {
        await onConflict?.(err);
        return;
      }
      if (err && err.name === "AuthError") {
        await onAuthError?.(err);
        return;
      }
      // Network/altro: schedula backoff.
      const delay = backoffSchedule[Math.min(backoffIdx, backoffSchedule.length - 1)];
      backoffIdx++;
      clearTimeout(backoffHandle);
      backoffHandle = setTimeout(attemptOnce, delay);
    } finally {
      inflight = false;
    }
  }

  return {
    schedule() {
      clearTimeout(debounceHandle);
      onStatus?.("pending");
      debounceHandle = setTimeout(attemptOnce, debounceMs);
    },
    async flush() {
      clearTimeout(debounceHandle);
      clearTimeout(backoffHandle);
      await attemptOnce();
    },
    cancel() {
      clearTimeout(debounceHandle);
      clearTimeout(backoffHandle);
      backoffIdx = 0;
    },
  };
}
```

- [ ] **Step 4: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 5: Integra in `app.js`**

  Aggiungi l'import:

```javascript
import { createPusher } from "./sync.js";
```

  Dentro `boot()`, dopo aver inizializzato `store` e `profileStorage`, crea il pusher e tieni il riferimento globale:

```javascript
pusher = createPusher({
  getData: () => data,
  getVersion: () => dataVersion,
  setVersion: (v) => { dataVersion = v; profileStorage.set("version", v); },
  setDirty: (d) => profileStorage.set("dirty", d),
  store,
  onConflict: async () => {
    const remote = await store.load();
    const merged = mergeBlobs(data, remote.data);
    dataVersion = await store.save(merged, remote.version);
    data = merged;
    profileStorage.set("data", data);
    profileStorage.set("version", dataVersion);
    profileStorage.set("dirty", false);
    render();
  },
  onAuthError: async () => { await signOut(supabase); location.reload(); },
  onStatus: (s) => setStatus({pending:"sincronizzo ⧗",ok:"ok ✓",error:"offline ⧗"}[s], s),
});
```

  Aggiungi anche `let pusher = null;` in cima al file vicino alle altre globali.

  **Sostituisci tutte le chiamate a `saveToCloud()`** (cerca con: `Select-String -Path C:\Users\TomasCoro\gym-schedule\app.js -Pattern "saveToCloud"`) con:

```javascript
profileStorage.set("data", data);
profileStorage.set("dirty", true);
pusher.schedule();
```

  Rimuovi la vecchia funzione `saveToCloud()` (intorno alle righe 1807-1840).

  Aggiungi al `visibilitychange` listener un flush prima del reconcile quando passa a "hidden":

```javascript
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pusher?.flush().catch(() => {});
  } else {
    reconcileFromRemote().catch(() => {});
  }
});
```

- [ ] **Step 6: Smoke test manuale**

  Apri l'app loggato, logga un set, in devtools verifica:
  - dopo ~2s vedi network call PATCH a Supabase.
  - `localStorage.getItem("gymsched_user_<uid>_dirty")` torna `"false"`.

- [ ] **Step 7: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add sync.js app.js tests/app.push.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(sync): createPusher con debounce+backoff, integrato in app"
```

---

## Task 12: Migrazione storico Tomas — dialog + import

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\index.html`

- [ ] **Step 1: Aggiungi il dialog HTML**

  In `index.html` dentro `<div id="app">`, aggiungi prima della chiusura:

```html
<dialog id="seedDialog">
  <form method="dialog">
    <h2>📦 Importa scheda demo?</h2>
    <p id="seedSummary"></p>
    <p>Vuoi partire da questa o da zero?</p>
    <menu>
      <button type="submit" value="empty">Parto da zero</button>
      <button type="submit" value="import" autofocus>Importa</button>
    </menu>
  </form>
</dialog>
```

- [ ] **Step 2: Aggiungi la logica in `app.js`**

  Dopo la funzione `boot()` aggiungi:

```javascript
const SEED_URL = "https://xbacco.github.io/gym-schedule/data.json";

async function offerSeedIfEmpty() {
  if (!data || (data.weeks && Object.keys(data.weeks).length > 0)) return;
  try {
    const res = await fetch(SEED_URL, { cache: "no-store" });
    if (!res.ok) return;
    const seed = await res.json();
    const wkKeys = Object.keys(seed.weeks || {}).sort();
    if (wkKeys.length === 0) return;
    const summary = document.getElementById("seedSummary");
    summary.textContent = `Trovata scheda demo con ${wkKeys.length} settimane (${wkKeys[0]} → ${wkKeys[wkKeys.length-1]}).`;
    const dlg = document.getElementById("seedDialog");
    dlg.showModal();
    await new Promise((r) => dlg.addEventListener("close", r, { once: true }));
    if (dlg.returnValue === "import") {
      data = backfillMuscles(migrate(seed), PLAN);
      profileStorage.set("data", data);
      profileStorage.set("dirty", true);
      pusher.schedule();
      render();
    }
  } catch {
    // network error: ignora, l'utente parte vuoto
  }
}
```

  In `boot()`, dopo il primo `render()` di successo, aggiungi:

```javascript
  await offerSeedIfEmpty();
```

- [ ] **Step 3: Smoke test manuale**

  Logga in un account nuovo (email diversa dalla prima usata). Atteso: vedi il dialog "Importa scheda demo?" con N settimane dal `data.json` pubblico. Click "Parto da zero" → app vuota. Logout, crea altro account, ripeti, click "Importa" → vedi tutto il tuo storico.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add app.js index.html
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(app): dialog di import seed demo per nuovi account"
```

---

## Task 13: Logout + Account section in ⚙

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\index.html`
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`

- [ ] **Step 1: Trova la sezione ⚙ Impostazioni esistente**

  In `index.html` cerca `id="settingsDialog"` (o nome simile). Identifica il blocco "Token GitHub".

- [ ] **Step 2: Rimuovi il blocco token GitHub e aggiungi Account**

  Rimpiazza il blocco token con:

```html
<section class="settings-section">
  <h3>Account</h3>
  <p>Loggato come <strong id="accountEmail">…</strong></p>
  <button type="button" id="btnLogout">Esci</button>
  <button type="button" id="btnImportDemo">Importa scheda demo</button>
</section>
```

  *Nota:* il bottone "Importa scheda demo" forza un re-import del seed anche se l'utente ha già dati (chiede conferma).

- [ ] **Step 3: Aggiungi i binding in `app.js`**

  Dentro `boot()` (dopo `hideAuthScreen()`):

```javascript
document.getElementById("accountEmail").textContent = session.user.email;
document.getElementById("btnLogout").addEventListener("click", async () => {
  if (!confirm("Esci dall'account? I dati locali verranno cancellati (restano salvati nel cloud).")) return;
  await pusher?.flush().catch(() => {});
  profileStorage?.clear();
  await signOut(supabase);
  location.reload();
});
document.getElementById("btnImportDemo").addEventListener("click", async () => {
  if (!confirm("Sovrascrivere i dati attuali con la scheda demo?")) return;
  // forza il dialog di import
  data = { weeks: {}, updatedAt: null }; // simula stato vuoto solo per la durata dell'offer
  await offerSeedIfEmpty();
});
```

- [ ] **Step 4: Smoke test manuale**

  Apri ⚙, atteso: vedi email + bottoni. Click "Esci" → conferma → torni alla schermata login.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add index.html app.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(settings): sezione Account con logout e re-import demo"
```

---

## Task 14: `plan.js` — `seedPlan({empty})`

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\plan.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\tests\plan.test.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`

- [ ] **Step 1: Scrivi il test**

  In `tests/plan.test.js` aggiungi in fondo:

```javascript
import { seedPlan } from "../plan.js";

test("seedPlan({empty:true}) ritorna plan vuoto []", () => {
  assert.deepEqual(seedPlan({ empty: true }), []);
});

test("seedPlan() default ritorna la variante 'Consigliata+'", () => {
  const p = seedPlan();
  assert.equal(p.length, 3);
  assert.equal(p.find((d) => d.day === "C").exercises.length, 9);
});
```

- [ ] **Step 2: Run test → atteso FAIL**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 3: Aggiungi `seedPlan` in `plan.js`**

  `plan.js` oggi esporta `export const PLAN = [ {day: "A", ...}, ... ];` (riga 4). Mantieni `PLAN` (usato altrove come default plan dell'editor) e aggiungi `seedPlan` come export aggiuntivo in fondo al file:

```javascript
export function seedPlan({ empty = false } = {}) {
  return empty ? [] : PLAN;
}
```

  Niente refactor di `PLAN`: resta `export const`.

- [ ] **Step 4: Usa `seedPlan({empty})` per nuovi signup in `app.js`**

  Nel boot, quando crei dati per la prima volta (riga `if (!cached)`) usa:

```javascript
data = { weeks: {}, plan: seedPlan({ empty: true }), updatedAt: null };
```

  Aggiungi l'import in cima:

```javascript
import { PLAN, seedPlan } from "./plan.js";
```

  (Se `seedPlan` non era importato prima.)

- [ ] **Step 5: Run test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add plan.js tests/plan.test.js app.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "feat(plan): seedPlan({empty}) per nuovi signup"
```

---

## Task 15: Service worker — bump v31 + asset list

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\sw.js`

- [ ] **Step 1: Apri `sw.js` e individua la versione cache**

  Cerca `gymsched-v30` (o simile).

- [ ] **Step 2: Aggiorna versione e asset list**

  Sostituisci:

```javascript
const CACHE = "gymsched-v31";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./editor.js",
  "./plan.js",
  "./session.js",
  "./store.js",
  "./nutrition.js",
  "./timer.js",
  "./wakelock.js",
  "./manifest.json",
  "./icon.svg",
  "./supabase-client.js",
  "./auth.js",
  "./profile-storage.js",
  "./sync.js",
];
```

  Verifica che il fetch handler **non** intercetti URL di Supabase. Se l'attuale handler è del tipo "cache-first solo per same-origin", è già a posto: Supabase è altra origine. Se invece intercetta tutto, aggiungi all'inizio del fetch handler:

```javascript
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // ...resto del handler
});
```

- [ ] **Step 3: Test cache update**

```powershell
cd C:\Users\TomasCoro\gym-schedule
python -m http.server 8765
```

  Apri http://localhost:8765 in incognito. In devtools → Application → Service Workers, atteso: nuova versione `gymsched-v31` installata.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add sw.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "chore(sw): bump cache gymsched-v31 (Supabase)"
```

---

## Task 16: XSS audit

**Files:**
- Modify (eventualmente): `C:\Users\TomasCoro\gym-schedule\app.js`, `editor.js`

- [ ] **Step 1: Sweep delle `innerHTML` su input utente**

```powershell
Select-String -Path C:\Users\TomasCoro\gym-schedule\*.js -Pattern "innerHTML" -List
```

  Per ogni occorrenza, leggi il contesto: la stringa assegnata contiene **solo** template literals controllati (no user input)? Oppure ci finisce dentro `exercise.name`, `entry.note`, `comment`, ecc.?

- [ ] **Step 2: Per ogni occorrenza che include user input**

  Sostituisci con `textContent` quando possibile. Se serve HTML strutturato + testo utente, usa un templating manuale come:

```javascript
const node = document.createElement("div");
node.className = "ex";
const name = document.createElement("strong");
name.textContent = exercise.name;
node.appendChild(name);
```

  oppure setta `innerHTML` con solo la struttura, poi `textContent` sui placeholder:

```javascript
node.innerHTML = `<strong class="exName"></strong>`;
node.querySelector(".exName").textContent = exercise.name;
```

- [ ] **Step 3: Verifica con un test "esercizio chiamato `<img src=x onerror=alert(1)>`"**

  Manualmente in app: rinomina un esercizio con quella stringa, ricarica, atteso: nessun alert, vedi la stringa renderizzata come testo.

- [ ] **Step 4: Commit (solo se fatti cambiamenti)**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add app.js editor.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "fix(xss): textContent su nomi/note esercizio user-input"
```

  Se nessun cambiamento serve (gia tutto safe), commit dummy con log dell'audit:

```powershell
git -C C:\Users\TomasCoro\gym-schedule commit --allow-empty -m "chore(security): audit XSS — no changes needed"
```

---

## Task 17: Cut-over — rimuovi `GitHubStore` e UI token

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\store.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\app.js`
- Modify: `C:\Users\TomasCoro\gym-schedule\index.html`
- Modify: `C:\Users\TomasCoro\gym-schedule\tests\store.test.js`

*Prerequisito:* la tua migrazione (Tomas) deve essere già completata in produzione. Verifica:

```powershell
# In browser console su https://xbacco.github.io/gym-schedule/ loggato col tuo account:
# JSON.parse(localStorage.getItem("gymsched_user_<TUO-UID>_data")).weeks |> Object.keys
# Atteso: lista di settimane con il tuo storico.
```

- [ ] **Step 1: Rimuovi `GitHubStore` da `store.js`**

  Cancella tutta la classe `GitHubStore` (righe ~197-251). Mantieni `ConflictError`, `AuthError`, `toBase64`, `fromBase64`.

- [ ] **Step 2: Rimuovi import di `GitHubStore` da `app.js`**

  Cerca `GitHubStore` in `app.js` e rimuovilo dall'import. Dovrebbero non esserci altri usi (sostituiti dal SupabaseStore).

- [ ] **Step 3: Rimuovi i test integrazione legacy**

  Apri `tests/store.test.js` e rimuovi i test che usano `GitHubStore` (se ce ne sono — basati sul `Grep` su `GitHubStore` in tests/). Mantieni tutto il resto.

```powershell
Select-String -Path C:\Users\TomasCoro\gym-schedule\tests\*.test.js -Pattern "GitHubStore"
```

  Cancella i test che usano la classe.

- [ ] **Step 4: Run tutti i test → atteso PASS**

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
```

  Atteso: 195+ test verdi.

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add store.js app.js tests/store.test.js
git -C C:\Users\TomasCoro\gym-schedule commit -m "refactor: dismetti GitHubStore (cut-over a Supabase completato)"
```

---

## Task 18: README aggiornato

**Files:**
- Modify: `C:\Users\TomasCoro\gym-schedule\README.md`

- [ ] **Step 1: Riscrivi il README**

  Sostituisci tutto il contenuto con:

```markdown
# gym-schedule

Web app per la scheda di allenamento: log carico/reps per settimana, sync cross-device,
timer di recupero, multi-utente con account email + password.

## Come funziona
- Sito statico su **GitHub Pages**.
- Backend: **Supabase** (Postgres + Auth, free tier).
- Ogni utente ha un account. I dati sono privati e isolati via Row Level Security.
- Offline-first: in palestra l'app funziona senza segnale, sync al rientro.

## Setup utente
1. Apri https://xbacco.github.io/gym-schedule/
2. *Registrati* con email + password (min 8 char).
3. Conferma l'email tramite il link che ricevi.
4. Login → editor scheda vuoto, costruisci la tua.

## Sviluppo locale

```bash
npm test                    # 195+ test
python -m http.server 8765  # server statico
# poi apri http://localhost:8765
```

I file `supabase-client.js` contengono URL + anon key del progetto Supabase
(pubblici per design, RLS è il vero gate). Per uno sviluppo isolato crea un tuo
progetto Supabase ed esegui lo schema in `docs/superpowers/specs/2026-05-28-multi-user-supabase-design.md`.

## Architettura
Vedi `docs/superpowers/specs/2026-05-28-multi-user-supabase-design.md` per lo spec
completo e `docs/superpowers/plans/2026-05-28-multi-user-supabase.md` per il piano
di implementazione.
```

- [ ] **Step 2: Commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule add README.md
git -C C:\Users\TomasCoro\gym-schedule commit -m "docs(readme): aggiorna per multi-utente Supabase"
```

---

## Task 19: Push e verifica end-to-end in produzione

**Files:** none

- [ ] **Step 1: Push di tutti i commit**

```powershell
git -C C:\Users\TomasCoro\gym-schedule push
```

- [ ] **Step 2: Aspetta deploy GitHub Pages (~1-2 min)**

- [ ] **Step 3: Test E2E in produzione**

  In browser pulito (incognito):
  1. https://xbacco.github.io/gym-schedule/ → vedi auth screen.
  2. Signup con email reale di prova → ricevi mail.
  3. Conferma → torni sull'app loggato.
  4. Vedi dialog "Importa demo?" → clic "Parto da zero" → app vuota.
  5. Apri editor → crea giornata A con un esercizio.
  6. Logga un set.
  7. Aspetta 3 secondi → vedi `setStatus` = "ok ✓".
  8. Apri Supabase dashboard → Table Editor → `user_data` → vedi la tua riga con `data.weeks` valorizzato.
  9. Logout.
  10. Login col tuo account "Tomas" reale → "Importa demo" → vedi storico.
  11. Vai su un altro device → login → vedi gli stessi dati.

- [ ] **Step 4: Memo update**

  Aggiorna `gym-schedule-phases.md` con il nuovo lotto (multi-utente Supabase), bumpando HEAD e conteggio test.

---

## Verifica finale

```powershell
npm --prefix C:\Users\TomasCoro\gym-schedule test
git -C C:\Users\TomasCoro\gym-schedule log --oneline -20
git -C C:\Users\TomasCoro\gym-schedule status
```

Atteso:
- Test: 195-200 passati, 0 falliti.
- Log: 19 nuovi commit oltre al design doc.
- Working tree: clean.
