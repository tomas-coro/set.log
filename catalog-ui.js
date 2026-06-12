// catalog-ui.js — overlay "Database esercizi" a schermo intero: albero per
// gruppo muscolare, dettaglio inline (usato-in / sparkline / nota / muscoli) e
// modale add/edit/delete. Stessa logica history degli altri overlay. Stato
// proprio (catalogOpen, filtro, gruppi/voce aperti) privato; catalogOpen e
// dbFilter sono esposti su ctx per il back-handler e l'add-inline di app.js.
import { ctx, CRT_CORNERS, dbEsc } from "./app-context.js";
import { renderBody, GROUP_ZONES } from "./body.js";
import { a11yToggle, a11yRestoreFocus } from "./a11y.js";
import { hydrate, dehydrate } from "./sheets.js";
import {
  addCatalogEntry, renameCatalogEntry, deleteCatalogEntry, setCatalogNote,
  groupedCatalog, catalogUsage, MUSCLE_GROUPS,
} from "./catalog.js";

let catalogOpen = false;
let dbFilter = "";        // testo del filtro
let dbOpenGroups = {};    // gruppo → bool (default: aperti)
let dbOpenEx = null;      // id voce espansa (una per volta)

// catalogOpen e dbFilter esposti su ctx: il popstate handler di app.js usa
// catalogOpen, l'handler dell'add-inline legge dbFilter come prefill.
Object.defineProperty(ctx, "catalogOpen", {
  get: () => catalogOpen, set: (v) => { catalogOpen = v; }, configurable: true,
});
Object.defineProperty(ctx, "dbFilter", {
  get: () => dbFilter, set: (v) => { dbFilter = v; }, configurable: true,
});

export function openCatalog() {
  catalogOpen = true;
  history.pushState({ gymCatalog: true }, "");
  renderCatalog();
}

export function closeCatalog() {
  if (!catalogOpen) return;
  if (history.state && history.state.gymCatalog) history.back(); // → popstate chiude
  else { catalogOpen = false; renderCatalog(); }
}

// Filtro testo del catalogo, settato dall'handler di input in app.js.
export function setDbFilter(v) { dbFilter = v; renderCatalog(); }

// Applica una mutazione (blob→blob) sul catalogo, deidratando/idratando attorno,
// poi salva e ridisegna. Rispetta l'invariante dehydrate-a-ogni-save.
function mutateCatalog(fn) {
  ctx.data = hydrate(fn(dehydrate(ctx.data)));
  ctx.scheduleSave();
  renderCatalog();
}

// Helper di rendering del catalogo (normalizzazione, highlight, sparkline).
// dbEsc (escape HTML) è condiviso da app-context.js.
const dbNorm = (s) => String(s ?? "").toLowerCase().trim();
function dbHL(name) {
  if (!dbFilter) return dbEsc(name);
  const nf = dbNorm(dbFilter); // lunghezza normalizzata: niente drift con spazi nel filtro
  const i = dbNorm(name).indexOf(nf);
  if (i < 0) return dbEsc(name);
  return dbEsc(name.slice(0, i)) + "<mark>" + dbEsc(name.slice(i, i + nf.length)) +
    "</mark>" + dbEsc(name.slice(i + nf.length));
}
function dbSparkSVG(series) {
  if (!series.length) return "";
  const a = series.map((p) => p.kg), w = 260, h = 42;
  const mn = Math.min(...a), mx = Math.max(...a), rg = (mx - mn) || 1;
  const pts = a.map((v, i) => [8 + i * (w - 16) / (Math.max(1, a.length - 1)), h - 6 - ((v - mn) / rg) * (h - 13)]);
  const ln = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const lp = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">` +
    `<polygon points="8,${h - 6} ${ln} ${w - 8},${h - 6}" fill="var(--acc)" opacity=".18"/>` +
    `<polyline class="spk" points="${ln}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle class="spk-dot" cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="3" fill="var(--acc)"/></svg>`;
}

