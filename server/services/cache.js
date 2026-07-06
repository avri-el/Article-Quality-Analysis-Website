// Cache berbasis file JSON, key = hash artikel.
// Tujuan: hindari panggil LLM berulang untuk teks yang sama
// (hemat biaya saat testing/revisi berulang).

import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.resolve("server/.cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

export const hashText = (text) =>
  crypto.createHash("sha256").update(text.trim()).digest("hex");

export const getCached = (key) => {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

export const setCached = (key, value) => {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};
