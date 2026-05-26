import { PLAN } from "./plan.js";
import {
  isoWeekKey, emptyData, ensureWeek, setEntry, getEntry,
  normalizeEntry, normalizeSupersetEntry, prefillSets,
  GitHubStore, ConflictError, AuthError,
} from "./store.js";
import {
  parseTarget, activeExerciseIndex, activeSetIndex, bestKg, progressionDelta,
  withSet, withoutSet, withSupersetSet, withoutSupersetSet,
} from "./session.js";
import { RestTimer, formatTime } from "./timer.js";

const OWNER = "xBacco";
const REPO = "gym-schedule";
const TOKEN_KEY = "gymsched_token";
const PENDING_KEY = "gymsched_pending"; // local buffer of unsynced edits

// ---- App state ----
let data = emptyData();
let sha = null;
let currentWeek = isoWeekKey(new Date());
let currentDay = "A";
let focusIndex = 0;          // esercizio in focus nel giorno corrente
let store = null;
let saveTimer = null;

// ---- Token + pending buffer (browser only) ----
const getToken = () => localStorage.getItem(TOKEN_KEY) || null;
const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
const getPending = () => JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
const setPending = (arr) => localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
function bufferEdit(weekKey, day, idx, value) {
  const p = getPending().filter((e) => !(e.weekKey === weekKey && e.day === day && e.idx === idx));
  p.push({ weekKey, day, idx, value });
  setPending(p);
}
function applyPending(target) {
  let d = target;
  for (const e of getPending()) d = setEntry(d, e.weekKey, e.day, e.idx, e.value, new Date().toISOString());
  return d;
}

// ---- Per-exercise rest overrides (browser only) ----
const REST_KEY = "gymsched_rest";
const getRestMap = () => JSON.parse(localStorage.getItem(REST_KEY) || "{}");
function getRest(day, idx, fallback) {
  const v = getRestMap()[`${day}-${idx}`];
  return Number.isFinite(v) ? v : fallback;
}
function setRest(day, idx, seconds) {
  const m = getRestMap();
  m[`${day}-${idx}`] = seconds;
  localStorage.setItem(REST_KEY, JSON.stringify(m));
}


// ---- Status indicator ----
function setStatus(text, kind = "") {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

// ---- End-of-rest notification (vibration + WebAudio beep) ----
let audioCtx = null;
function ensureAudio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function beep() {
  try {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (_) { /* audio unavailable; ignore */ }
}

// ---- Timer wiring ----
const timer = new RestTimer({
  onTick: (remaining, label) => {
    document.getElementById("timerTime").textContent = formatTime(remaining);
    document.getElementById("timerLabel").textContent = label;
  },
  onEnd: () => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
    setTimeout(() => document.getElementById("timerBar").classList.add("hidden"), 1500);
  },
});
function startRest(seconds, label) {
  ensureAudio(); // unlock audio within the user gesture
  document.getElementById("timerBar").classList.remove("hidden");
  document.getElementById("tToggle").textContent = "⏸";
  timer.start(seconds, label);
}

// ---- Rendering ----
function renderWeekSelect() {
  const sel = document.getElementById("weekSelect");
  const keys = Object.keys(data.weeks);
  if (!keys.includes(currentWeek)) keys.push(currentWeek);
  keys.sort();
  sel.replaceChildren();
  for (const k of keys) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = data.weeks[k]?.label || k;
    if (k === currentWeek) opt.selected = true;
    sel.appendChild(opt);
  }
}

function prevWeekKey() {
  const keys = Object.keys(data.weeks).sort().filter((k) => k < currentWeek);
  return keys.length ? keys[keys.length - 1] : null;
}

const dayPlan = () => PLAN.find((d) => d.day === currentDay) || PLAN[0];

function weekLabel(key) {
  const m = String(key).match(/W(\d+)/i);
  return m ? "SETT. " + m[1] : String(data.weeks[key]?.label || key);
}

