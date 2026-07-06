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

// Weights (konten + etika = 0.45 via LLM, others = 0.55 via heuristics)
const WEIGHTS = {
  struktur: 0.20,
  bahasa: 0.15,
  seo: 0.10,
  teknis: 0.10,
  // LLM weights applied separately
};

// Thresholds for LLM bypass (cost optimization)
// If heuristic-only score is extreme, skip LLM
const HIGH_THRESHOLD = 85;
const LOW_THRESHOLD = 50;

const estimateHeuristicScore = (struktur, bahasa, seo, teknis) => {
  // ponytail: estimate without LLM weights (konten=30%, etika=15%)
  // Using heuristic-only scores as proxy
  const heuristicScore = Math.round(
    struktur.score * WEIGHTS.struktur +
    bahasa.score * WEIGHTS.bahasa +
    seo.score * WEIGHTS.seo +
    teknis.score * WEIGHTS.teknis
  );
  // Add estimated LLM contribution range
  return {
    heuristicOnly: heuristicScore,
    estimated: heuristicScore + 30  // ponytail: +30 as proxy for avg konten+etika
  };
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
        return res.status(400).json({ error: scrapeError.message });
      }
    }

    // Validasi: harus ada teks artikel
    if (!articleText || !articleText.trim()) {
      return res.status(400).json({ error: "Teks artikel atau URL diperlukan." });
    }

    // Cache berdasarkan teks artikel
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

    // Estimate score to decide LLM bypass
    const { heuristicOnly, estimated } = estimateHeuristicScore(struktur, bahasaHeuristik, seo, teknis);
    let skipLLM = estimated >= HIGH_THRESHOLD || estimated < LOW_THRESHOLD;

    let llmResult;
    if (!skipLLM) {
      // 2. LLM untuk konten & etika (borderline cases)
      llmResult = await evaluateWithLLM(articleText);
    } else {
      // Skip LLM - use heuristic estimates
      // ponytail: estimate based on structure quality
      const etikaEstimate = struktur.score >= 80 ? 75 : struktur.score >= 60 ? 65 : 55;
      const kontenEstimate = seo.score >= 70 ? 70 : seo.score >= 50 ? 60 : 50;
      llmResult = {
        konten: { score: kontenEstimate, note: "[Estimasi otomatis - ekstrim case]" },
        etika: { score: etikaEstimate, note: "[Estimasi otomatis - ekstrim case]" },
        nadaNote: "",
        highlights: []
      };
    }

    // 3. Gabungkan skor berbobot
    const overallScore = Math.round(
      llmResult.konten.score * 0.30 +
      struktur.score * 0.20 +
      bahasaHeuristik.score * 0.15 +
      llmResult.etika.score * 0.15 +
      seo.score * 0.10 +
      teknis.score * 0.10
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
        { name: "Bahasa & Gaya", value: String(bahasaHeuristik.score), text: bahasaHeuristik.notes.join(" "), weaknesses: bahasaHeuristik.weaknesses || [] },
        { name: "Etika & Legalitas", value: String(llmResult.etika.score), text: llmResult.etika.note },
        { name: "SEO & Audiens", value: String(seo.score), text: seo.notes.join(" ") },
        { name: "Pemeriksaan Teknis", value: String(teknis.score), text: teknis.notes.join(" "), weaknesses: teknis.weaknesses || [] },
      ],
      highlights: llmResult.highlights,
      sourceUrl: sourceUrl,
      sourceDomain: sourceDomain,
      skippedLLM: skipLLM
    };

    setCached(cacheKey, result);
    
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Terjadi kesalahan saat analisis." });
  }
});

export default router;
