// Composizione della barra azioni del focus esercizio (layout "una pagina").
// Pura e testabile: app.js mappa questa spec su veri <button> con i suoi handler.
// `comment` e `fail` agiscono sulla serie in corso → assenti quando allDone.
export function actionBarSpec({ allDone, drawerOpen }) {
  const spec = [{ key: "rest", glyph: "⏱", label: "recupero" }];
  if (!allDone) {
    spec.push({ key: "comment", glyph: "💬", label: "commenti" });
    spec.push({ key: "fail", glyph: "✗", label: "fail" });
  }
  spec.push({ key: "more", glyph: "⋯", label: "altro", active: !!drawerOpen });
  return spec;
}
