// recovery.js — helper di recupero/manutenzione invocati dal boot e dai pulsanti
// di Impostazioni: reconcileFromRemote (allinea col cloud all'avvio e su realtime),
// rescueLegacyLocalStorage (importa i dati legacy del vecchio schema), recoverLogs-
// FromOldCloud (ripristina log storici da data.json), forceAppUpdate (reset cache
// SW). boot() RESTA in app.js: qui vivono solo gli helper che orchestra. Lo stato
// post-load (data, store, session, profileStorage, dataVersion, pusher) si tocca
// via ctx; merge/version restano IDENTICI all'originale (invariante critica log).
import { ctx } from "./app-context.js";
import { mergeBlobs, emptyData, setEntry, ConflictError } from "./store.js";
import { hydrate, dehydrate } from "./sheets.js";
import { migrate, backfillMuscles, patchPlanV4, patchPlanV5 } from "./editor.js";
import { PLAN } from "./plan.js";
import { PENDING_KEY } from "./local-prefs.js";

const SEED_URL = "https://tomas-coro.github.io/set.log/data.json";

function dumpGymschedKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("gymsched")) {
      const v = localStorage.getItem(k) ?? "";
      out.push({ key: k, size: v.length });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
export async function rescueLegacyLocalStorage() {
  const rawData = localStorage.getItem("gymsched_data");
  const rawPending = localStorage.getItem(PENDING_KEY);
  let legacy = null;
  let pendingList = [];
  if (rawData) {
    try { legacy = JSON.parse(rawData); } catch {
      alert("Dati locali legacy presenti ma corrotti — impossibile importare.");
      return;
    }
  }
  if (rawPending) {
    try { pendingList = JSON.parse(rawPending) || []; } catch { pendingList = []; }
  }
  const wkKeys = Object.keys(legacy?.weeks || {}).sort();
  if (wkKeys.length === 0 && pendingList.length === 0) {
    // Diagnostic: elenca tutte le chiavi gymsched_* presenti, così capiamo
    // dove sono finiti i dati (o se non ci sono mai stati su questo device).
    const keys = dumpGymschedKeys();
    const list = keys.length === 0
      ? "  (nessuna chiave 'gymsched_*' nel localStorage di questo browser)"
      : keys.map((k) => `  • ${k.key} — ${k.size} byte`).join("\n");
    alert(
      "Nessun dato di scheda trovato in localStorage.\n\n" +
      "Chiavi 'gymsched_*' presenti in questo browser:\n" + list + "\n\n" +
      "Account attivo: " + (ctx.session?.user?.email ?? "—") + "\n" +
      "Origine: " + location.origin + location.pathname + "\n\n" +
      "Se avevi gli allenamenti su un altro device o profilo, aprilo lì."
    );
    return;
  }
  const wkRange = wkKeys.length === 0 ? "—" : (wkKeys.length === 1 ? wkKeys[0] : `${wkKeys[0]} → ${wkKeys[wkKeys.length-1]}`);
  const summary = `Trovati dati locali:\n  • ${wkKeys.length} settimane (${wkRange})\n  • ${pendingList.length} log in coda non sincronizzati\n\nImportarli e sincronizzarli sul tuo account?\nI dati legacy resteranno come backup nel browser.`;
  if (!confirm(summary)) return;
  // Merge: il legacy ha precedenza sui sets non-vuoti (mergeBlobs(local=legacy, remote=data)).
  const merged = mergeBlobs(legacy ?? emptyData(), ctx.data ?? emptyData());
  // Applica eventuali pending non ancora sincronizzati sopra il merged.
  let withPending = merged;
  for (const e of pendingList) {
    try { withPending = setEntry(withPending, e.weekKey, e.day, e.idx, e.value, new Date().toISOString()); } catch {}
  }
  ctx.data = hydrate(patchPlanV5(patchPlanV4(backfillMuscles(migrate(withPending, PLAN), PLAN))));
  ctx.profileStorage.set("data", ctx.data);
  ctx.profileStorage.set("dirty", true);
  ctx.pusher.schedule();
  ctx.render();
  alert(`Importate ${wkKeys.length} settimane (${wkRange}) e ${pendingList.length} log in coda.\nSincronizzazione cloud in corso…`);
}

// Forza aggiornamento app: cancella tutte le cache del SW, deregistra il SW e
// ricarica. Escape hatch per quando il banner "nuova versione" non compare
// (es. browser HTTP cache serve sw.js stale). Distruttivo solo per la app-shell:
// i dati utente vivono in localStorage namespacizzato + Supabase, intoccati.
export async function forceAppUpdate() {
  if (!confirm("Forza l'aggiornamento dell'app?\n\nCancellerà la cache locale dell'app (NON i tuoi dati di allenamento, che sono su Supabase) e ricaricherà la pagina per scaricare la versione più recente.")) return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
  } catch (err) {
    alert("Errore durante il reset cache: " + (err?.message ?? err) + "\nProvo a ricaricare comunque.");
  }
  // Ricarica forzando bypass cache HTTP (best-effort, dipende dal browser).
  location.reload();
}

