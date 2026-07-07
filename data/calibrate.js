// Jalankan heuristik ke sample dataset Kaggle untuk kalibrasi rubric.
// Cara pakai: node data/calibrate.js data/raw/sample.csv
// (sesuaikan parsing kolom dengan struktur CSV asli dataset)

import fs from "fs";
import {
  analyzeStruktur,
  analyzeBahasaHeuristic,
  analyzeSEO,
  analyzeTeknis,
} from "../server/services/heuristics.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node data/calibrate.js <path-to-csv>");
  process.exit(1);
}

const rows = fs.readFileSync(filePath, "utf-8").split("\n").slice(1);
const scores = [];

for (const row of rows) {
  const text = row.trim();
  if (!text) continue;
  const struktur = analyzeStruktur(text);
  const bahasa = analyzeBahasaHeuristic(text);
  const seo = analyzeSEO(text);
  const teknis = analyzeTeknis(text);
  scores.push((struktur.score + bahasa.score + seo.score + teknis.score) / 4);
}

const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log(
  `Rata-rata skor heuristik dari ${scores.length} artikel: ${mean.toFixed(1)}`,
);
console.log(
  "Kalau jauh di bawah 75 padahal sumbernya Detik/Tempo/Kompas, threshold perlu dikalibrasi ulang.",
);
