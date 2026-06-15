// demo-export.js
// Costruisce il payload di export del blob demo (puro). Il download vero (Blob +
// <a download>) sta nel cablaggio UI: qui solo dati, così è testabile in Node.
export function buildDemoExport(blob, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return {
    filename: `set-log-demo-${day}.json`,
    json: JSON.stringify(blob, null, 2),
  };
}
