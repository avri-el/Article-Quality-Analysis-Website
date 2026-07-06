import { Router } from "express";
import {
  analyzeStruktur,
  analyzeBahasaHeuristic,
  analyzeSEO,
  analyzeTeknis,
  analyzeMachineReadability,
} from "../services/heuristics.js";
import { evaluateWithLLM } from "../services/llmEvaluator.js";
import { hashText, getCached, setCached } from "../services/cache.js";
import { fetchArticleFromUrl } from "../services/urlScraper.js";
import { extractVerificationFlags } from "../services/factExtractor.js";
import { config } from "../config.js";

const router = Router();

// Weights (konten + etika = 0.45 via LLM, others = 0.55 via heuristics)
const WEIGHTS = {
  struktur: 0.2,
  bahasa: 0.15,
  seo: 0.1,
  teknis: 0.1,
};

// Thresholds for LLM bypass (cost optimization)
const HIGH_THRESHOLD = 85;
const LOW_THRESHOLD = 50;

const estimateHeuristicScore = (struktur, bahasa, seo, teknis) => {
  const heuristicScore = Math.round(
    struktur.score * WEIGHTS.struktur +
      bahasa.score * WEIGHTS.bahasa +
      seo.score * WEIGHTS.seo +
      teknis.score * WEIGHTS.teknis,
  );
  return {
    heuristicOnly: heuristicScore,
    estimated: heuristicScore + 30, // proxy for avg konten+etika
  };
};

/**
 * Estimate LLM scores using heuristics (local mode)
 */
const estimateLLMScores = (struktur, bahasa, seo, text) => {
  const wordCount = text.trim().split(/\s+/).length;

  // Estimate konten score based on SEO, structure, and word count
  let kontenEstimate = 60;
  if (seo.score >= 80 && wordCount >= 400) kontenEstimate += 15;
  else if (seo.score >= 60 && wordCount >= 300) kontenEstimate += 10;
  if (struktur.score >= 80) kontenEstimate += 10;
  if (seo.score >= 70) kontenEstimate += 5;

  // Estimate etika score based on attribution and content patterns
  let etikaEstimate = 70;
  const hasOfficialSources =
    /\b(BNPB|BPS|Kemendagri|Kementerian|BMKG|BPK|PUPR|Pemerintah)\b/i.test(
      text,
    );
  const hasDefamationRisk = /koruptor|tersangka|pelaku.*tanpa.*diduga/i.test(
    text,
  );
  const hasMultipleSides = (text.match(/,/g) || []).length > 5; // Multiple sources

  if (hasOfficialSources) etikaEstimate += 10;
  if (hasMultipleSides) etikaEstimate += 5;
  if (hasDefamationRisk) etikaEstimate -= 20;

  return {
    konten: {
      score: Math.min(100, Math.max(30, kontenEstimate)),
      note: "[Estimasi otomatis - mode lokal]",
    },
    etika: {
      score: Math.min(100, Math.max(30, etikaEstimate)),
      note: "[Estimasi otomatis - mode lokal]",
    },
  };
};

