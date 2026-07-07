// Enhanced heuristics berdasarkan Standar Penulisan Jawa Pos
// Fokus: struktur mesin-readable + weakness detection + AI-SEO optimization

const clean = (text) => text.trim().replace(/\s+/g, " ");
const countWords = (text) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

// ============================================================================
// AI-SEO HEURISTICS (Based on Jawa Pos "Piramida Terbalik Berlapis")
// ============================================================================

// Check 5W1H in lead
const has5W1H = (text) => {
  const patterns = [
    /\b(apa|siapa|kapan|di mana|mengapa|bagaimana)\b/i,
    /\b(what|who|when|where|why|how)\b/i,
  ];
  return patterns.some((p) => p.test(text));
};

// Count facts (numbers, quotes, data)
const countFacts = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  let facts = 0;
  sentences.forEach((s) => {
    if (/\d+/.test(s)) facts++;
    if (/".*".*?\b(menurut|kata|ujar|sebut)\b/i.test(s)) facts++;
    if (/\b(persen|ratus|puluh|juta|ribu|kali|lebih|kurang)\b/i.test(s))
      facts++;
  });
  return facts;
};

// Count headings
const countHeadings = (text) => {
  let count = 0;
  const lines = text.split(/\n/);
  lines.forEach((line) => {
    if (
      /^#{2,3}\s+/.test(line) ||
      /<h[23][^>]*>/i.test(line) ||
      (/^[A-Z][A-Za-z\s]{8,50}$/.test(line.trim()) && line.trim().length > 10)
    ) {
      count++;
    }
  });
  return count;
};

// Count dead paragraphs (paragraphs without facts, >= 100 words)
const countDeadParagraphs = (text) => {
  const paragraphs = clean(text)
    .split(/\n{2,}|\n/)
    .filter((p) => p.trim().length > 50);
  let dead = 0;
  paragraphs.forEach((p) => {
    const facts = countFacts(p);
    const words = countWords(p);
    if (facts === 0 && words >= 100) dead++;
  });
  return dead;
};

// ============================================================================
// AI-SEO SCORING (Piramida Terbalik Berlapis)
// ============================================================================

/**
 * Lead Strength Score (0-100)
 * Based on Jawa Pos: Lead should be 40-60 words with main facts (5W1H)
 */
const calculateLeadScore = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const leadWords = countWords(firstParagraph);

  let score = 100;

  // Word count penalty
  if (leadWords < 20) {
    score -= 40; // Too short - AI can't extract
  } else if (leadWords < 40) {
    score -= 20; // Short
  } else if (leadWords > 60 && leadWords <= 80) {
    score -= 15; // Slightly long
  } else if (leadWords > 80) {
    score -= 30; // Too long - diluted content
  }

  // 5W1H check
  const hasQuestionWords =
    /\b(apa|siapa|kapan|di mana|mengapa|bagaimana|what|who|when|where|why|how)\b/i.test(
      firstParagraph,
    );
  const hasNumbers = /\d+/.test(firstParagraph);
  const hasAction =
    /\b(meresmikan|mengatakan|menyatakan|meresmikan|meluncurkan)\b/i.test(
      firstParagraph,
    );

  if (!hasNumbers && !hasQuestionWords) score -= 20; // No concrete data
  if (!hasAction) score -= 10; // No action/quote in lead

  return Math.max(0, score);
};

/**
 * Heading Structure Score (0-100)
 * Based on Jawa Pos: H3 required based on article length
 */
