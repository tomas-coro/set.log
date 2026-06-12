// app-context.js — stato condiviso fra app.js e i moduli estratti.
// I campi di stato (data, currentWeek, …) sono definiti come accessor da app.js
// (bridge in app.js via Object.defineProperties), così i moduli leggono/scrivono
// i `let` di app.js senza duplicare lo stato. `render` è sovrascritto da app.js.
import { PLAN } from "./plan.js";

export const ctx = {
  render: () => {}, // sovrascritto da app.js: ctx.render = render
};

export const planDays = () => (Array.isArray(ctx.data.plan) && ctx.data.plan.length ? ctx.data.plan : PLAN);
export const fmtKg = (n) => Math.round(n).toLocaleString("it-IT");

// Parentesi HUD angolari e righello: markup ripetuto dei pannelli CRT, condiviso
// fra scan-ui.js, catalog-ui.js e i pannelli di coverage in app.js.
export const CRT_CORNERS = '<i class="crt-c tl"></i><i class="crt-c tr"></i><i class="crt-c bl"></i><i class="crt-c br"></i>';
export const CRT_RULER =
  `<div class="crt-ruler-x">${[0, 10, 20, 30, 40, 50, 60].map((n) => `<span>${n}</span>`).join("")}</div>` +
  `<div class="crt-ruler-y">${[0, 10, 20, 30].map((n) => `<span>${n}</span>`).join("")}</div>`;