function renderHeader() {
  const dp = dayPlan();
  document.getElementById("kickDay").textContent = currentDay;
  document.getElementById("kickWeek").textContent = weekLabel(currentWeek);
  document.getElementById("dayTitle").textContent = dp.title;
  for (const b of document.querySelectorAll("#dayTabs button")) {
    b.classList.toggle("on", b.dataset.day === currentDay);
  }
}

function isComplete(idx) {
  const ex = dayPlan().exercises[idx];
  const v = getEntry(data, currentWeek, currentDay, idx);
  if (ex.superset) {
    const e = normalizeSupersetEntry(v);
    const has = e.a.sets.length || e.b.sets.length;
    const ok = (t) => t.sets.length === 0 || t.sets.every((s) => s.done);
    return !!has && ok(e.a) && ok(e.b);
  }
  const e = normalizeEntry(v);
  return e.sets.length > 0 && e.sets.every((s) => s.done);
}

function renderProgress() {
  const dp = dayPlan();
  const bar = document.getElementById("progBar");
  bar.textContent = "";
  dp.exercises.forEach((ex, i) => {
    const seg = document.createElement("span");
    seg.className = "seg";
    if (i === focusIndex) seg.classList.add("cur");
    else if (isComplete(i)) seg.classList.add("done");
    bar.appendChild(seg);
  });
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = `${String(focusIndex + 1).padStart(2, "0")}/${String(dp.exercises.length).padStart(2, "0")}`;
  bar.appendChild(lbl);
}

function renderUpNext() {
  const dp = dayPlan();
  document.getElementById("upnextLabel").textContent =
    `— prossimi · ${dp.exercises.length - 1} esercizi —`;
  const root = document.getElementById("upnext");
  root.textContent = "";
  dp.exercises.forEach((ex, i) => {
    if (i === focusIndex) return;
    const row = document.createElement("div");
    row.className = "nrow" + (isComplete(i) ? " done" : "");
    row.addEventListener("click", () => { focusIndex = i; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });

    const id = document.createElement("span");
    id.className = "id"; id.textContent = String(i + 1).padStart(2, "0");

    const mid = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = ex.name;
    if (ex.superset) { const b = document.createElement("span"); b.className = "ssbadge"; b.textContent = "superset"; nm.appendChild(b); }
    const sub = document.createElement("div");
    sub.className = "sub"; sub.textContent = `${ex.setsReps} · rec ${getRest(currentDay, i, ex.restSeconds)}″`;
    mid.append(nm, sub);

    const right = document.createElement("div");
    right.className = "right";
    const best = document.createElement("div");
    best.className = "best";
    const bl = document.createElement("div");
    bl.className = "bl";
    if (ex.superset) { best.textContent = "A·B"; bl.textContent = "2 tracce"; }
    else { const bk = bestKg(data, currentDay, i); best.textContent = bk === null ? "—" : bk + " kg"; bl.textContent = "best"; }
    right.append(best, bl);

    row.append(id, mid, right);
    root.appendChild(row);
  });
}

function renderFocus() {
  // riempito nei Task 8 (normale) e 9 (superset)
  document.getElementById("focus").textContent = "";
}

function render() {
  renderHeader();
  renderProgress();
  renderFocus();
  renderUpNext();
}

