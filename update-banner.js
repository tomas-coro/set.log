// update-banner.js — toast di aggiornamento dell'app + riga versione di
// Impostazioni. Due varianti: (1) update del service worker (PWA web): "Nuova
// versione disponibile › aggiorna", il tap fa skipWaiting sul SW in attesa;
// (2) update da store (scaffolding build nativa, attivo solo se
// STORE_UPDATE_ENABLED). I trigger (registrazione SW, load, visibilitychange)
// restano nel boot di app.js, che importa e chiama queste funzioni passando
// `reg`/`update`. swReg resta in app.js (cablata nel boot, usata anche da
// rest-ui e recovery via ctx.swReg).
import { ctx } from "./app-context.js";
import { APP_VERSION, STORE_UPDATE_ENABLED } from "./release.js";

// `swUpdating` distingue l'aggiornamento voluto dall'utente (tap sul banner)
// dal primo clients.claim alla prima installazione: ricarica solo nel primo caso.
// Esposto su ctx perché il handler `controllerchange` (boot di app.js) lo legge.
let swUpdating = false;
Object.defineProperty(ctx, "swUpdating", {
  get: () => swUpdating, set: (v) => { swUpdating = v; }, configurable: true,
});
// Toast aggiornamento rimandato col `✕`: di sola sessione (riparte a false al
// prossimo load, così se l'update è ancora pending il toast riappare).
let updateDismissed = false;

export function showUpdateBanner(reg) {
  if (updateDismissed) return;                                 // rimandato in questa sessione
  if (document.getElementById("updateBanner")) return;         // già presente
  const b = document.createElement("div");
  b.id = "updateBanner";
  b.className = "update-toast";
  b.setAttribute("role", "status");

  const dot = document.createElement("span");
  dot.className = "ut-dot";

  const tx = document.createElement("span");
  tx.className = "ut-tx";
  tx.textContent = "Nuova versione disponibile";

  const go = document.createElement("button");
  go.type = "button";
  go.className = "ut-go";
  go.textContent = "› aggiorna";
  go.addEventListener("click", () => {
    swUpdating = true;
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  });

  const x = document.createElement("button");
  x.type = "button";
  x.className = "ut-x";
  x.textContent = "✕";
  x.setAttribute("aria-label", "Rimanda");
  x.addEventListener("click", () => {
    updateDismissed = true;
    b.remove();
  });

  b.append(dot, tx, go, x);
  document.body.appendChild(b);
}

// --- Store update (scaffolding fase 3) ---------------------------------------
// Attivo SOLO se STORE_UPDATE_ENABLED è true (build nativa). A OFF non viene mai
// eseguito: nessun fetch di version.json, nessun banner store. L'update resta sul SW.

// Toast minimale "Aggiorna · vX.Y.Z" che apre lo store. Dismiss di sessione, idempotente.
let storeUpdateDismissed = false;
export function showStoreUpdateBanner(latest, storeUrl) {
  if (storeUpdateDismissed) return;
  if (document.getElementById("storeUpdateBanner")) return;
  const b = document.createElement("div");
  b.id = "storeUpdateBanner";
  b.className = "update-toast";
  b.setAttribute("role", "status");

  const dot = document.createElement("span");
  dot.className = "ut-dot";

  const tx = document.createElement("span");
  tx.className = "ut-tx";
  tx.append("Aggiorna · ");
  const v = document.createElement("span");
  v.style.color = "var(--acc)";
  v.textContent = "v" + latest;
  tx.append(v);

  const go = document.createElement("button");
  go.type = "button";
  go.className = "ut-go";
  go.textContent = "›";
  go.setAttribute("aria-label", "Apri lo store");
  // TODO(native): in una build Capacitor, per il deep-link allo store nativo usare il
  // plugin Browser/App invece di window.open (ok per ora: flag spento, ID store segnaposto).
  go.addEventListener("click", () => window.open(storeUrl, "_blank", "noopener"));

  const x = document.createElement("button");
  x.type = "button";
  x.className = "ut-x";
  x.textContent = "✕";
  x.setAttribute("aria-label", "Rimanda");
  x.addEventListener("click", () => { storeUpdateDismissed = true; b.remove(); });

  b.append(dot, tx, go, x);
  document.body.appendChild(b);
}

// Popola la riga `app` di Impostazioni. Mostra sempre la versione; a flag ON con update
// disponibile aggiunge il tag "↑ vX.Y.Z" e nasconde il force-update manuale del SW.
export function renderAppLine(update) {
  const vEl = document.getElementById("appVersion");
  if (vEl) vEl.textContent = "v" + APP_VERSION;

  const fu = document.getElementById("btnForceUpdate");
  if (fu) fu.style.display = STORE_UPDATE_ENABLED ? "none" : "";

  const tagEl = document.getElementById("appUpdateTag");
  if (!tagEl) return;
  tagEl.textContent = "";
  if (STORE_UPDATE_ENABLED && update && update.updateAvailable) {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "sv-tag";
    t.textContent = "↑ v" + update.latest;
    t.addEventListener("click", () => window.open(update.storeUrl, "_blank", "noopener"));
    tagEl.appendChild(t);
  }
}
