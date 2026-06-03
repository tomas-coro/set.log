// sheets.js
// ---- Modello multi-scheda (puro, testabile in Node). Opera su BLOB NORMALIZZATI:
//      { schema:6, updatedAt, activeSheetId, sheets:[{ id, name, plan, weeks }] }.
//      hydrate/dehydrate traducono da/verso la forma in-memory usata da app.js. ----
import { genId } from "./editor.js";

export const SHEETS_SCHEMA = 6;

// Nome di default "Scheda N", progressivo sul numero di schede esistenti.
// L'utente può rinominare in qualsiasi momento (renameSheet).
export function defaultSheetName(sheets) {
  return `Scheda ${(Array.isArray(sheets) ? sheets.length : 0) + 1}`;
}

// Coercizione a blob normalizzato schema 6. Idempotente. Gestisce:
// - legacy schema <6: avvolge { plan, weeks } in un'unica "Scheda 1";
// - già schema 6: clona, ripara activeSheetId orfano, garantisce sheets non vuoto;
// - null/undefined: una Scheda 1 vuota.
export function toSheetsBlob(input) {
  const data = input || {};
  // schema >= 6 (non ===): un eventuale schema futuro mantiene i suoi sheets,
  // ri-etichettato a 6, senza perdere dati. Niente downgrade distruttivo.
  if (data.schema >= SHEETS_SCHEMA && Array.isArray(data.sheets)) {
    const out = structuredClone(data);
    if (!out.sheets.length) {
      out.sheets = [{ id: genId([]), name: defaultSheetName([]), plan: [], weeks: {} }];
    }
    const ids = out.sheets.map((s) => s.id);
    if (!ids.includes(out.activeSheetId)) out.activeSheetId = out.sheets[0].id;
    out.schema = SHEETS_SCHEMA;
    return out;
  }
  const id = genId([]);
  return {
    schema: SHEETS_SCHEMA,
    updatedAt: data.updatedAt ?? null,
    activeSheetId: id,
    sheets: [{
      id,
      name: defaultSheetName([]),
      plan: Array.isArray(data.plan) ? structuredClone(data.plan) : [],
      weeks: data.weeks ? structuredClone(data.weeks) : {},
    }],
  };
}

// Scheda attiva di un blob normalizzato (fallback: prima scheda).
export function activeSheet(blob) {
  const sheets = blob?.sheets ?? [];
  return sheets.find((s) => s.id === blob.activeSheetId) ?? sheets[0] ?? null;
}

// Blob normalizzato → forma in-memory: plan/weeks della scheda attiva proiettati
// al top-level, così tutto il codice esistente che legge data.plan/data.weeks
// funziona invariato. sheets[]/activeSheetId restano disponibili per il gestore.
export function hydrate(input) {
  const blob = toSheetsBlob(input);
  const act = activeSheet(blob);
  return {
    schema: blob.schema,
    updatedAt: blob.updatedAt ?? null,
    activeSheetId: blob.activeSheetId,
    sheets: blob.sheets,
    plan: structuredClone(act.plan ?? []),
    weeks: structuredClone(act.weeks ?? {}),
  };
}

// Forma in-memory → blob normalizzato: i plan/weeks top-level (la scheda attiva)
// vengono riscritti nella relativa entry di sheets[], poi plan/weeks top-level
// vengono rimossi. updatedAt propagato.
export function dehydrate(data) {
  const base = toSheetsBlob(data); // garantisce sheets[]/activeSheetId/schema
  const out = {
    schema: SHEETS_SCHEMA,
    updatedAt: data.updatedAt ?? base.updatedAt ?? null,
    activeSheetId: data.activeSheetId ?? base.activeSheetId,
    sheets: structuredClone(data.sheets ?? base.sheets),
  };
  const ids = out.sheets.map((s) => s.id);
  if (!ids.includes(out.activeSheetId)) out.activeSheetId = out.sheets[0].id;
  const act = out.sheets.find((s) => s.id === out.activeSheetId);
  act.plan = structuredClone(data.plan ?? []);
  act.weeks = structuredClone(data.weeks ?? {});
  return out;
}
