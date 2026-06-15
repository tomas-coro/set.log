// local-store.js
// Drop-in di SupabaseStore (store.js:312) ma su localStorage: stessa interfaccia
// load()/save() così il pusher (sync.js) lo usa identico. Single-device: niente
// optimistic locking reale, la version è solo un contatore monotòno.
import { emptyData } from "./store.js";

const DEFAULT_KEY = "gymsched_demo_store";

export class LocalStore {
  constructor(storage, key = DEFAULT_KEY) {
    if (!storage) throw new Error("LocalStore richiede uno storage backend");
    this.storage = storage;
    this.key = key;
  }

  // Ritorna { data, version }. Store assente o corrotto → emptyData()+0 (verrà
  // riseminato dal seed-if-absent in bootDemo). Niente fallback silenzioso che
  // "finge": reseed è il comportamento corretto, non un errore nascosto.
  async load() {
    const raw = this.storage.getItem(this.key);
    if (raw == null) return { data: emptyData(), version: 0 };
    const parsed = JSON.parse(raw); // se corrotto, lancia: lo gestisce il chiamante
    return { data: parsed.data, version: parsed.version ?? 0 };
  }

  // Incrementa la version e salva { data, version }. Ritorna newVersion.
  async save(blob, expectedVersion) {
    const next = (Number(expectedVersion) || 0) + 1;
    this.storage.setItem(this.key, JSON.stringify({ data: blob, version: next }));
    return next;
  }
}
