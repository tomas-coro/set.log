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