// Dettaglio inline di una voce: usato-in / sparkline / nota (animazione CRT).
function dbDetHTML(entry) {
  const blob = dehydrate(ctx.data);
  const u = catalogUsage(blob, entry.name);
  let h = `<div class="db-det"><div class="scan"></div><div class="reveal">`;
  h += `<div class="cmd"><span class="c1">$</span> stat "${dbEsc(entry.name)}"</div>`;
  h += `<div><span class="sec">usato in</span></div>`;
  if (u.usedIn.length) {
    u.usedIn.forEach((x) => h += `<div class="uin"><span class="pf">›</span><span class="sc">${dbEsc(x.sheet)}</span><span class="dy">· giorno ${dbEsc(x.day)}</span></div>`);
  } else {
    h += `<div class="none">— non presente in nessuna scheda —</div>`;
  }
  h += `<div style="margin-top:9px"><span class="sec">andamento</span></div>`;
  if (u.series.length) {
    h += `<div class="spark"><div class="top"><span class="lastv">${u.lastKg}<span class="u"> kg ult.</span></span><span class="cap">${u.series.length} sessioni</span></div>${dbSparkSVG(u.series)}</div>`;
  } else {
    h += `<div class="none">— ancora nessuno storico —</div>`;
  }
  h += `<div style="margin-top:9px"><span class="sec">muscoli</span></div>`;
  const zones = {};
  for (const z of GROUP_ZONES[entry.muscle] ?? []) zones[z] = 1;
  const secZones = new Set((entry.secondary ?? []).flatMap((g) => GROUP_ZONES[g] ?? []));
  const secTxt = (entry.secondary ?? []).length
    ? ` <span style="color:#7FC8FF">◐ ${(entry.secondary ?? []).map((g) => g.toLowerCase()).join(" · ")}</span>` : "";
  h += `<div class="crt-panel">${renderBody({ zones, secondaries: secZones, w: 88 })}` +
    `<div class="bd-leg"><span style="color:#f0a73c">● ${dbEsc(entry.muscle.toLowerCase())}</span>${secTxt}</div>` +
    `${CRT_CORNERS}<span class="crt-tag">TGT·${dbEsc(String(entry.id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8))}</span></div>`;
  h += `<div style="margin-top:9px"><span class="sec">nota</span></div>`;
  h += `<textarea class="note" data-id="${entry.id}" placeholder="cue tecnico, presa, link…">${dbEsc(entry.note || "")}</textarea>`;
  h += `<div class="dacts"><button class="edit">✎ modifica</button><button class="del">× elimina</button></div>`;
  h += `</div></div>`;
  return h;
}