const calculateHeadingScore = (text) => {
  const wordCount = countWords(text);
  const headingCount = countHeadings(text);

  let score = 100;

  // Required headings based on word count (Jawa Pos guidelines)
  let requiredHeadings = 0;
  if (wordCount >= 400 && wordCount < 800) requiredHeadings = 2;
  else if (wordCount >= 800) requiredHeadings = 3;

  // Penalty for missing headings
  if (requiredHeadings > 0 && headingCount === 0) {
    score -= 35; // Long article without structure
  } else if (headingCount < requiredHeadings) {
    score -= 20; // Missing some headings
  } else if (headingCount > requiredHeadings * 2) {
    score -= 10; // Too many headings
  }

  // Bonus for proper heading density
  if (headingCount > 0) {
    const headingDensity = headingCount / (wordCount / 200);
    if (headingDensity >= 0.8 && headingDensity <= 1.5) {
      score += 10; // Optimal density
    }
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Section Self-Containment Score (0-100)
 * Check if each section can stand alone for AI citation
 */
const calculateSectionScore = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const headingCount = countHeadings(text);

  if (headingCount === 0) {
    return 100; // No sections to check
  }

  let score = 100;
  let sectionCount = 0;
  let weakSections = 0;

  // Find sections and check first paragraph after each heading
  const lines = text.split(/\n/);
  let inSection = false;
  let sectionFirstParagraph = "";

  lines.forEach((line) => {
    if (/^#{2,3}\s+/.test(line) || /<h[23][^>]*>/i.test(line)) {
      // Check previous section
      if (inSection && sectionFirstParagraph.length > 0) {
        sectionCount++;
        const sectionWords = countWords(sectionFirstParagraph);
        // Section lead should be substantive (at least 30 words)
        if (sectionWords < 30) weakSections++;
        // Should have some facts or attribution
        const hasFacts = /\d+/.test(sectionFirstParagraph);
        const hasAttr = /\b(menurut|ujar|dikatakan)\b/i.test(
          sectionFirstParagraph,
        );
        if (!hasFacts && !hasAttr) weakSections++;
      }
      // Start new section
      inSection = true;
      sectionFirstParagraph = "";
    } else if (inSection && line.trim()) {
      sectionFirstParagraph += " " + line.trim();
    }
  });

  if (sectionCount > 0) {
    const weakRatio = weakSections / sectionCount;
    score -= weakRatio * 40;
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Fact Density Score (0-100)
 * Based on Jawa Pos: Facts every 150-200 words
 */
const calculateFactDensityScore = (text) => {
  const wordCount = countWords(text);
  const factCount = countFacts(text);
  const deadParagraphs = countDeadParagraphs(text);

  // Skip short articles
  if (wordCount < 200) return 100;

  let score = 100;

  // Ideal fact density: 1 fact per 175 words
  const idealFactCount = Math.floor(wordCount / 175);
  const factRatio =
    idealFactCount > 0 ? Math.min(1, factCount / idealFactCount) : 1;

  if (factRatio < 0.3) {
    score -= 40; // Very low fact density
  } else if (factRatio < 0.5) {
    score -= 20; // Low fact density
  } else if (factRatio < 0.8) {
    score -= 10; // Moderate fact density
  }

  // Penalty for dead paragraphs
  if (deadParagraphs > 0) {
    const deadRatio = deadParagraphs / (wordCount / 300);
    score -= Math.min(30, deadRatio * 40);
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Attribution Score (0-100)
 * Check for proper source attribution
 */
const calculateAttributionScore = (text) => {
  const sentences = text.split(/[.!?]+/);
  let score = 100;

  // Count sentences with attribution
  const attributedSentences = sentences.filter((s) =>
    /\b(menurut|ujar|kata|dikatakan|menyatakan|dikutip|sebagai|data dari)\b/i.test(
      s,
    ),
  );

  const attributionRatio =
    sentences.length > 0 ? attributedSentences.length / sentences.length : 0;

  // Need at least 10% attribution
  if (attributionRatio < 0.05) {
    score -= 40; // Very low attribution
  } else if (attributionRatio < 0.1) {
    score -= 20; // Low attribution
  } else if (attributionRatio < 0.2) {
    score -= 10; // Moderate attribution
  }

  // Check for official sources
  const hasOfficialSources =
    /\b(BNPB|BPS|Kemendagri|Kementerian|BMKG|BPK|PUPR|Pemerintah|DPRD)\b/i.test(
      text,
    );
  if (!hasOfficialSources && text.length > 1000) {
    score -= 10; // Long article without official sources
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Machine Readability Score (0-100)
 * Overall score based on Jawa Pos Piramida Terbalik Berlapis
 */
export const analyzeMachineReadability = (text) => {
  const wordCount = countWords(text);

  const leadScore = calculateLeadScore(text);
  const headingScore = calculateHeadingScore(text);
  const sectionScore = calculateSectionScore(text);
  const factDensityScore = calculateFactDensityScore(text);
  const attributionScore = calculateAttributionScore(text);

  // Weights based on Jawa Pos guidelines
  const weights = {
    lead: 0.25, // Lead is critical for AI extraction
    heading: 0.2, // Structure for citations
    section: 0.15, // Self-contained sections
    factDensity: 0.25, // Facts = citations
    attribution: 0.15, // Credibility
  };

  const overallScore = Math.round(
    leadScore * weights.lead +
      headingScore * weights.heading +
      sectionScore * weights.section +
      factDensityScore * weights.factDensity +
      attributionScore * weights.attribution,
  );

  const notes = [];
  if (leadScore < 70) notes.push("Lead perlu diperkuat dengan fakta utama");
  if (headingScore < 70)
    notes.push("Tambahkan subjudul sesuai panjang artikel");
  if (factDensityScore < 70) notes.push("Tambah fakta/data tiap 150-200 kata");
  if (attributionScore < 70) notes.push("Perbanyak atribusi narasumber resmi");

  return {
    score: Math.max(0, overallScore),
    notes,
    meta: {
      leadScore,
      headingScore,
      sectionScore,
      factDensityScore,
      attributionScore,
      wordCount,
      headingCount: countHeadings(text),
      factCount: countFacts(text),
    },
  };
};

// ============================================================================
// EXISTING HEURISTICS (Enhanced)
// ============================================================================

export const analyzeStruktur = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const leadWords = countWords(firstParagraph);
  const wordCount = countWords(text);
  const headingCount = countHeadings(text);

  const notes = [];
  let score = 100;

  if (leadWords < 40) {
    score -= 10;
    notes.push(`Lead terlalu pendek (${leadWords} kata, ideal 40-60).`);
  } else if (leadWords > 60) {
    score -= 15;
    notes.push(
      `Lead terlalu panjang (${leadWords} kata, ideal 40-60). AI sulit ekstrak.`,
    );
  }

  const requiredHeadings = wordCount < 400 ? 0 : wordCount < 800 ? 2 : 3;
  if (wordCount >= 400 && headingCount < requiredHeadings) {
    score -= 10;
    notes.push(
      `Butuh minimal ${requiredHeadings} subjudul untuk artikel ${wordCount} kata.`,
    );
  }

  if (paragraphs.length < 3) {
    score -= 10;
    notes.push("Minimal 3 paragraf untuk struktur piramida terbalik.");
  }

  const hasAttr = /\b(menurut|ujar|kata|jelas|tutur|sebut)\b/i.test(text);
  if (!hasAttr) {
    score -= 10;
    notes.push("Tidak ada atribusi narasumber.");
  }

  const hasFiveW = has5W1H(firstParagraph);

  return {
    score: Math.max(0, score),
    notes,
    meta: {
      leadWords,
      headingCount,
      requiredHeadings,
      paragraphCount: paragraphs.length,
      has5W1H: hasFiveW,
    },
  };
};

// --- BAHASA & GAYA ENHANCED ---
const detectPassiveSentences = (text) => {
  const weaknesses = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  sentences.forEach((sentence, idx) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;

    // Check for passive voice patterns
    const passiveMatch = trimmed.match(/\b(di[a-z]+|ter[a-z]+)\b/gi);
    if (passiveMatch && passiveMatch.length > 0) {
      // Show the passive word
      const passiveWord = passiveMatch[0];
      weaknesses.push({
        type: "passive",
        text: trimmed,
        passiveWord: passiveWord,
        index: idx,
        note: `Kalimat pasif: "${passiveWord}"`,
      });
    }

    const words = trimmed.split(/\s+/);
    if (words.length > 25) {
      weaknesses.push({
        type: "complex",
        text: trimmed,
        wordCount: words.length,
        index: idx,
        note: `Kalimat panjang (${words.length} kata, ideal ≤25)`,
      });
    }
  });

  return weaknesses;
};

const detectFormalOveruse = (text) => {
  const weaknesses = [];
  const formalWords =
    /\b(jika|karena|bahwa|sehingga|agar|bila|supaya|dengan demikian|di mana|hal ini|yaitu)\b/gi;
  const matches = text.match(formalWords) || [];

  // Flag if same formal word appears 5+ times
  const wordCounts = {};
  matches.forEach((m) => {
    const w = m.toLowerCase();
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  });

  Object.entries(wordCounts).forEach(([word, count]) => {
    if (count >= 5) {
      weaknesses.push({
        type: "formal",
        text: word,
        count: count,
        note: `"${word}" muncul ${count}x - pertimbangkan variasi`,
      });
    }
  });

  return weaknesses;
};

export const analyzeBahasaHeuristic = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = countWords(text);
  const syllables = words > 0 ? words * 1.5 : 0;
  const readability =
    sentences.length > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              206.835 -
                1.015 * (words / sentences.length) -
                84.6 * (syllables / words),
            ),
          ),
        )
      : 0;

  const passivePattern = /\b(di[a-z]+|ter[a-z]+)\b/gi;
  const passiveMatches = text.match(passivePattern) || [];
  const passiveRatio =
    sentences.length > 0 ? passiveMatches.length / sentences.length : 0;

  const notes = [];
  let score = 100;

  if (readability < 50) {
    score -= 15;
    notes.push(`Keterbacaan rendah (skor ≈${readability}).`);
  }
  if (passiveRatio > 0.4) {
    score -= 10;
    notes.push(
      `Rasio pasif ${Math.round(passiveRatio * 100)}% (${passiveMatches.length} kalimat).`,
    );
  }

  // Detect specific weaknesses
  const weaknesses = [
    ...detectPassiveSentences(text),
    ...detectFormalOveruse(text),
  ];

  return {
    score: Math.max(0, score),
    notes,
    meta: { readability, passiveRatio, passiveCount: passiveMatches.length },
    weaknesses: weaknesses.slice(0, 10), // Limit to 10 for display
  };
};

// --- TEKNIS ENHANCED ---
const detectTechnicalIssues = (text) => {
  const issues = [];

  // Double/multiple spaces - extract specific words
  const doubleSpaceRegex = /\s{2,}/g;
  let match;
  while ((match = doubleSpaceRegex.exec(text)) !== null) {
    const pos = match.index;
    const spaceCount = match[0].length;

    // Find the word before the spaces
    const beforeText = text.slice(0, pos);
    const beforeMatch = beforeText.match(/(\S+)(\s*)$/);
    const beforeWord = beforeMatch ? beforeMatch[1] : "";

    // Find the word after the spaces
    const afterText = text.slice(pos + match[0].length);
    const afterMatch = afterText.match(/^(\s*)(\S+)/);
    const afterWord = afterMatch ? afterMatch[2] : "";

    // Get context around the issue (50 chars before and after)
    const contextStart = Math.max(0, pos - 50);
    const contextEnd = Math.min(text.length, pos + match[0].length + 50);
    let context = text.slice(contextStart, contextEnd);

    // Clean up context for display
    if (contextStart > 0) context = "..." + context;
    if (contextEnd < text.length) context = context + "...";
    context = context.replace(/\n/g, " "); // Replace newlines for display

    issues.push({
      type: "spacing",
      spaceCount: spaceCount, // 2 = double, 3 = triple, etc.
      before: beforeWord,
      after: afterWord,
      exact: beforeWord + match[0] + afterWord,
      position: pos,
      context: context,
      note:
        spaceCount >= 3
          ? `Spasi tripel (${spaceCount}x spasi)`
          : `Spasi ganda (${spaceCount}x spasi)`,
      recommendation: `Hapus ${spaceCount - 1} spasi antara "${beforeWord}" dan "${afterWord}"`,
    });
  }

  // Trailing whitespace
  const trailingRegex = /[ \t]+$/gm;
  while ((match = trailingRegex.exec(text)) !== null) {
    const lineNum = text.slice(0, match.index).split("\n").length;
    issues.push({
      type: "trailing",
      position: match.index,
      line: lineNum,
      lineContent: text.split("\n")[lineNum - 1] || "",
      note: "Spasi di akhir baris",
      recommendation: "Hapus spasi di akhir baris ini",
    });
  }

  // Inconsistent line breaks
  const hasMixedBreaks =
    (text.includes("\r\n") && text.includes("\n\n")) ||
    (text.includes("\n\n") && text.includes("\n") && !text.includes("\r"));
  if (hasMixedBreaks) {
    issues.push({
      type: "linebreak",
      context: "Mixed line breaks",
      note: "Campuran \\n dan \\n\\n",
      recommendation: "Gunakan satu jenis line break yang konsisten",
    });
  }

  // Non-standard quotes
  const fancyQuotes = text.match(/[""]/g) || [];
  if (fancyQuotes.length > 3) {
    issues.push({
      type: "quotes",
      count: fancyQuotes.length,
      note: `${fancyQuotes.length} tanda kutip non-standar (")`,
      recommendation: 'Gunakan tanda kutip standar "..." bukan "..."',
    });
  }

  return issues;
};

export const analyzeTeknis = (text) => {
  const notes = [];
  let score = 100;

  const doubleSpaces = (text.match(/\s{2,}/g) || []).length;
  if (doubleSpaces > 3) {
    score -= 5;
    notes.push(`${doubleSpaces} spasi ganda ditemukan.`);
  }
  const trailingSpaces = (text.match(/[ \t]+$/gm) || []).length;
  if (trailingSpaces > 5) {
    score -= 5;
    notes.push(`${trailingSpaces} baris dengan spasi akhir.`);
  }

  const weaknesses = detectTechnicalIssues(text);

  return {
    score: Math.max(0, score),
    notes,
    weaknesses: weaknesses.slice(0, 10),
  };
};

export const analyzeSEO = (text, targetKeyword = "") => {
  const wordCount = countWords(text);
  const factCount = countFacts(text);
  const deadParagraphs = countDeadParagraphs(text);

  const idealFactCount = Math.floor(wordCount / 175);
  const factRatio =
    idealFactCount > 0 ? Math.min(1, factCount / idealFactCount) : 1;

  const notes = [];
  let score = 100;

  if (wordCount < 400) {
    score -= 15;
    notes.push(`Artikel pendek (${wordCount} kata). AI sulit dapat konteks.`);
  } else if (wordCount < 300) {
    score -= 10;
    notes.push(`Minimal 400 kata untuk mesin baca optimal.`);
  }
  if (factRatio < 0.5) {
    score -= 15;
    notes.push("Fact density rendah.");
  } else if (factRatio < 0.8) {
    score -= 5;
    notes.push("Tambah fakta/data untuk citations AI.");
  }
  if (deadParagraphs > 0) {
    score -= deadParagraphs * 5;
    notes.push(`${deadParagraphs} paragraf tanpa fakta.`);
  }

  if (targetKeyword) {
    const density =
      wordCount > 0
        ? (text.match(new RegExp(targetKeyword, "gi")) || []).length / wordCount
        : 0;
    if (density < 0.003) {
      score -= 10;
      notes.push(`Kata kunci "${targetKeyword}" kurang.`);
    }
  }

  return {
    score: Math.max(0, score),
    notes,
    meta: { wordCount, factCount, deadParagraphs, factRatio },
  };
};

export { countWords };
