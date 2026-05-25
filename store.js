// ---- Pure data helpers (testable in Node, used in the browser) ----

// ISO 8601 week key, e.g. "2026-W22".
export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;           // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);    // shift to Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function emptyData() {
  return { updatedAt: null, weeks: {} };
}

export function ensureWeek(data, weekKey, label) {
  const next = structuredClone(data);
  if (!next.weeks[weekKey]) {
    next.weeks[weekKey] = { label: label || weekKey, entries: {} };
  }
  return next;
}

export function setEntry(data, weekKey, day, exIndex, value, nowIso) {
  const next = structuredClone(data);
  if (!next.weeks[weekKey]) next.weeks[weekKey] = { label: weekKey, entries: {} };
  if (!next.weeks[weekKey].entries[day]) next.weeks[weekKey].entries[day] = {};
  next.weeks[weekKey].entries[day][String(exIndex)] = value;
  next.updatedAt = nowIso ?? new Date().toISOString();
  return next;
}

export function getEntry(data, weekKey, day, exIndex) {
  return data?.weeks?.[weekKey]?.entries?.[day]?.[String(exIndex)] ?? "";
}

// ---- Base64 helpers (UTF-8 safe). btoa/atob + TextEncoder/Decoder exist
//      both in modern browsers and in Node >= 16. ----

export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