// Recovery dei log storici dal vecchio cloud (data.json su GitHub Pages, sorgente
// di verità pre-cut-over a Supabase). Fa una merge non distruttiva: pickEntry tiene
// l'entry con più set non vuoti, quindi i set già loggati su Supabase NON vengono
// sovrascritti, mentre i log mancanti vengono ripristinati da data.json.
export async function recoverLogsFromOldCloud() {
  let seed;
  try {
    const res = await fetch(SEED_URL, { cache: "no-store" });
    if (!res.ok) {
      alert(`Errore HTTP ${res.status} scaricando data.json.\nURL: ${SEED_URL}`);
      return;
    }
    seed = await res.json();
  } catch (err) {
    alert(`Errore di rete scaricando data.json:\n${err?.message ?? err}\n\nURL: ${SEED_URL}`);
    return;
  }
  const seedWeeks = Object.keys(seed?.weeks ?? {}).sort();
  if (seedWeeks.length === 0) {
    alert("data.json non contiene settimane. Nulla da recuperare.");
    return;
  }
  let seedSets = 0;
  for (const wk of seedWeeks) {
    const ent = seed.weeks[wk]?.entries ?? {};
    for (const day of Object.keys(ent)) {
      for (const ex of Object.keys(ent[day] ?? {})) {
        seedSets += (ent[day][ex].sets ?? []).length;
      }
    }
  }
  const curWeeks = Object.keys(ctx.data?.weeks ?? {}).length;
  const range = seedWeeks.length === 1 ? seedWeeks[0] : `${seedWeeks[0]} → ${seedWeeks[seedWeeks.length - 1]}`;
  const ok = confirm(
    `Trovati nel vecchio cloud (data.json):\n` +
    `  • ${seedWeeks.length} settimane (${range})\n` +
    `  • ${seedSets} set totali loggati\n\n` +
    `Verranno UNITI ai dati attuali (${curWeeks} settimane su Supabase). ` +
    `I set già presenti non vengono toccati; quelli mancanti vengono ripristinati.\n\n` +
    `Procedere?`
  );
  if (!ok) return;
  const merged = mergeBlobs(ctx.data ?? emptyData(), seed);
  ctx.data = hydrate(patchPlanV5(patchPlanV4(backfillMuscles(migrate(merged), PLAN))));
  ctx.profileStorage.set("data", ctx.data);
  ctx.profileStorage.set("dirty", true);
  ctx.pusher.schedule();
  ctx.render();
  alert(
    `Recupero completato.\n` +
    `Settimane totali ora: ${Object.keys(ctx.data.weeks ?? {}).length}\n` +
    `Sincronizzazione cloud in corso…`
  );
}

export async function reconcileFromRemote() {
  if (!ctx.store || !ctx.session) return;
  try {
    const remote = await ctx.store.load();
    if (remote.version === ctx.dataVersion) return; // nessun cambio
    const merged = mergeBlobs(dehydrate(ctx.data), remote.data);
    ctx.dataVersion = await ctx.store.save(merged, remote.version);
    ctx.data = hydrate(merged);
    ctx.profileStorage.set("data", ctx.data);
    ctx.profileStorage.set("version", ctx.dataVersion);
    ctx.render();
  } catch (err) {
    if (err instanceof ConflictError) {
      // Race: ritenta una volta.
      return reconcileFromRemote();
    }
  }
}
