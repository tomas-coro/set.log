// a11y.js — helper UI condivisi: factory di bottoni/prompt stile terminale +
// accordion accessibili da tastiera. Solo DOM: nessuno stato app, nessun ctx.

// Bottone azione dei blocchi scheda. stopPropagation: il tap sul bottone non
// deve far collassare/espandere il blocco (il click-handler è sul blocco).
export function mkBtn(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sh-bb" + (cls ? " " + cls : "");
  b.textContent = label;
  b.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
  return b;
}

// Selettore dell'header accordion da rifocalizzare dopo il prossimo re-render.
// Valorizzato SOLO dal ramo keydown di a11yToggle: i render ricostruiscono il
// DOM e distruggono l'elemento focusato, da mouse/touch non serve ripristino.
let a11yRefocus = null;

// Rende un div clickable azionabile da tastiera (header accordion):
// role/tabindex/aria-expanded + Enter/Spazio che riusa il click-handler già
// presente via el.click() (diretto, o via bubbling se l'handler è sul parent,
// es. .sh-h → .sh-blk). refocusSel: selettore per ritrovare l'header dopo il
// re-render (ancorato al contenitore, vedi spec).
// PRECONDIZIONE: el è un elemento fresco (appena ricostruito dal render);
// su elementi riusati i keydown-listener si accumulerebbero.
export function a11yToggle(el, expanded, refocusSel) {
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-expanded", String(expanded));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Spazio non deve scrollare la pagina
      a11yRefocus = refocusSel;
      el.click();
    }
  });
}

// Da chiamare in coda ai render che ricostruiscono accordion accessibili.
export function a11yRestoreFocus() {
  if (!a11yRefocus) return;
  const el = document.querySelector(a11yRefocus);
  a11yRefocus = null;
  if (el) el.focus();
}

// Riga prompt stile terminale ("$ comando" / "› hint").
export function mkPrompt(sym, text) {
  const p = document.createElement("div");
  p.className = "sh-prompt";
  const d = document.createElement("span"); d.className = "d"; d.textContent = sym;
  p.append(d, document.createTextNode(" " + text));
  return p;
}

// Bottone della riga nuova in fondo ("$ nuova" / "$ duplica" / "$ importa").
export function mkNew(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sh-new";
  const d = document.createElement("span"); d.className = "d"; d.textContent = "$";
  b.append(d, document.createTextNode(" " + label));
  b.addEventListener("click", onClick);
  return b;
}
