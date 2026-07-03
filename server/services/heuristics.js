// Kriteria yang bisa dihitung otomatis tanpa LLM 

const clean = (text) => text.trim().replace(/\s+/g, " ");

const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

const countSyllablesID = (word) => {
  // aproksimasi jumlah suku kata Bahasa Indonesia (hitung vokal berurutan)
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

export const analyzeStruktur = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const leadWords = countWords(firstParagraph);

  const notes = [];
  let score = 100;

  if (leadWords > 35) {
    score -= 15;
    notes.push(`Lead terlalu panjang (${leadWords} kata, ambang 35).`);
  }
  if (paragraphs.length < 3) {
    score -= 10;
    notes.push("Struktur artikel terlalu pendek untuk piramida terbalik yang jelas.");
  }
  if (!hasAttribution(text)) {
    score -= 15;
    notes.push('Tidak ditemukan kata atribusi ("menurut", "ujar", dsb).');
  }

  return { score: Math.max(0, score), notes, meta: { leadWords, paragraphCount: paragraphs.length } };
};

export const analyzeBahasaHeuristic = (text) => {
  const readability = fleschReadingEaseID(text);
  const passiveRatio = estimatePassiveRatio(text);
  const notes = [];
  let score = 100;

  if (readability < 50) {
    score -= 20;
    notes.push(`Skor keterbacaan rendah (≈${readability}, target ≥50).`);
  }
  if (passiveRatio > 0.5) {
    score -= 15;
    notes.push(`Rasio kalimat pasif tinggi (≈${Math.round(passiveRatio * 100)}%).`);
  }

  return { score: Math.max(0, score), notes, meta: { readability, passiveRatio } };
};

export const analyzeSEO = (text, targetKeyword = "") => {
  const words = countWords(text);
  const notes = [];
  let score = 100;

  if (words < 500) {
    score -= 20;
    notes.push(`Panjang artikel ${words} kata, di bawah target minimal 500 kata.`);
  }
  if (targetKeyword) {
    const occurrences = (text.match(new RegExp(targetKeyword, "gi")) || []).length;
    const density = words > 0 ? occurrences / words : 0;
    if (density < 0.005) {
      score -= 15;
      notes.push(`Kata kunci "${targetKeyword}" jarang muncul di teks.`);
    }
  }

  return { score: Math.max(0, score), notes, meta: { words } };
};

export const analyzeTeknis = (text) => {
  const notes = [];
  let score = 100;

  const doubleSpaces = (text.match(/\s{2,}/g) || []).length;
  if (doubleSpaces > 3) {
    score -= 5;
    notes.push("Ditemukan banyak spasi ganda / formatting tidak rapi.");
  }
  notes.push("Catatan: cek plagiarisme & typo mendalam belum aktif (butuh API eksternal, mis. LanguageTool).");

  return { score: Math.max(0, score), notes };
};

export { countWords };