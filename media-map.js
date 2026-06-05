// media-map.js
// ---- Illustrazioni esercizi (puro, testabile in Node). Fonte: wger.de /
//      Everkinetic (licenza libera), hotlink — nessuna cache offline.
//      SOLO voci VERIFICATE (HEAD 200 su entrambi i frame): le altre cadono
//      sul fallback "solo figura" (pannello media non mostrato). La mappa
//      cresce nel tempo; per i casi singoli c'è l'override `img` per-voce. ----
const WGER = "https://wger.de/media/exercise-images";
const norm = (s) => String(s ?? "").trim().toLowerCase();

// nome seed (normalizzato) → "<id>/<NomeFile>" wger
// (esportata per il test MAP-driven: ogni voce è verificata automaticamente)
export const MAP = {
  // --- petto ---
  "panca piana bilanciere": "192/Bench-press",
  "spinte manubri panca piana": "97/Dumbbell-bench-press",
  "spinte su panca inclinata (manubri)": "16/Incline-press",
  "spinte inclinata manubri": "16/Incline-press",
  "croci ai cavi in piedi": "71/Cable-crossover",
  "pectoral machine": "98/Butterfly-machine",
  "panca declinata": "100/Decline-bench-press",

  // --- schiena ---
  "rematore bilanciere": "109/Barbell-rear-delt-row",
  "rematore al cavo, presa neutra": "143/Cable-seated-rows",
  "rematore al cavo": "143/Cable-seated-rows",
  "pulley basso": "143/Cable-seated-rows",
  "stacco da terra": "161/Dead-lifts",
  "trazioni": "181/Chin-ups",
  "hyperextension": "128/Hyperextensions",

  // --- gambe ---
  "affondi con manubri": "113/Walking-lunges",
  "affondi manubri": "113/Walking-lunges",
  "leg curl": "154/lying-leg-curl-machine-large",

  // --- spalle ---
  "lento avanti bilanciere": "119/seated-barbell-shoulder-press-large",
  "lento avanti manubri": "123/dumbbell-shoulder-press-large",
  "alzate laterali": "148/lateral-dumbbell-raises-large",
  "scrollate": "151/Dumbbell-shrugs",

  // --- bicipiti ---
  "curl manubri": "81/Biceps-curl",
  "curl bilanciere": "74/Bicep-curls",
  "curl ez": "74/Bicep-curls",
  "curl alla scott": "193/Preacher-curl-3",
  "curl concentrato": "193/Preacher-curl-3",
  "hammer curl": "86/Bicep-hammer-curl",
  "curl ai cavi": "129/Standing-biceps-curl",

  // --- tricipiti ---
  "skullcrusher": "84/Lying-close-grip-triceps-press-to-chin",
  "french press": "84/Lying-close-grip-triceps-press-to-chin",

  // --- core ---
  "crunch a terra": "91/Crunches",
  "leg raise": "125/Leg-raises",
};

// { img1, img2 } per le voci mappate, { img1 } con il solo override utente,
// null se non c'è nulla (il chiamante non mostra il pannello media).
export function mediaFor(entry) {
  const ov = String(entry?.img ?? "").trim();
  if (ov) return { img1: ov };
  const base = MAP[norm(entry?.name)];
  return base ? { img1: `${WGER}/${base}-1.png`, img2: `${WGER}/${base}-2.png` } : null;
}
