// Kopiert die Dateien der Texterkennung (tesseract.js) nach public/tesseract,
// damit das Handy sie von unserer eigenen Adresse lädt und nicht von einem fremden CDN.
import { copyFileSync, mkdirSync } from "node:fs";

const ziel = "public/tesseract";
mkdirSync(ziel, { recursive: true });
const dateien = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz", "deu.traineddata.gz"],
];
for (const [von, nach] of dateien) copyFileSync(von, `${ziel}/${nach}`);
