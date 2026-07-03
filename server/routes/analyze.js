import { Router } from "express";
import {
  analyzeStruktur,
  analyzeBahasaHeuristic,
  analyzeSEO,
  analyzeTeknis,
} from "../services/heuristics.js";
import { evaluateWithLLM } from "../services/llmEvaluator.js";
import { hashText, getCached, setCached } from "../services/cache.js";
import { fetchArticleFromUrl } from "../services/urlScraper.js";

const router = Router();

// bobot sesuai Standar_Penilaian_Artikel_AI.md
const WEIGHTS = {
  konten: 0.3,
  struktur: 0.2,
  bahasa: 0.15,
  etika: 0.15,
  seo: 0.1,
  teknis: 0.1,
};

router.post("/analyze", async (req, res) => {
  const { text, url } = req.body;

  try {
    let articleText = text;
    let sourceUrl = null;
    let sourceDomain = null;

    // Jika text kosong tapi ada URL, fetch artikel dari URL
    if ((!articleText || !articleText.trim()) && url && url.trim()) {
      try {
        const scraped = await fetchArticleFromUrl(url);
        articleText = scraped.text;
        sourceUrl = url;
        sourceDomain = scraped.domain;
      } catch (scrapeError) {
        // Kembalikan error scraping ke frontend
        return res.status(400).json({ error: scrapeError.message });
      }
    }

    // Validasi: harus ada teks artikel
    if (!articleText || !articleText.trim()) {
      return res.status(400).json({ error: "Teks artikel atau URL diperlukan." });
    }

    // Cache berdasarkan teks artikel (hash dari teks, bukan URL)
    const cacheKey = hashText(articleText);
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ 
        ...cached, 
        fromCache: true,
        sourceUrl: sourceUrl,
        sourceDomain: sourceDomain
      });
    }

    // 1. Heuristik dulu (instan, gratis)
    const struktur = analyzeStruktur(articleText);
    const bahasaHeuristik = analyzeBahasaHeuristic(articleText);
    const seo = analyzeSEO(articleText);
    const teknis = analyzeTeknis(articleText);

    // 2. LLM hanya untuk bagian yang butuh judgment
    const llmResult = await evaluateWithLLM(articleText);

    // 3. Gabungkan jadi skor akhir berbobot
    const overallScore = Math.round(
      llmResult.konten.score * WEIGHTS.konten +
        struktur.score * WEIGHTS.struktur +
        bahasaHeuristik.score * WEIGHTS.bahasa +
        llmResult.etika.score * WEIGHTS.etika +
        seo.score * WEIGHTS.seo +
        teknis.score * WEIGHTS.teknis,
    );

    const verdict =
      overallScore >= 75 ? "Layak terbit" : overallScore >= 50 ? "Perlu revisi" : "Ditolak";

    const result = {
      overallScore,
      verdict,
      summary: llmResult.konten.note,
      details: [
        { name: "Konten & Sumber", value: String(llmResult.konten.score), text: llmResult.konten.note },
        { name: "Struktur/Format", value: String(struktur.score), text: struktur.notes.join(" ") },
        { name: "Bahasa & Gaya", value: String(bahasaHeuristik.score), text: `${bahasaHeuristik.notes.join(" ")} ${llmResult.nadaNote}` },
        { name: "Etika & Legalitas", value: String(llmResult.etika.score), text: llmResult.etika.note },
        { name: "SEO & Audiens", value: String(seo.score), text: seo.notes.join(" ") },
        { name: "Pemeriksaan Teknis", value: String(teknis.score), text: teknis.notes.join(" ") },
      ],
      highlights: llmResult.highlights,
      sourceUrl: sourceUrl,
      sourceDomain: sourceDomain
    };

    setCached(cacheKey, result);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Terjadi kesalahan saat analisis." });
  }
});

export default router;
