// splash-control.js — overlay #splash (boot screen). L'HTML/CSS lo mostra già
// senza JS; qui lo animiamo (variante "decrypt" sul posto per reduced-motion,
// accensione CRT altrimenti) e lo rimuoviamo quando il tempo minimo è trascorso
// E il boot è pronto, con un timeout di sicurezza se il boot si blocca. Il blocco
// di init in fondo parte all'import del modulo (DOM già pronto coi module script
// deferred); boot() segnala la prontezza chiamando splashBootReady().
import {
  DECRYPT_GLYPHS, DECRYPT_TICK_MS, WORD_DELAY_MS, CAP_DELAY_MS,
  REDUCE_MIN_MS, FULL_MIN_MS, isLocked, decryptDone,
} from "./splash.js";

let resolveSplashReady = () => {};
export function splashBootReady() { resolveSplashReady(); }
let splashDismissed = false;
function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("splash-out");
  setTimeout(() => el.remove(), 460);
}
// Resa reduced-motion: niente movimento, il testo si "decifra" sul posto. Ogni
// carattere parte come glifo casuale e si blocca sul finale, da sinistra a destra.
function startSplashDecrypt(splash) {
  const randGlyph = () => DECRYPT_GLYPHS[Math.floor(Math.random() * DECRYPT_GLYPHS.length)];
  const run = (el, text, accentFrom, delay) => {
    if (!el) return;
    el.textContent = "";
    const cells = [...text].map((ch, i) => {
      const s = document.createElement("span");
      if (accentFrom != null && i >= accentFrom) s.className = "a";
      s.style.opacity = "0";
      s.textContent = ch === " " ? " " : randGlyph();
      el.appendChild(s);
      return { s, ch };
    });
    setTimeout(() => {
      cells.forEach((c) => { c.s.style.opacity = "1"; });
      let frame = 0;
      const id = setInterval(() => {
        frame++;
        cells.forEach((c, i) => {
          if (c.ch === " ") return;
          c.s.textContent = isLocked(i, frame) ? c.ch : randGlyph();
        });
        if (decryptDone(text, frame)) clearInterval(id);
      }, DECRYPT_TICK_MS);
    }, delay);
  };
  run(splash.querySelector(".sp-word"), "set.log", 3, WORD_DELAY_MS);
  run(splash.querySelector(".cap .type"), "system ready", null, CAP_DELAY_MS);
}
{
  const splash = document.getElementById("splash");
  if (splash) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // reduce: niente accensione CRT (vietato il movimento), il testo si decifra sul
    // posto e lo splash resta finché il reveal non finisce. full: l'accensione CRT
    // finisce di "digitare" verso ~2.85s, più un beat di lettura.
    if (reduce) startSplashDecrypt(splash);
    const minMs = reduce ? REDUCE_MIN_MS : FULL_MIN_MS;
    const ready = new Promise((r) => { resolveSplashReady = r; });
    const minDelay = new Promise((r) => setTimeout(r, minMs));
    const safety = new Promise((r) => setTimeout(r, 7000));
    Promise.race([Promise.all([ready, minDelay]), safety]).then(dismissSplash);
    // Skip al tap/click, ma NON aggressivo: una finestra di grazia iniziale evita
    // che un tap accidentale nell'istante dell'apertura salti subito l'intro.
    // Lo skip si arma dopo `skipArmMs`; prima i tap sono ignorati. dismissSplash
    // è idempotente (splashDismissed), quindi nessun rischio di doppio dismiss.
    const skipArmMs = reduce ? 0 : 700;
    let skipArmed = false;
    setTimeout(() => { skipArmed = true; }, skipArmMs);
    splash.addEventListener("click", () => { if (skipArmed) dismissSplash(); });
  }
}