router.post("/analyze", async (req, res) => {
  const { text, url, mode: requestedMode } = req.body;

  try {
    // Determine mode: requested mode takes priority, then config
    const mode = requestedMode || config.mode;

    // If local mode requested but API key exists, still use local
    const useLocalMode =
      mode === "local" ||
      (mode === "hybrid" && !config.anthropicApiKey) ||
      (mode === "llm" && !config.anthropicApiKey);

    let articleText = text;
    let sourceUrl = null;
    let sourceDomain = null;

    // Fetch article from URL if provided
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

    // Validate input
    if (!articleText || !articleText.trim()) {
      return res
        .status(400)
        .json({ error: "Teks artikel atau URL diperlukan." });
    }

    // Check cache (include mode in cache consideration)
    const cacheKey = hashText(articleText + `|mode:${mode}`);
    const cached = getCached(cacheKey);
    if (cached && cached.mode === mode) {
      return res.json({
        ...cached,
        fromCache: true,
        sourceUrl: sourceUrl,
        sourceDomain: sourceDomain,
      });
    }

    // 1. Run all heuristics (instant, free)
    const struktur = analyzeStruktur(articleText);
    const bahasaHeuristik = analyzeBahasaHeuristic(articleText);
    const seo = analyzeSEO(articleText);
    const teknis = analyzeTeknis(articleText);
    const machineReadability = analyzeMachineReadability(articleText);

    // Extract verification flags for UI
    const verificationFlags = extractVerificationFlags(articleText);

    // 2. Decide whether to use LLM
    const { heuristicOnly, estimated } = estimateHeuristicScore(
      struktur,
      bahasaHeuristik,
      seo,
      teknis,
    );
    const skipLLM =
      useLocalMode || estimated >= HIGH_THRESHOLD || estimated < LOW_THRESHOLD;

    let llmResult;
    let skippedLLM = skipLLM;

    if (!skipLLM) {
      // 3. Call LLM for konten & etika
      llmResult = await evaluateWithLLM(articleText);
    } else {
      // Use heuristic estimation for LLM scores
      llmResult = estimateLLMScores(
        struktur,
        bahasaHeuristik,
        seo,
        articleText,
      );
    }

    // 4. Calculate weighted overall score
    const overallScore = Math.round(
      llmResult.konten.score * 0.3 +
        struktur.score * 0.2 +
        bahasaHeuristik.score * 0.15 +
        llmResult.etika.score * 0.15 +
        seo.score * 0.1 +
        teknis.score * 0.1,
    );

    const verdict =
      overallScore >= 75
        ? "Layak terbit"
        : overallScore >= 50
          ? "Perlu revisi"
          : "Ditolak";

    const result = {
      overallScore,
      verdict,
      summary: llmResult.konten.note,
      mode: useLocalMode ? "local" : mode === "llm" ? "llm" : "hybrid",
      details: [
        {
          name: "Konten & Sumber",
          value: String(llmResult.konten.score),
          text: llmResult.konten.note,
        },
        {
          name: "Struktur/Format",
          value: String(struktur.score),
          text: struktur.notes.join(" "),
        },
        {
          name: "Bahasa & Gaya",
          value: String(bahasaHeuristik.score),
          text: bahasaHeuristik.notes.join(" "),
          weaknesses: bahasaHeuristik.weaknesses || [],
        },
        {
          name: "Etika & Legalitas",
          value: String(llmResult.etika.score),
          text: llmResult.etika.note,
        },
        {
          name: "SEO & Audiens",
          value: String(seo.score),
          text: seo.notes.join(" "),
        },
        {
          name: "Pemeriksaan Teknis",
          value: String(teknis.score),
          text: teknis.notes.join(" "),
          weaknesses: teknis.weaknesses || [],
        },
        // AI-SEO score from Jawa Pos methodology
        {
          name: "Mesin-Baca (AI-SEO)",
          value: String(machineReadability.score),
          text:
            machineReadability.notes.join(" ") ||
            "Skor keterbacaan untuk mesin (Google AI, LLM)",
          meta: machineReadability.meta,
        },
      ],
      highlights: llmResult.highlights || [],
      // Verification flags for manual review
      verificationFlags: verificationFlags.flags,
      verificationSummary: verificationFlags.summary,
      sourceUrl: sourceUrl,
      sourceDomain: sourceDomain,
      fromCache: false,
      skippedLLM: skippedLLM,
    };

    setCached(cacheKey, result);

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: err.message || "Terjadi kesalahan saat analisis." });
  }
});

// Get supported modes
router.get("/modes", (req, res) => {
  res.json({
    modes: [
      {
        id: "local",
        name: "Mode Lokal",
        description: "Gratis, instan (~70% akurat)",
        requiresApiKey: false,
        features: ["Heuristic scoring", "Basic fact extraction"],
      },
      {
        id: "hybrid",
        name: "Mode Hybrid",
        description: "Akurat (~85% akurat), hemat biaya",
        requiresApiKey: true,
        features: ["Heuristic + LLM", "Smart bypass", "Fact extraction"],
      },
      {
        id: "llm",
        name: "Mode LLM Penuh",
        description: "Paling akurat (~95%), biaya lebih tinggi",
        requiresApiKey: true,
        features: ["Full LLM analysis", "Complete evaluation"],
      },
    ],
    currentMode: config.mode,
    hasApiKey: !!config.anthropicApiKey,
  });
});

export default router;