// ---- Editing + saving ----
function onEdit(day, idx, value) {
  data = setEntry(data, currentWeek, day, idx, value, new Date().toISOString());
  bufferEdit(currentWeek, day, idx, value);
  setStatus("in attesa ⧗", "pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToCloud, 1500);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  setStatus("in attesa ⧗", "pending");
  saveTimer = setTimeout(saveToCloud, 800);
}

async function saveToCloud() {
  if (!store || !getToken()) { setStatus("nessun token ⧗", "pending"); return; }
  setStatus("salvataggio…");
  try {
    sha = await store.save(data, sha, `log: ${currentWeek}`);
    setPending([]);
    setStatus("salvato ✓", "ok");
  } catch (err) {
    if (err instanceof ConflictError) {
      try {
        const remote = await store.load();
        data = applyPending(remote.data);
        sha = remote.sha;
        sha = await store.save(data, sha, `log: ${currentWeek} (merge)`);
        setPending([]);
        setStatus("salvato ✓", "ok");
        render();
      } catch (e2) {
        setStatus("errore ⚠ (riprova)", "error");
      }
    } else if (err instanceof AuthError) {
      setStatus("token non valido ⚠", "error");
    } else {
      setStatus("offline ⧗ (salvato in locale)", "pending");
    }
  }
}

// ---- Week management ----
function changeWeek(key) {
  currentWeek = key;
  data = ensureWeek(data, currentWeek, data.weeks[currentWeek]?.label);
  focusIndex = activeExerciseIndex(data, currentWeek, currentDay, dayPlan());
  renderWeekSelect();
  render();
}
function changeDay(day) {
  currentDay = day;
  focusIndex = activeExerciseIndex(data, currentWeek, currentDay, dayPlan());
  render();
}
function newWeek() {
  const label = prompt("Nome della nuova settimana:", "Settimana");
  if (label === null) return;
  const key = isoWeekKey(new Date());
  let k = key, n = 2;
  while (Object.keys(data.weeks).includes(k) && k !== currentWeek) k = `${key}.${n++}`;
  data = ensureWeek(data, k, label || k);
  changeWeek(k);
  scheduleSave();
}

// ---- Settings dialog ----
function wireSettings() {
  const dlg = document.getElementById("settingsDialog");
  document.getElementById("settingsBtn").addEventListener("click", () => {
    document.getElementById("tokenInput").value = getToken() || "";
    dlg.showModal();
  });
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "save") {
      setToken(document.getElementById("tokenInput").value.trim() || null);
      initStore();
      saveToCloud();
    } else if (dlg.returnValue === "clear") {
      setToken(null);
      initStore();
      setStatus("sola lettura", "pending");
    }
  });
}

// ---- Timer controls ----
function wireTimerControls() {
  document.getElementById("tMinus").addEventListener("click", () => timer.addSeconds(-15));
  document.getElementById("tPlus").addEventListener("click", () => timer.addSeconds(15));
  document.getElementById("tStop").addEventListener("click", () => {
    timer.stop();
    document.getElementById("timerBar").classList.add("hidden");
  });
  document.getElementById("tToggle").addEventListener("click", (e) => {
    if (timer.paused) { timer.resume(); e.target.textContent = "⏸"; }
    else { timer.pause(); e.target.textContent = "▶"; }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) timer.sync(); });
}

// ---- Boot ----
function initStore() {
  store = new GitHubStore({ owner: OWNER, repo: REPO, token: getToken() });
}

async function boot() {
  wireSettings();
  wireTimerControls();
  document.getElementById("weekSelect").addEventListener("change", (e) => changeWeek(e.target.value));
  document.getElementById("newWeekBtn").addEventListener("click", newWeek);
  for (const b of document.querySelectorAll("#dayTabs button")) {
    b.addEventListener("click", () => changeDay(b.dataset.day));
  }
  initStore();
  setStatus("carico…");
  try {
    const loaded = await store.load();
    data = applyPending(loaded.data);
    sha = loaded.sha;
    setStatus(getToken() ? "salvato ✓" : "sola lettura", getToken() ? "ok" : "pending");
  } catch (err) {
    data = applyPending(emptyData());
    setStatus(err instanceof AuthError ? "token non valido ⚠" : "offline ⧗", err instanceof AuthError ? "error" : "pending");
  }
  data = ensureWeek(data, currentWeek);
  focusIndex = activeExerciseIndex(data, currentWeek, currentDay, dayPlan());
  renderWeekSelect();
  render();
  if (getPending().length && getToken()) saveToCloud();
}

boot();
