// scan-ui.js — overlay "Scan": figura anatomica heatmap (volume settimana /
// freschezza). Stessa logica history degli altri overlay. Stato proprio
// (scanOpen, scanTab) tenuto privato; scanOpen è esposto su ctx per il
// back-handler (popstate) di app.js.
import { ctx, CRT_CORNERS, CRT_RULER } from "./app-context.js";
import { renderBody, heatByGroup, freshnessByGroup, scanBootLog } from "./body.js";
import { muscleContributions, lastTrainedByGroup } from "./session.js";
import { dehydrate } from "./sheets.js";

let scanOpen = false;
let scanTab = "week"; // "week" | "fresh"

// scanOpen esposto su ctx: il popstate handler di app.js lo legge/scrive in
// modo uniforme con gli altri overlay estratti.
Object.defineProperty(ctx, "scanOpen", {
  get: () => scanOpen, set: (v) => { scanOpen = v; }, configurable: true,
});

export function openScan() {
  scanOpen = true;
  history.pushState({ gymScan: true }, "");
  renderScan();
}
export function closeScan() {
  if (!scanOpen) return;
  if (history.state && history.state.gymScan) history.back(); // → popstate chiude
  else { scanOpen = false; renderScan(); }
}

// Tab della vista scan (week | fresh), settato dall'handler di wiring in app.js.
export function setScanTab(t) { scanTab = t; renderScan(); }

// Legenda della vista settimana: scala poco→tanto + spento (palette fissa).
function scanLegendWeek() {
  const sw = (o) => `<span class="sw" style="background:#f0a73c;opacity:${o}"></span>`;
  return `<div class="bd-leg">poco ${[0.3, 0.55, 0.8, 1].map(sw).join("")} tanto` +
    `<span><span class="sw" style="background:#1c2127;border:1px solid #2c343c"></span> non allenato</span></div>`;
}

export function renderScan() {
  const ov = document.getElementById("scanOverlay");
  if (!scanOpen) {
    ov.classList.add("hidden");
    ov.setAttribute("aria-hidden", "true");
    if (ctx.openIndex === null && !ctx.nutritionOpen && !ctx.planOpen) document.body.style.overflow = "";
    return;
  }
  for (const b of document.querySelectorAll("#scanTabs button")) {
    b.classList.toggle("on", b.dataset.tab === scanTab);
  }
  const body = document.getElementById("scanBody");
  const plan = Array.isArray(ctx.data.plan) ? ctx.data.plan : [];
  const catalog = dehydrate(ctx.data).catalog ?? [];
  if (scanTab === "week") {
    // Heat dai volumi della settimana corrente (quella selezionata in home).
    const contribs = plan.flatMap((d) => muscleContributions(ctx.data, ctx.currentWeek, d.day, d));
    const { zones } = heatByGroup(contribs, catalog);
    const wTag = ctx.currentWeek.split("-")[1] || ctx.currentWeek; // "2026-W23" → "W23"
    document.getElementById("scanSub").textContent = `◈ SCAN · settimana ${wTag}`;
    // "Vuoto" qui = nessun volume NELLA SETTIMANA selezionata (contribs);
    // nel tab freschezza invece = mai allenato in TUTTO lo storico (lastBy).
    // I due predicati sono volutamente diversi: stessa UI, domande diverse.
    const empty = contribs.length === 0;
    body.innerHTML =
      `<div class="crt-panel big${empty ? " scan-dim" : ""}">${CRT_RULER}${renderBody({ zones, w: 108 })}` +
      `${scanLegendWeek()}${CRT_CORNERS}<span class="crt-tag">SCAN·${wTag}</span></div>` +
      (empty ? scanBootLog("week", { wTag }) : "");
  } else {
    const todayIso = new Date().toISOString().slice(0, 10);
    const lastBy = lastTrainedByGroup(ctx.data);
    const { zones, never, warnGroups, neverGroups } = freshnessByGroup(lastBy, todayIso);
    document.getElementById("scanSub").textContent = "◈ SCAN · freschezza";
    const warnTxt = warnGroups.length
      ? `<div class="bd-leg"><span class="warn">⚠ fermi da ≥6 giorni: ${warnGroups.map((g) => g.toLowerCase()).join(" · ")}</span></div>` : "";
    const neverTxt = neverGroups.length
      ? `<div class="bd-leg"><span class="warn"><span class="sw" style="border:1px dashed #e0705a"></span> mai allenato: ${neverGroups.map((g) => g.toLowerCase()).join(" · ")}</span></div>` : "";
    const emptyF = Object.keys(lastBy).length === 0; // vedi nota sul tab week
    body.innerHTML =
      `<div class="crt-panel big${emptyF ? " scan-dim" : ""}">${CRT_RULER}${renderBody({ zones, cold: never, w: 108 })}` +
      `${warnTxt}${neverTxt}${CRT_CORNERS}<span class="crt-tag">SCAN·FRESH</span></div>` +
      (emptyF ? scanBootLog("fresh", {}) : `<div class="scan-cap">acceso = allenato da poco · spento = sta recuperando</div>`);
  }
  ov.classList.remove("hidden");
  ov.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
