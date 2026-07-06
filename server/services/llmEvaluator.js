// Panggil LLM HANYA untuk kriteria yang butuh judgment kualitatif
// (Konten & Sumber, Etika & Legalitas) - bagian lain sudah dinilai heuristik,
// supaya hemat token & biaya.

import { config } from "../config.js";

const SYSTEM_PROMPT = `Anda adalah redaktur senior media berita Indonesia dengan pengalaman 15+ tahun, yang juga memahami cara mesin (Google Search, AI Overview, Google Discover, LLM/Chatbot, Google News) mendistribusikan dan mengutip konten berita.

Tugas Anda HANYA menilai 3 dimensi berikut (dimensi lain sudah dinilai terpisah):

1. Konten & Sumber (skor 0-100) - newsworthiness, originalitas, relevansi audiens.

2. Etika & Legalitas (skor 0-100) - bias/keberimbangan, fitnah, privasi.

3. Struktur & Distribusi Mesin (skor 0-100) - seberapa optimal struktur artikel untuk dibaca dan disitasi oleh mesin (search engine, AI Overview, LLM). Gunakan kriteria berikut sebagai acuan penilaian:

   a. Lead (40-60 kata): Apakah paragraf pertama langsung memuat fakta/jawaban utama (5W1H) tanpa basa-basi pembuka? Lead kosong atau generik = skor rendah, karena ini adalah window ekstraksi utama AI (44% sitasi AI berasal dari 30% awal teks).

   b. Penggunaan subjudul (H3) sesuai panjang artikel:
      - <400 kata: H3 tidak wajib.
      - 400-800 kata: idealnya minimal 2 H3.
      - >800 kata: idealnya minimal 3-4 H3.
      Artikel panjang tanpa H3 = skor rendah (pola "belah ketupat", skor mesin terendah).

   c. Section mandiri: jika ada H3, apakah paragraf pertama setelah tiap H3 langsung menjawab section tersebut (bukan basa-basi transisi)? AI bisa "mendarat" di tengah artikel, jadi tiap section harus bisa berdiri sendiri sebagai unit yang bisa disitasi.

   d. Kepadatan fakta: apakah ada angka, data, atau kutipan konkret setiap kurang lebih 150-200 kata? Paragraf naratif tanpa fakta baru dianggap "paragraf mati" untuk mesin.

   e. Pola struktur keseluruhan: identifikasi apakah artikel mengikuti pola piramida terbalik biasa (fakta di depan, tapi flat), piramida terbalik berlapis (jawaban utama + tiap H3 punya jawaban sendiri = paling optimal), atau belah ketupat (lead diulur, klimaks di tengah = paling buruk untuk mesin).

Catatan SINGKAT - maksimal 100 karakter per note.
Tandai highlight SINGKAT - cukup 1-2 per dimensi.

Balas HANYA JSON valid:
{"konten":{"score":0,"note":""},"etika":{"score":0,"note":""},"strukturDistribusi":{"score":0,"note":""},"nadaNote":"","highlights":[]}`;

const parseJSON = (text) => {
  let clean = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  
  // Try normal parse first
  try {
    return JSON.parse(clean);
  } catch {
    // Truncated JSON - try to extract complete objects
    // Find closing brace for konten and etika (required fields)
    const kontenMatch = clean.match(/"konten"\s*:\s*\{\s*"score"\s*:\s*(\d+)\s*,\s*"note"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
    const etikaMatch = clean.match(/"etika"\s*:\s*\{\s*"score"\s*:\s*(\d+)\s*,\s*"note"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
    
    if (kontenMatch && etikaMatch) {
      // Extract highlights array if present
      const highlightsMatch = clean.match(/"highlights"\s*:\s*\[([^\]]*)/);
      const nadaMatch = clean.match(/"nadaNote"\s*:\s*"([^"]*)"/);
      
      return {
        konten: { score: parseInt(kontenMatch[1]), note: kontenMatch[2] || "" },
        etika: { score: parseInt(etikaMatch[1]), note: etikaMatch[2] || "" },
        nadaNote: nadaMatch ? nadaMatch[1] : "",
        highlights: []
      };
    }
    
    throw new Error(`JSON tidak valid: ${clean.slice(0, 150)}...`);
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const evaluateWithLLM = async (articleText, retries = 2) => {
  // Truncate article to ~6000 chars to keep response manageable
  const truncatedText = articleText.length > 6000 
    ? articleText.slice(0, 6000) + "\n...[artikel dipotong]..." 
    : articleText;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://gateway.olagon.site/anthropic/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 800,  // ponytail: reduced - notes should be brief
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: `Artikel:\n"""\n${truncatedText}\n"""` },
          ],
        }),
      });

      // Handle overload (529) with retry
      if (response.status === 529 || response.status === 429) {
        if (attempt < retries) {
          await sleep((attempt + 1) * 2000); // 2s, 4s backoff
          continue;
        }
        throw new Error(`API overloaded. Coba lagi nanti.`);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const textBlock = data.content?.find((c) => c.type === "text");
      if (!textBlock) throw new Error("Respons LLM tidak mengandung teks.");

      return parseJSON(textBlock.text);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep((attempt + 1) * 1000);
    }
  }
};
