// ---- Logica di sessione (pura, testabile in Node). Render in app.js. ----
import { getEntry, normalizeEntry, normalizeSet, normalizeSupersetEntry } from "./store.js";

// "4 × 6-8" -> { sets: 4, reps: "6-8" } ; tollera 'x'/'×' e reps non numeriche.
export function parseTargetTrack(str) {
  const s = String(str ?? "").trim();
  const m = s.match(/^(\d+)\s*[×x]\s*(.+)$/i);
  if (!m) return { sets: 1, reps: s };
  return { sets: parseInt(m[1], 10), reps: m[2].trim() };
}

// Normale -> { sets, reps }. Superset -> { a:{sets,reps}, b:{sets,reps} }.
export function parseTarget(setsReps, superset = false) {
  const parts = String(setsReps ?? "").split("/");
  if (superset) {
    return {
      a: parseTargetTrack(parts[0] ?? ""),
      b: parseTargetTrack(parts[1] ?? parts[0] ?? ""),
    };
  }
  return parseTargetTrack(parts[0] ?? "");
}
