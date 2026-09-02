const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = [
  "index.html",
  "manifest.webmanifest",
  "sw.js"
];

for (const file of files) {
  fs.copyFileSync(
    path.join(root, file),
    path.join(out, file)
  );
}

fs.cpSync(
  path.join(root, "icons"),
  path.join(out, "icons"),
  { recursive: true }
);

console.log("Build completata: www/");