export function renderCatalog() {
  const ov = document.getElementById("dbOverlay");
  if (!catalogOpen) { ov.classList.add("hidden"); ov.setAttribute("aria-hidden", "true"); return; }
  ov.classList.remove("hidden"); ov.setAttribute("aria-hidden", "false");
  const tree = document.getElementById("dbTree");
  const meta = document.getElementById("dbMeta");
  const blob = dehydrate(ctx.data);
  const groups = groupedCatalog(blob);
  meta.textContent = groups.reduce((n, g) => n + g.items.length, 0) + " rec";
  tree.innerHTML = "";
  const f = dbNorm(dbFilter);
  let any = false;

  groups.forEach(({ muscle, items }) => {
    const shown = items.filter((e) => !f || dbNorm(e.name).includes(f));
    if (f && !shown.length) return;
    any = any || shown.length > 0;
    const isOpen = f ? true : (dbOpenGroups[muscle] !== false);
    const node = document.createElement("div");
    node.className = "db-gnode" + (isOpen ? "" : " closed");
    const hd = document.createElement("div");
    hd.className = "db-ghd";
    hd.innerHTML = `<span class="car">${isOpen ? "▾" : "▸"}</span><span class="nm">${muscle.toLowerCase()}</span><span class="fill"></span><span class="ct">${String(items.length).padStart(2, "0")}</span>`;
    if (!f) {
      hd.onclick = () => { dbOpenGroups[muscle] = !(dbOpenGroups[muscle] !== false); renderCatalog(); };
      hd.dataset.muscle = muscle;
      a11yToggle(hd, isOpen, `#dbTree .db-ghd[data-muscle="${muscle}"]`);
    }
    node.appendChild(hd);
    const kids = document.createElement("div");
    kids.className = "db-kids";
    shown.forEach((entry, idx) => {
      const last = idx === shown.length - 1;
      const isExOpen = dbOpenEx === entry.id;
      const k = document.createElement("div");
      k.className = "db-k" + (isExOpen ? " open" : "");
      const noteDot = entry.note ? '<span class="nb" title="ha una nota"> ✎·</span>' : '';
      k.innerHTML = `<div class="db-krow"><span class="br">${last ? "└─" : "├─"}</span>` +
        `<span class="knm">${dbHL(entry.name)}${noteDot}</span><span class="car2">▸</span></div>` +
        (isExOpen ? dbDetHTML(entry) : "");
      const krow = k.querySelector(".db-krow");
      krow.onclick = () => { dbOpenEx = isExOpen ? null : entry.id; renderCatalog(); };
      krow.dataset.id = entry.id;
      a11yToggle(krow, isExOpen, `#dbTree .db-krow[data-id="${entry.id}"]`);
      if (isExOpen) wireDetail(k, entry);
      kids.appendChild(k);
    });
    node.appendChild(kids);
    tree.appendChild(node);
  });

  if (f && !any) {
    tree.innerHTML = `<div class="db-nores">nessun match per "<b>${dbEsc(dbFilter)}</b>"<br>` +
      `<button class="mk" id="dbMkNew">+ aggiungi "${dbEsc(dbFilter)}"</button></div>`;
    document.getElementById("dbMkNew").onclick = () => openCatalogForm(null, dbFilter);
  }
  a11yRestoreFocus();
}

