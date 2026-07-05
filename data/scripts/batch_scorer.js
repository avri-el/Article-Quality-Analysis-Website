/**
 * Batch Scorer Script
 * Scoring 20k articles dari dataset untuk generate silver labels
 * 
 * Usage: node data/scripts/batch_scorer.js
 * 
 * Features:
 * - Checkpoint/resume capability
 * - Progress bar dengan ETA
 * - Concurrency limiting
 * - Error handling
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";

// Setup paths first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Load .env
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const RAW_CSV = path.join(DATA_DIR, "raw/final_merge_dataset.csv");
const LABELED_DIR = path.join(DATA_DIR, "labeled");
const OUTPUT_FILE = path.join(LABELED_DIR, "silver_20k.csv");
const CHECKPOINT_FILE = path.join(LABELED_DIR, "scoring_checkpoint.json");
const PROGRESS_FILE = path.join(LABELED_DIR, "scoring_progress.json");

// Config
const TARGET_COUNT = 150;
const BATCH_SIZE = 10; // Save checkpoint every N articles
const CONCURRENCY = 5; // Parallel API calls
const CHECKPOINT_INTERVAL = BATCH_SIZE;

// Heuristic analysis functions (copied from heuristics.js)
const clean = (text) => text.trim().replace(/\s+/g, " ");
const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

const countSyllablesID = (word) => {
  const matches = word.toLowerCase().match(/[aiueo]+/g);
  return matches ? matches.length : 1;
};

const fleschReadingEaseID = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (sentences.length === 0 || words.length === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllablesID(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const estimatePassiveRatio = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const passivePattern = /\b(di[a-z]+ oleh|ter[a-z]+ oleh)\b/i;
  const passiveCount = sentences.filter((s) => passivePattern.test(s)).length;
  return passiveCount / sentences.length;
};

const hasAttribution = (text) => /\b(menurut|ujar|kata|jelas\w*|tutur|sebut\w*)\b/i.test(text);

const analyzeStruktur = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const leadWords = countWords(firstParagraph);
  const notes = [];
  let score = 100;
  if (leadWords > 35) { score -= 15; notes.push(`Lead terlalu panjang (${leadWords} kata, ambang 35).`); }
  if (paragraphs.length < 3) { score -= 10; notes.push("Struktur artikel terlalu pendek."); }
  if (!hasAttribution(text)) { score -= 15; notes.push('Tidak ada atribusi.'); }
  return { score: Math.max(0, score), notes, meta: { leadWords, paragraphCount: paragraphs.length } };
};

const analyzeBahasaHeuristic = (text) => {
  const readability = fleschReadingEaseID(text);
  const passiveRatio = estimatePassiveRatio(text);
  const notes = [];
  let score = 100;
  if (readability < 50) { score -= 20; notes.push(`Readability rendah (≈${readability}).`); }
  if (passiveRatio > 0.5) { score -= 15; notes.push(`Passive ratio tinggi (≈${Math.round(passiveRatio * 100)}%).`); }
  return { score: Math.max(0, score), notes, meta: { readability, passiveRatio } };
};

const analyzeSEO = (text) => {
  const words = countWords(text);
  const notes = [];
  let score = 100;
  if (words < 500) { score -= 20; notes.push(`Panjang ${words} kata, < 500.`); }
  return { score: Math.max(0, score), notes, meta: { words } };
};

const analyzeTeknis = (text) => {
  const notes = [];
  let score = 100;
  const doubleSpaces = (text.match(/\s{2,}/g) || []).length;
  if (doubleSpaces > 3) { score -= 5; notes.push("Spasi ganda."); }
  return { score: Math.max(0, score), notes };
};

// LLM evaluation
const SYSTEM_PROMPT = `Anda adalah redaktur senior media berita Indonesia dengan pengalaman 15+ tahun.
Tugas Anda HANYA menilai 2 dimensi:
1. Konten & Sumber (skor 0-100) - newsworthiness, originalitas, sumber
2. Etika & Legalitas (skor 0-100) - bias, fitnah, privasi

Balas HANYA JSON:
{
  "konten": { "score": number, "note": string },
  "etika": { "score": number, "note": string },
  "nadaNote": string,
  "highlights": [{ "type": "good"|"warn"|"bad", "text": string, "note": string }]
}`;

const evaluateWithLLM = async (articleText, apiKey) => {
  const response = await fetch("https://gateway.olagon.site/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Artikel:\n"""\n${articleText.slice(0, 8000)}\n"""` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((c) => c.type === "text");
  if (!textBlock) throw new Error("No text in response");

  let cleanText = textBlock.text.trim();
  cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleanText);
};

// Scoring weights
const WEIGHTS = {
  konten: 0.3, struktur: 0.2, bahasa: 0.15, etika: 0.15, seo: 0.1, teknis: 0.1
};

// Analyze single article
const analyzeArticle = async (article, apiKey) => {
  const struktur = analyzeStruktur(article.Content);
  const bahasa = analyzeBahasaHeuristic(article.Content);
  const seo = analyzeSEO(article.Content);
  const teknis = analyzeTeknis(article.Content);

  let llmResult = { konten: { score: 50, note: "" }, etika: { score: 50, note: "" }, nadaNote: "", highlights: [] };
  try {
    llmResult = await evaluateWithLLM(article.Content, apiKey);
  } catch (err) {
    console.warn(`  LLM error for ${article.Link}: ${err.message}`);
  }

  const overallScore = Math.round(
    llmResult.konten.score * WEIGHTS.konten +
    struktur.score * WEIGHTS.struktur +
    bahasa.score * WEIGHTS.bahasa +
    llmResult.etika.score * WEIGHTS.etika +
    seo.score * WEIGHTS.seo +
    teknis.score * WEIGHTS.teknis
  );

  const verdict = overallScore >= 75 ? "Layak terbit" : overallScore >= 50 ? "Perlu revisi" : "Ditolak";

  return {
    article_id: article._index || 0,
    judul: article.Judul,
    link: article.Link,
    source: article.source || article.source || "",
    waktu: article.Waktu,
    konten_score: llmResult.konten.score,
    struktur_score: struktur.score,
    bahasa_score: bahasa.score,
    etika_score: llmResult.etika.score,
    seo_score: seo.score,
    teknis_score: teknis.score,
    overall_score: overallScore,
    verdict: verdict,
    konten_note: llmResult.konten.note || "",
    etika_note: llmResult.etika.note || "",
    nada_note: llmResult.nadaNote || "",
    highlights_json: JSON.stringify(llmResult.highlights || []),
    word_count: seo.meta?.words || 0,
    readability: bahasa.meta?.readability || 0,
  };
};

// Parse CSV to array
const parseCSV = (text) => {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  
  let currentRow = "";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Count quotes to detect multi-line fields
    const openQuotes = (currentRow + line).match(/"/g)?.length || 0;
    
    if (openQuotes % 2 === 0 && currentRow === "") {
      // Complete row
      rows.push(parseRow(line, headers));
    } else {
      // Continue multi-line
      currentRow += "\n" + line;
      if (openQuotes % 2 === 0) {
        rows.push(parseRow(currentRow, headers));
        currentRow = "";
      }
    }
  }
  return rows.filter(r => r && r.Content && r.Content.length > 100);
};

const parseRow = (line, headers) => {
  // Simple CSV parser for quoted fields
  const values = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""));
  
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i] || "";
  });
  return obj;
};

// Progress display
const showProgress = (current, total, startTime) => {
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = current / elapsed;
  const remaining = (total - current) / rate;
  const pct = ((current / total) * 100).toFixed(1);
  
  const bar = "=".repeat(Math.floor(current / total * 30)) + "-".repeat(30 - Math.floor(current / total * 30));
  const eta = remaining > 60 ? `${Math.ceil(remaining / 60)}m` : `${Math.ceil(remaining)}s`;
  
  process.stdout.write(`\r[${bar}] ${pct}% (${current}/${total}) - ETA: ${eta}    `);
};

// Main function
const main = async () => {
  console.log("=".repeat(60));
  console.log("BATCH ARTICLE SCORER");
  console.log("=".repeat(60));
  
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY not set in .env");
    process.exit(1);
  }
  
  // Create labeled directory
  if (!fs.existsSync(LABELED_DIR)) {
    fs.mkdirSync(LABELED_DIR, { recursive: true });
  }
  
  // Load progress/checkpoint
  let checkpoint = { scored: 0, results: [] };
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
    console.log(`Resuming from checkpoint: ${checkpoint.scored} articles already scored`);
  }
  
  // Load dataset
  console.log("Loading dataset...");
  const csvText = fs.readFileSync(RAW_CSV, "utf-8");
  let articles = parseCSV(csvText);
  console.log(`Total articles in dataset: ${articles.length}`);
  
  // Limit to 20k
  if (articles.length > TARGET_COUNT) {
    articles = articles.slice(0, TARGET_COUNT);
    console.log(`Limited to ${TARGET_COUNT} articles`);
  }
  
  // Add index to articles
  articles = articles.map((a, i) => ({ ...a, _index: i }));
  
  // Skip already scored
  const articlesToScore = articles.slice(checkpoint.scored);
  console.log(`Articles to score: ${articlesToScore.length}`);
  
  if (articlesToScore.length === 0) {
    console.log("\nAll articles already scored! Generating final CSV...");
    saveResults(checkpoint.results, OUTPUT_FILE);
    return;
  }
  
  const startTime = Date.now();
  
  // Process with concurrency
  let batch = [];
  for (let i = 0; i < articlesToScore.length; i++) {
    batch.push(analyzeArticle(articlesToScore[i], apiKey));
    
    if (batch.length >= CONCURRENCY || i === articlesToScore.length - 1) {
      const results = await Promise.all(batch);
      checkpoint.results.push(...results);
      checkpoint.scored += results.length;
      batch = [];
      
      showProgress(checkpoint.scored, articles.length, startTime);
      
      // Save checkpoint
      if (checkpoint.scored % CHECKPOINT_INTERVAL === 0) {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));
      }
    }
    
    // Rate limiting - delay between batches
    if (batch.length === 0 && i < articlesToScore.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log("\n\nSaving final results...");
  
  // Final save
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));
  saveResults(checkpoint.results, OUTPUT_FILE);
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SCORING COMPLETE!");
  console.log("=".repeat(60));
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Total scored: ${checkpoint.results.length}`);
  
  // Stats
  const verdicts = { "Layak terbit": 0, "Perlu revisi": 0, "Ditolak": 0 };
  checkpoint.results.forEach(r => verdicts[r.verdict]++);
  
  console.log("\nVerdict Distribution:");
  console.log(`  Layak terbit: ${verdicts["Layak terbit"]} (${((verdicts["Layak terbit"] / checkpoint.results.length) * 100).toFixed(1)}%)`);
  console.log(`  Perlu revisi: ${verdicts["Perlu revisi"]} (${((verdicts["Perlu revisi"] / checkpoint.results.length) * 100).toFixed(1)}%)`);
  console.log(`  Ditolak:      ${verdicts["Ditolak"]} (${((verdicts["Ditolak"] / checkpoint.results.length) * 100).toFixed(1)}%)`);
  
  const avgScore = checkpoint.results.reduce((sum, r) => sum + r.overall_score, 0) / checkpoint.results.length;
  console.log(`\nAverage Score: ${avgScore.toFixed(1)}`);
};

const saveResults = (results, outputPath) => {
  if (results.length === 0) return;
  
  const headers = [
    "article_id", "judul", "link", "source", "waktu",
    "konten_score", "struktur_score", "bahasa_score", "etika_score", "seo_score", "teknis_score",
    "overall_score", "verdict",
    "konten_note", "etika_note", "nada_note",
    "highlights_json", "word_count", "readability"
  ];
  
  const csvRows = [headers.join(",")];
  
  results.forEach(r => {
    const row = headers.map(h => {
      const val = r[h];
      if (val === undefined || val === null) return "";
      const str = String(val);
      // Escape quotes and wrap if contains comma
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(row.join(","));
  });
  
  fs.writeFileSync(outputPath, csvRows.join("\n"), "utf-8");
  console.log(`Saved ${results.length} rows to ${outputPath}`);
};

// Run
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
