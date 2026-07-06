// Panggil LLM HANYA untuk kriteria yang butuh judgment kualitatif
// (Konten & Sumber, Etika & Legalitas) - bagian lain sudah dinilai heuristik,
// supaya hemat token & biaya.

import { config } from "../config.js";

const SYSTEM_PROMPT = `Anda adalah redaktur senior media berita Indonesia dengan pengalaman 15+ tahun,
terlatih pada Pedoman Pemberitaan Media Siber (Dewan Pers) dan Kode Etik Jurnalistik PWI/Kompas.

Tugas Anda HANYA menilai 2 dimensi berikut (dimensi lain sudah dinilai terpisah):

1. Konten & Sumber (skor 0-100) - newsworthiness, originalitas, relevansi audiens,
   kebaruan, jenis sumber, atribusi, verifikasi.
2. Etika & Legalitas (skor 0-100) - bias/keberimbangan, fitnah, privasi, izin kutipan/foto.

Juga beri catatan singkat soal nada bahasa (netral/tidak).

Penalti berat pada Etika & Legalitas jika: tuduhan tanpa dasar, pelanggaran privasi
korban/anak, atau bias SARA eksplisit.

Tandai kalimat/paragraf bermasalah sebagai highlight ("bad" = pelanggaran serius,
"warn" = perlu perbaikan, "good" = contoh baik). Catatan harus spesifik ke teks
artikel, bukan template generik.

Balas HANYA JSON, tanpa teks lain di luar JSON:
{
  "konten": { "score": number, "note": string },
  "etika": { "score": number, "note": string },
  "nadaNote": string,
  "highlights": [{ "type": "good"|"warn"|"bad", "text": string, "note": string }]
}`;

export const evaluateWithLLM = async (articleText) => {
  const response = await fetch("https://gateway.olagon.site/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5", // cek model string yang tersedia di akun/API key kamu
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Artikel yang dinilai:\n"""\n${articleText}\n"""` },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("Respons LLM tidak mengandung teks.");

  try {
    // Bersihkan markdown code fences dari response LLM
    let cleanText = textBlock.text.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleanText);
  } catch {
    throw new Error(`Gagal parse JSON dari LLM: ${textBlock.text.slice(0, 200)}`);
  }
};