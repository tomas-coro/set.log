// demo.js
// Lifecycle della modalità demo (ospite locale). Il flag vive in localStorage
// "nudo" (non namespacizzato) perché boot() lo legge PRIMA di sapere chi è
// l'utente. I dati demo vivono sotto ProfileStorage(uid="demo-guest"), isolati.
import { ProfileStorage } from "./profile-storage.js";

export const DEMO_UID = "demo-guest";
const DEMO_FLAG = "gymsched_demo_active";
const DEMO_STORE_KEY = "gymsched_demo_store"; // stessa chiave di LocalStore di default

export function isDemoActive(storage) {
  return storage.getItem(DEMO_FLAG) === "1";
}

export function enterDemo(storage) {
  storage.setItem(DEMO_FLAG, "1");
}

// Teardown completo: flag + store demo + tutte le chiavi del profilo ospite.
// Non tocca MAI le chiavi di un utente reale (namespace diverso).
export function exitDemo(storage) {
  storage.removeItem(DEMO_FLAG);
  storage.removeItem(DEMO_STORE_KEY);
  new ProfileStorage(storage, DEMO_UID).clear();
}
