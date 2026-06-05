import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaFor, MAP } from "../media-map.js";

test("mediaFor: voce mappata → due frame wger", () => {
  const m = mediaFor({ name: "Panca piana bilanciere", img: "" });
  assert.equal(m.img1, "https://wger.de/media/exercise-images/192/Bench-press-1.png");
  assert.equal(m.img2, "https://wger.de/media/exercise-images/192/Bench-press-2.png");
});

test("mediaFor: match case-insensitive con spazi", () => {
  assert.ok(mediaFor({ name: "  CRUNCH a terra " }));
});

test("mediaFor: override img vince sulla mappa (frame singolo)", () => {
  const m = mediaFor({ name: "Panca piana bilanciere", img: "https://x/y.png" });
  assert.deepEqual(m, { img1: "https://x/y.png" });
});

test("mediaFor: voce non mappata → null (fallback: solo figura)", () => {
  assert.equal(mediaFor({ name: "Esercizio inventato", img: "" }), null);
  assert.equal(mediaFor(null), null);
});

const norm = (s) => String(s).trim().toLowerCase();

// MAP-driven: itera sulla mappa esportata, così ogni voce aggiunta in futuro
// è coperta automaticamente (formato chiave/valore + URL prodotte da mediaFor).
test("MAP: ogni voce produce due frame wger ben formati via mediaFor", () => {
  const names = Object.keys(MAP);
  assert.ok(names.length >= 17, "la mappa non deve svuotarsi per sbaglio");
  for (const nome of names) {
    assert.equal(nome, norm(nome), `${nome}: chiave MAP non normalizzata`);
    assert.match(MAP[nome], /^\d+\/[\w-]+$/, `${nome}: valore atteso "<id>/<NomeFile>"`);
    const m = mediaFor({ name: nome });
    assert.ok(m !== null, `${nome} deve essere mappato`);
    assert.ok(m.img1.startsWith("https://wger.de/media/exercise-images/"), `${nome} img1 URL errata`);
    assert.ok(m.img1.endsWith("-1.png"), `${nome} img1 deve finire con -1.png`);
    assert.ok(m.img2.endsWith("-2.png"), `${nome} img2 deve finire con -2.png`);
  }
});