// Aggancia gli handler del dettaglio inline (nota + azioni). La modale è il Task 10.
function wireDetail(k, entry) {
  const ta = k.querySelector(".note");
  ta.onclick = (e) => e.stopPropagation();
  // Salva (e ri-renderizza) solo se la nota è cambiata: il re-render al blur
  // distruggerebbe i bottoni del dettaglio a metà Tab da tastiera.
  ta.onblur = () => {
    if (ta.value === (entry.note || "")) return;
    mutateCatalog((b) => setCatalogNote(b, entry.id, ta.value));
  };
  k.querySelector(".edit").onclick = (e) => { e.stopPropagation(); openCatalogForm(entry); };
  k.querySelector(".del").onclick = (e) => { e.stopPropagation(); openCatalogDelete(entry); };
}
// Modale add / edit / delete del catalogo (Task 10). Dialog nativo #dbScrim:
// riusa lo stile .set-dialog (header .modal-h/.t/.x, .editlabel, input/select, .confirm).
export function dbCloseModal() {
  const dlg = document.getElementById("dbScrim");
  if (dlg.open) dlg.close();
}
export function openCatalogForm(entry, prefill = "") {
  const dlg = document.getElementById("dbScrim");
  const mttl = document.getElementById("dbMTtl");
  const mbody = document.getElementById("dbMBody");
  const isEdit = !!entry;
  mttl.textContent = isEdit ? "MODIFICA ESERCIZIO" : "NUOVO ESERCIZIO";
  const name0 = isEdit ? entry.name : prefill;
  const grp0 = isEdit ? entry.muscle : MUSCLE_GROUPS[0];
  const sec0 = isEdit ? (entry.secondary ?? []) : [];
  mbody.innerHTML =
    `<label class="editlabel">nome esercizio</label>` +
    `<input id="dbFNm" value="${dbEsc(name0)}" placeholder="es. Panca piana bilanciere" autocomplete="off">` +
    `<div class="db-warn" id="dbFWarn"></div>` +
    `<label class="editlabel">gruppo muscolare</label><select id="dbFGrp">` +
    MUSCLE_GROUPS.map((m) => `<option ${m === grp0 ? "selected" : ""}>${m}</option>`).join("") +
    `</select>` +
    `<label class="editlabel">muscoli secondari</label>` +
    `<div class="db-chips" id="dbFSec">` +
    MUSCLE_GROUPS.map((m) =>
      `<button type="button" class="chip${sec0.includes(m) ? " on" : ""}${m === grp0 ? " dis" : ""}" data-g="${m}">${m.toLowerCase()}</button>`).join("") +
    `</div>` +
    `<div class="db-mfoot"><button class="db-cancel" type="button" id="dbFCancel">annulla</button>` +
    `<button class="confirm" type="button" id="dbFOk">salva</button></div>`;
  const nm = document.getElementById("dbFNm");
  const grp = document.getElementById("dbFGrp");
  const ok = document.getElementById("dbFOk");
  const warn = document.getElementById("dbFWarn");
  const blob = dehydrate(ctx.data);
  function check() {
    const v = nm.value.trim();
    if (!v) { ok.disabled = true; warn.textContent = ""; return; }
    const dup = (blob.catalog || []).some((e) =>
      e.muscle === grp.value && dbNorm(e.name) === dbNorm(v) && (!isEdit || e.id !== entry.id));
    ok.disabled = dup; warn.textContent = dup ? "già presente in " + grp.value : "";
  }
  nm.oninput = check; grp.onchange = check; check();
  const secBox = document.getElementById("dbFSec");
  secBox.addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c || c.classList.contains("dis")) return;
    c.classList.toggle("on");
  });
  // Cambiando il primario: il suo chip si disabilita (e si spegne se era acceso).
  grp.addEventListener("change", () => {
    for (const c of secBox.querySelectorAll(".chip")) {
      const isPrimary = c.dataset.g === grp.value;
      c.classList.toggle("dis", isPrimary);
      if (isPrimary) c.classList.remove("on");
    }
  });
  document.getElementById("dbFCancel").onclick = dbCloseModal;
  ok.onclick = () => {
    const name = nm.value.trim(), muscle = grp.value;
    // Stato vista PRIMA della mutazione: mutateCatalog ri-renderizza già, così
    // gruppo aperto + filtro azzerato sono riflessi senza un render extra.
    if (!isEdit) { dbOpenGroups[muscle] = true; dbFilter = ""; document.getElementById("dbQ").value = ""; }
    const secondary = [...document.querySelectorAll("#dbFSec .chip.on")].map((b) => b.dataset.g);
    if (isEdit) mutateCatalog((b) => renameCatalogEntry(b, entry.id, { name, muscle, secondary }));
    else mutateCatalog((b) => addCatalogEntry(b, { name, muscle, secondary }));
    dbCloseModal();
  };
  if (!dlg.open) dlg.showModal();
  setTimeout(() => nm.focus(), 30);
}
function openCatalogDelete(entry) {
  const dlg = document.getElementById("dbScrim");
  document.getElementById("dbMTtl").textContent = "ELIMINA";
  document.getElementById("dbMBody").innerHTML =
    `<div class="db-delmsg">Eliminare <b>${dbEsc(entry.name)}</b> da <b>${dbEsc(entry.muscle)}</b>?` +
    `<br>Non tocca lo storico delle schede.</div>` +
    `<div class="db-mfoot"><button class="db-cancel" type="button" id="dbFCancel">annulla</button>` +
    `<button class="confirm db-danger" type="button" id="dbFOk">elimina</button></div>`;
  document.getElementById("dbFCancel").onclick = dbCloseModal;
  document.getElementById("dbFOk").onclick = () => {
    dbOpenEx = null; // prima della mutazione: il render di mutateCatalog lo riflette
    mutateCatalog((b) => deleteCatalogEntry(b, entry.id));
    dbCloseModal();
  };
  if (!dlg.open) dlg.showModal();
}
