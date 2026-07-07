// Panggil LLM HANYA untuk kriteria yang butuh judgment kualitatif
// (Konten & Sumber, Etika & Legalitas) - bagian lain sudah dinilai heuristik,
// supaya hemat token & biaya.

import { config } from "../config.js";

// OPTIMIZED: ~300 tokens (was ~800 tokens)
// Prioritas: akurat tapi ringkas
const SYSTEM_PROMPT = `Anda redaktur senior media Indonesia. Nilai artikel ini:

1. KONTEN & SUMBER (0-100): newsworthiness, originalitas, relevansi audiens.

2. ETIKA & LEGALITAS (0-100): bias/keberimbangan, fitnah (tuduhan tanpa bukti), privasi.

CATATAN: Maksimal 80 karakter per note. Highlight SINGKAT 1-2 per dimensi.

BALAS HANYA JSON valid:
{"konten":{"score":0,"note":""},"etika":{"score":0,"note":""},"nadaNote":"","highlights":[]}`;

const parseJSON = (text) => {
  let clean = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  // Try normal parse first
  try {
    return JSON.parse(clean);
  } catch {
    // Truncated JSON - try to extract complete objects
    // Find closing brace for konten and etika (required fields)
    const kontenMatch = clean.match(
      /"konten"\s*:\s*\{\s*"score"\s*:\s*(\d+)\s*,\s*"note"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/,
    );
    const etikaMatch = clean.match(
      /"etika"\s*:\s*\{\s*"score"\s*:\s*(\d+)\s*,\s*"note"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/,
    );

    if (kontenMatch && etikaMatch) {
      // Extract highlights array if present
      const highlightsMatch = clean.match(/"highlights"\s*:\s*\[([^\]]*)/);
      const nadaMatch = clean.match(/"nadaNote"\s*:\s*"([^"]*)"/);
      return {
        konten: { score: parseInt(kontenMatch[1]), note: kontenMatch[2] || "" },
        etika: { score: parseInt(etikaMatch[1]), note: etikaMatch[2] || "" },
        nadaNote: nadaMatch ? nadaMatch[1] : "",
        highlights: [],
      };
    }

    throw new Error(`JSON tidak valid: ${clean.slice(0, 150)}...`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const evaluateWithLLM = async (articleText, retries = 2) => {
  // OPTIMIZED: Truncate to ~4000 chars (was 6000) - lead + samples enough
  // Keep first 3000 chars + last 1000 chars for context
  let truncatedText = articleText;
  if (articleText.length > 4000) {
    const first = articleText.slice(0, 3000);
    const last = articleText.slice(-1000);
    truncatedText = first + "\n...[middle omitted]...\n" + last;
  }
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://gateway.olagon.site/anthropic/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.anthropicApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 600, // OPTIMIZED: reduced from 800
            system: SYSTEM_PROMPT,
            messages: [
              { role: "user", content: `Artikel:\n"""\n${truncatedText}\n"""` },
            ],
          }),
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 600,  // OPTIMIZED: reduced from 800
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
