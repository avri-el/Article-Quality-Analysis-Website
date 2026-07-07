// Enhanced heuristics berdasarkan Standar Penulisan Jawa Pos
// Fokus: struktur mesin-readable + weakness detection + AI-SEO optimization

const clean = (text) => text.trim().replace(/\s+/g, " ");
const countWords = (text) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

// ============================================================================
// AI-SEO HEURISTICS (Based on Jawa Pos "Piramida Terbalik Berlapis")
// ============================================================================

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
  const hasQuestionWords = /\b(apa|siapa|kapan|di mana|mengapa|bagaimana|what|who|when|where|why|how)\b/i.test(firstParagraph);
  const hasNumbers = /\d+/.test(firstParagraph);
  const hasAction = /\b(meresmikan|mengatakan|menyatakan|meresmikan|meluncurkan)\b/i.test(firstParagraph);
  
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
  
  lines.forEach(line => {
    if (/^#{2,3}\s+/.test(line) || /<h[23][^>]*>/i.test(line)) {
      // Check previous section
      if (inSection && sectionFirstParagraph.length > 0) {
        sectionCount++;
        const sectionWords = countWords(sectionFirstParagraph);
        // Section lead should be substantive (at least 30 words)
        if (sectionWords < 30) weakSections++;
        // Should have some facts or attribution
        const hasFacts = /\d+/.test(sectionFirstParagraph);
        const hasAttr = /\b(menurut|ujar|dikatakan)\b/i.test(sectionFirstParagraph);
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
  const factRatio = idealFactCount > 0 ? Math.min(1, factCount / idealFactCount) : 1;
  
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
  const attributedSentences = sentences.filter(s => 
    /\b(menurut|ujar|kata|dikatakan|menyatakan|dikutip|sebagai|data dari)\b/i.test(s)
  );
  
  const attributionRatio = sentences.length > 0 ? attributedSentences.length / sentences.length : 0;
  
  // Need at least 10% attribution
  if (attributionRatio < 0.05) {
    score -= 40; // Very low attribution
  } else if (attributionRatio < 0.1) {
    score -= 20; // Low attribution
  } else if (attributionRatio < 0.2) {
    score -= 10; // Moderate attribution
  }
  
  // Check for official sources
  const hasOfficialSources = /\b(BNPB|BPS|Kemendagri|Kementerian|BMKG|BPK|PUPR|Pemerintah|DPRD)\b/i.test(text);
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
    lead: 0.25,        // Lead is critical for AI extraction
    heading: 0.20,     // Structure for citations
    section: 0.15,    // Self-contained sections
    factDensity: 0.25, // Facts = citations
    attribution: 0.15, // Credibility
  };
  
  const overallScore = Math.round(
    leadScore * weights.lead +
    headingScore * weights.heading +
    sectionScore * weights.section +
    factDensityScore * weights.factDensity +
    attributionScore * weights.attribution
  );
  
  const notes = [];
  if (leadScore < 70) notes.push("Lead perlu diperkuat dengan fakta utama");
  if (headingScore < 70) notes.push("Tambahkan subjudul sesuai panjang artikel");
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

// ============================================================================
// STRUKTUR & FORMAT ANALYSIS (Based on Jawa Pos - Piramida Terbalik Berlapis)
// ============================================================================

/**
 * Extract headline from article text (first line or H1)
 */
const extractHeadline = (text) => {
  const lines = text.split(/\n/).filter(l => l.trim());
  if (!lines.length) return { headline: '', hasH1: false };
  
  const firstLine = lines[0].trim();
  // Check if it's an H1 heading
  const hasH1 = /^#\s+/.test(firstLine) || /^H1[:\s]/i.test(firstLine);
  const headline = firstLine.replace(/^#+\s*/, '').trim();
  
  return { headline, hasH1 };
};

/**
 * Check if headline uses active voice
 */
const checkHeadlineActive = (headline) => {
  // Active verbs in Indonesian news: meresmikan, mengumumkan, menangkap, etc.
  const activeVerbs = /\b(meluncurkan|mengumumkan|meresmikan|menandatangani|membuka|menggelar|menangkap|menetapkan|memulai|menunjukkan|menurunkan|menaikkan|mengungkan)\b/i;
  // Passive indicators: akan, sedang, telah (followed by passive construction)
  const passiveIndicators = /\b(akan| SEDANG| telah| sudah)\s+(di[a-z]+|di-[a-z]+)\b/i;
  
  const hasActive = activeVerbs.test(headline);
  const hasPassive = passiveIndicators.test(headline);
  
  return { hasActive, hasPassive, isActive: hasActive && !hasPassive };
};

/**
 * Check 5W1H elements in lead
 */
const check5W1H = (leadText) => {
  const elements = {
    siapa: /\b(menurut|kata|ujar|dikutip|oleh)\b/i,
    apa: /\b(melaporkan|menyatakan|mengumumkan|akan|harus)\b/i,
    kapan: /\b(selasa|rabu|kamis|jumat|sabtu|minggu|senin|kemarin|hari ini|bulan ini|tahun ini|\d+\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}|pukul\s+\d{1,2}|\d+\s+jam)/i,
    diMana: /\b(di|in|on)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|(\s+di\s+\w+)|(location|kota|kabupaten|provinsi)\b/i,
    mengapa: /\b(karena|sebab|akibat|dampak|alasan)\b/i,
    bagaimana: /\b(dengan|cara|menggunakan|melalui)\b/i,
  };
  
  // For Indonesian, we check if specific question elements are present
  const hasSiapa = elements.siapa.test(leadText);
  const hasApa = elements.apa.test(leadText);
  const hasKapan = elements.kapan.test(leadText) || /\d+/.test(leadText);
  const hasDiMana = elements.diMana.test(leadText);
  const hasMengapa = elements.mengapa.test(leadText);
  const hasBagaimana = elements.bagaimana.test(leadText);
  
  const presentCount = [hasSiapa, hasApa, hasKapan, hasDiMana, hasMengapa, hasBagaimana].filter(Boolean).length;
  
  return {
    hasSiapa, hasApa, hasKapan, hasDiMana, hasMengapa, hasBagaimana,
    count: presentCount,
    summary: presentCount >= 4 ? 'complete' : presentCount >= 2 ? 'partial' : 'incomplete'
  };
};

/**
 * Check pyramid structure - important info should come first
 */
const checkPyramidStructure = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  if (paragraphs.length < 3) {
    return { score: 50, note: 'Artikel terlalu pendek untuk dinilai struktur piramida' };
  }
  
  const firstParagraph = paragraphs[0];
  const secondParagraph = paragraphs[1];
  const lastParagraph = paragraphs[paragraphs.length - 1];
  
  // Check if lead has numbers (concrete data)
  const leadHasNumbers = /\d+/.test(firstParagraph);
  
  // Check if important elements are in lead (who, what, when)
  const leadHasWho = /\b(menurut|kata|ujar|menteri|gubernur|bupati|walikota|dirjen|dirut)\b/i.test(firstParagraph);
  const leadHasAction = /\b(mengatakan|menyatakan|mengumumkan|meresmikan|menandatangani)\b/i.test(firstParagraph);
  
  // Check last paragraph - should not have new critical facts
  const lastHasNewFacts = /\d{5,}/.test(lastParagraph); // Large numbers appearing late
  
  // Score based on structure
  let score = 100;
  
  if (!leadHasNumbers && !leadHasWho) score -= 20; // Lead too generic
  if (!leadHasAction) score -= 10;
  if (lastHasNewFacts) score -= 15; // New critical info at end
  
  // Check if body paragraphs maintain importance
  const bodyStart = secondParagraph || '';
  const bodyStartHasNumbers = /\d+/.test(bodyStart);
  const bodyStartHasQuote = /\b(menurut|ujar)\b/i.test(bodyStart);
  
  if (!bodyStartHasNumbers && !bodyStartHasQuote) score -= 10;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    hasLeadData: leadHasNumbers,
    hasLeadQuote: leadHasWho,
    hasClosingNewFact: lastHasNewFacts,
    note: score >= 80 ? 'Struktur piramida terbalik baik' :
          score >= 60 ? 'Struktur perlu perbaikan' : 'Struktur piramida terbalik lemah'
  };
};

/**
 * Check closing paragraph
 */
const checkClosing = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  if (paragraphs.length < 2) {
    return { score: 50, note: 'Tidak ada paragraf penutup', issues: [] };
  }
  
  const lastParagraph = paragraphs[paragraphs.length - 1];
  const issues = [];
  let score = 100;
  
  // Check for closing phrases
  const closingPhrases = /\b(demikian|demikianlah|dengan demikian|seperti yang telah|disebutkan|sebagaimana|，最后|juga|masih)\b/i;
  const hasClosingPhrase = closingPhrases.test(lastParagraph);
  
  // Check for new critical info in closing (shouldn't be there)
  const newFactsPattern = /\b(menewaskan|mengungsi|kerusakan)\s+\d+(?:\.\d+)?\s+(?:orang|jiwa|rumah)/i;
  const hasNewCriticalFact = newFactsPattern.test(lastParagraph);
  
  // Check length - closing should be short
  const closingWords = countWords(lastParagraph);
  if (closingWords > 50) {
    issues.push(`Paragraf penutup terlalu panjang (${closingWords} kata)`);
    score -= 10;
  }
  
  if (hasNewCriticalFact) {
    issues.push('Fakta kritis baru di paragraf penutup');
    score -= 20;
  }
  
  if (!hasClosingPhrase) {
    issues.push('Paragraf penutup tanpa frasa penutup');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount: closingWords,
    issues,
    note: issues.length === 0 ? 'Penutup baik' : issues.join('; ')
  };
};

/**
 * Check for nut graf (nut graf for articles >600 words)
 */
const checkNutGraf = (text) => {
  const wordCount = countWords(text);
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  
  // Nut graf is only relevant for longer articles
  if (wordCount < 600 || paragraphs.length < 3) {
    return { hasNutGraf: null, note: 'Tidak wajib (artikel pendek)' };
  }
  
  // Nut graf is typically the 2nd paragraph
  const secondParagraph = paragraphs[1] || '';
  const secondWords = countWords(secondParagraph);
  
  // Nut graf should summarize why the story matters
  const hasWhyContext = /\b(karena|sebab|alasan|dampak|akibat| penting |perlu|harus)\b/i.test(secondParagraph);
  const hasSummary = secondWords >= 20 && secondWords <= 60;
  
  if (hasWhyContext && hasSummary) {
    return { hasNutGraf: true, note: 'Nut graf terdeteksi', paragraphWordCount: secondWords };
  }
  
  return { 
    hasNutGraf: false, 
    note: 'Nut graf tidak terdeteksi - tambahkan paragraf yang menjelaskan konteks أهمية berita',
    paragraphWordCount: secondWords 
  };
};

export const analyzeStruktur = (text) => {
  const paragraphs = clean(text).split(/\n+/).filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const leadWords = countWords(firstParagraph);
  const wordCount = countWords(text);
  const headingCount = countHeadings(text);

  const notes = [];
  const strengths = [];
  const weaknesses = [];
  let score = 100;
  
  // === 1. JUDUL ANALYSIS (from Jawa Pos) ===
  const { headline, hasH1 } = extractHeadline(text);
  const headlineWords = headline ? headline.split(/\s+/).length : 0;
  const { isActive: headlineIsActive } = checkHeadlineActive(headline);
  
  if (headlineWords > 9) {
    score -= 10;
    notes.push(`Judul terlalu panjang (${headlineWords} kata, ideal ≤9).`);
    weaknesses.push(`Judul ${headlineWords} kata`);
  } else if (headlineWords >= 5 && headlineWords <= 9 && headlineIsActive) {
    strengths.push('Judul baik (5-9 kata, verba aktif)');
  }
  
  if (!headlineIsActive && headlineWords > 0) {
    score -= 5;
    notes.push('Judul kurang menggunakan verba aktif.');
  }
  
  // === 2. LEAD ANALYSIS (40-60 kata + 5W1H) ===
  if (leadWords < 40) {
    score -= 15;
    notes.push(`Lead terlalu pendek (${leadWords} kata, ideal 40-60).`);
    weaknesses.push('Lead pendek');
  } else if (leadWords > 60) {
    score -= 15;
    notes.push(`Lead terlalu panjang (${leadWords} kata, ideal 40-60). AI sulit ekstrak.`);
    weaknesses.push('Lead panjang');
  } else {
    strengths.push(`Lead ideal (${leadWords} kata)`);
  }
  
  // 5W1H check
  const w1h = check5W1H(firstParagraph);
  if (w1h.count >= 4) {
    strengths.push('Lead memuat 5W1H lengkap');
  } else if (w1h.count >= 2) {
    notes.push(`Lead memuat ${w1h.count}/6 elemen 5W1H.`);
  } else {
    score -= 10;
    notes.push('Lead kurang memuat elemen 5W1H.');
    weaknesses.push('5W1H tidak lengkap');
  }
  
  // === 3. H3 STRUCTURE (from Jawa Pos) ===
  const requiredHeadings = wordCount < 400 ? 0 : wordCount < 800 ? 2 : 3;
  if (wordCount >= 400 && headingCount < requiredHeadings) {
    score -= 10;
    notes.push(`Butuh minimal ${requiredHeadings} H3 untuk artikel ${wordCount} kata.`);
    weaknesses.push(`Kurang subjudul H3`);
  } else if (headingCount >= requiredHeadings) {
    strengths.push(`Struktur H3 baik (${headingCount} subjudul)`);
  }
  
  // === 4. NUT GRAF CHECK ===
  const nutGraf = checkNutGraf(text);
  if (nutGraf.hasNutGraf === false) {
    score -= 5;
    notes.push(nutGraf.note);
  } else if (nutGraf.hasNutGraf === true) {
    strengths.push('Nut graf terdeteksi');
  }
  
  // === 5. PYRAMID STRUCTURE CHECK ===
  const pyramid = checkPyramidStructure(text);
  if (pyramid.score < 70) {
    score -= 15;
    notes.push('Struktur piramida terbalik perlu perbaikan.');
    weaknesses.push('Piramida terbalik lemah');
  } else {
    strengths.push('Struktur piramida terbalik baik');
  }
  
  // === 6. MINIMUM PARAGRAPHS ===
  if (paragraphs.length < 3) {
    score -= 10;
    notes.push('Minimal 3 paragraf untuk struktur piramida terbalik.');
    weaknesses.push('Paragraf kurang');
  }
  
  // === 7. ATTRIBUTION CHECK ===
  const hasAttr = /\b(menurut|ujar|kata|jelas|tutur|sebut)\b/i.test(text);
  if (!hasAttr) {
    score -= 10;
    notes.push('Tidak ada atribusi narasumber.');
    weaknesses.push('Tidak ada atribusi');
  } else {
    strengths.push('Ada atribusi narasumber');
  }
  
  // === 8. CLOSING CHECK ===
  const closing = checkClosing(text);
  if (closing.score < 70) {
    score -= 5;
    notes.push(`Penutup: ${closing.note}`);
  }
  
  // Final score bounds
  score = Math.max(0, Math.min(100, score));
  
  // Build summary
  if (strengths.length > weaknesses.length) {
    notes.unshift('Struktur artikel baik');
  } else if (weaknesses.length > 2) {
    notes.unshift('Struktur perlu perbaikan signifikan');
  }
  
  return { 
    score, 
    notes, 
    strengths,
    weaknesses,
    meta: { 
      leadWords, 
      headingCount, 
      requiredHeadings, 
      paragraphCount: paragraphs.length, 
      wordCount,
      headlineWords,
      headlineIsActive,
      has5W1H: w1h.count >= 4,
      w1hElements: w1h,
      pyramidScore: pyramid.score,
      closingScore: closing.score,
      nutGraf: nutGraf.hasNutGraf
    }
  };
};

// ============================================================================
// BAHASA & GAYA ANALYSIS (Enhanced with PUEBI, Localization, Tone)
// ============================================================================

/**
 * PUEBI (Pedoman Umum Ejaan Bahasa Indonesia) Check
 */
const checkPUEBI = (text) => {
  const issues = [];
  let score = 100;
  
  // Common PUEBI violations:
  
  // 1. Capitalization after period (should be capital)
  const lowercaseAfterPeriod = /[.!?]\s+[a-z][a-z]+/.test(text);
  if (lowercaseAfterPeriod) {
    const matches = text.match(/[.!?]\s+[a-z][a-z]+/g) || [];
    if (matches.length > 2) {
      issues.push(`${matches.length} huruf kecil setelah tanda baca`);
      score -= 10;
    }
  }
  
  // 2. Unnecessary capital letters (except proper nouns)
  const improperCaps = /\b(kami|kita|yang|dan|di|ke|dari|untuk|dengan|pada|ini|itu)\b/g;
  const capsMatches = text.match(improperCaps) || [];
  const allCaps = (text.match(/\b[A-Z]{5,}\b/g) || []).filter(w => 
    !['BNPB','BPS','BMKG','BPK','PUPR','PEMILU'].includes(w)
  );
  
  if (allCaps.length > 3) {
    issues.push(`${allCaps.length} kata kapital berlebihan`);
    score -= 5;
  }
  
  // 3. Number formatting (use angka for numbers >9)
  const wordNumbers = /\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+(?:belas|ribu|juta|ratus)/gi;
  const wordNumMatches = text.match(wordNumbers) || [];
  if (wordNumMatches.length > 2) {
    issues.push('Gunakan angka untuk bilangan >9');
    score -= 5;
  }
  
  // 4. Affixation issues
  // "di"+verb should be lowercase
  const passiveAffix = /\b(Di\S+|Ter\S+)/g;
  const passiveMatches = text.match(passiveAffix) || [];
  // This is actually OK for passive voice, not a violation
  
  // 5. Conjunction spacing
  const badConjSpacing = /\b(dan|atau|tapi|namun)\b/gi;
  const conjMatches = text.match(badConjSpacing) || [];
  
  return {
    score: Math.max(0, score),
    issues,
    note: issues.length === 0 ? 'Ejaan sesuai PUEBI' : issues.join('; ')
  };
};

/**
 * Tone/Neutrality Analysis
 */
const analyzeTone = (text) => {
  const textLower = text.toLowerCase();
  const words = text.split(/\s+/);
  
  // Emotional/biased words
  const emotionalWords = [
    'mengerikan', 'horor', 'menakutkan', 'luar biasa', 'fantastis',
    'memilukan', 'tragis', 'sadis', 'brutal', 'kejam', 'bencana besar',
    'luar biasa', 'super', 'paren', 'gila', 'konyol', 'bodoh', 'goblok',
  ];
  
  // Evaluative adjectives without data
  const evaluativeWords = [
    'buruk', 'hebat', 'bagus', 'jelek', 'baik', 'kurang baik', 'tidak bagus',
    'bermasalah', 'kontroversial', 'polemik', 'persoalan',
  ];
  
  // Positive/negative sentiment indicators
  const positiveWords = ['sukses', 'berhasil', 'meningkat', 'positif', 'stabil'];
  const negativeWords = ['gagal', 'turun', 'negatif', 'krisis', 'problem'];
  
  let emotionalCount = 0;
  let evaluativeCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  
  emotionalWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'gi');
    emotionalCount += (textLower.match(regex) || []).length;
  });
  
  evaluativeWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'gi');
    evaluativeCount += (textLower.match(regex) || []).length;
  });
  
  positiveWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'gi');
    positiveCount += (textLower.match(regex) || []).length;
  });
  
  negativeWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'gi');
    negativeCount += (textLower.match(regex) || []).length;
  });
  
  // Balance check
  const sentimentRatio = positiveCount + negativeCount > 0 
    ? Math.abs(positiveCount - negativeCount) / (positiveCount + negativeCount)
    : 1;
  
  let toneScore = 100;
  const issues = [];
  
  if (emotionalCount >= 3) {
    toneScore -= 20;
    issues.push(`${emotionalCount} kata emosional`);
  } else if (emotionalCount >= 1) {
    toneScore -= 5;
  }
  
  if (evaluativeCount >= 3 && !/\d+/.test(text.slice(text.indexOf(evaluativeWords[0]) - 20, text.indexOf(evaluativeWords[0]) + 20))) {
    // Evaluative word without supporting data
    toneScore -= 10;
    issues.push('Kata evaluatif tanpa data pendukung');
  }
  
  if (sentimentRatio > 0.7 && (positiveCount + negativeCount) >= 3) {
    toneScore -= 10;
    issues.push('Teks cenderung tidak netral');
  }
  
  return {
    score: Math.max(0, toneScore),
    emotionalCount,
    evaluativeCount,
    positiveCount,
    negativeCount,
    issues,
    note: toneScore >= 90 ? 'Bahasa netral dan objektif' :
          toneScore >= 70 ? 'Bahasa cukup netral' : 'Bahasa kurang netral'
  };
};

/**
 * Localization Check (Foreign Words)
 */
const checkLocalization = (text) => {
  const foreignWords = [
    // Common English words that should be translated
    { word: 'deadline',替代: 'batas akhir' },
    { word: 'update',替代: 'pembaruan' },
    { word: 'meeting',替代: 'rapat' },
    { word: 'offline',替代: 'luring' },
    { word: 'online',替代: 'daring' },
    { word: 'software',替代: 'perangkat lunak' },
    { word: 'hardware',替代: 'perangkat keras' },
    { word: 'platform',替代: 'platform' }, // accepted
    { word: 'backup',替代: 'cadangan' },
    { word: 'support',替代: 'dukungan' },
    { word: 'team',替代: 'tim' },
    { word: 'follow up',替代: 'tindak lanjut' },
    { word: 'issue',替代: 'masalah' },
    { word: 'progress',替代: 'kemajuan' },
    { word: 'breakdown',替代: 'kerusakan' },
    { word: 'deal',替代: 'kesepakatan' },
    { word: 'supporting',替代: 'mendukung' },
    { word: 'follow up',替代: 'tindak lanjut' },
  ];
  
  const issues = [];
  const foundForeign = [];
  
  foreignWords.forEach(({ word, alternative }) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      // Check if it's not in a quoted context or proper noun
      const context = text.toLowerCase();
      if (!context.includes(word + ',') || matches.length > 1) {
        foundForeign.push({ word, count: matches.length, alternative });
      }
    }
  });
  
  if (foundForeign.length > 0) {
    issues.push(`${foundForeign.length} kata asing yang bisa digantikan`);
  }
  
  // Check for units - prefer metric
  const nonMetricUnits = /\b(inci|feet|kaki|pound|ons|gallon)/gi;
  const nonMetricMatches = text.match(nonMetricUnits) || [];
  
  return {
    score: Math.max(0, 100 - (foundForeign.length * 5) - (nonMetricMatches.length * 5)),
    foreignCount: foundForeign.length,
    nonMetricCount: nonMetricMatches.length,
    foundForeign: foundForeign.slice(0, 5),
    issues,
    note: issues.length === 0 ? 'Bahasa sesuai lokal' : 'Ada kata asing yang perlu diterjemahkan'
  };
};

/**
 * Active Voice Ratio Check
 */
const checkActiveVoice = (text) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  let passiveCount = 0;
  const passivePatterns = [
    /\bdi[a-z]+(?:kan|kan)?\b/gi, // dilakukan, dilakukan
    /\bter[a-z]+(?:kan|kan)?\b/gi, // terjadi, terjebak
    /\bdi-\S+/g, // di-read
  ];
  
  sentences.forEach(sentence => {
    passivePatterns.forEach(pattern => {
      if (pattern.test(sentence)) {
        passiveCount++;
      }
    });
  });
  
  const passiveRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;
  
  return {
    passiveRatio: Math.round(passiveRatio * 100),
    passiveCount,
    totalSentences: sentences.length,
    note: passiveRatio < 0.1 ? 'Rasio kalimat pasif baik' :
          passiveRatio < 0.3 ? 'Rasio kalimat pasif cukup tinggi' : 'Rasio kalimat pasif tinggi'
  };
};

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
        type: 'passive',
        text: trimmed.slice(0, 150),
        passiveWord: passiveWord,
        index: idx,
        note: `Kalimat pasif: "${passiveWord}"`,
      });
    }

    const words = trimmed.split(/\s+/);
    if (words.length > 25) {
      weaknesses.push({
        type: 'complex',
        text: trimmed.slice(0, 150),
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
  
  // Count word occurrences
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
  const strengths = [];
  const weaknesses = [];
  let score = 100;
  
  // === 1. READABILITY SCORE ===
  if (readability < 50) {
    score -= 15;
    notes.push(`Keterbacaan rendah (skor ≈${readability}).`);
    weaknesses.push('Keterbacaan rendah');
  } else if (readability < 60) {
    score -= 5;
    notes.push(`Keterbacaan cukup (skor ≈${readability}).`);
  } else {
    strengths.push(`Keterbacaan baik (skor ${readability})`);
  }
  
  // === 2. PASSIVE VOICE CHECK ===
  if (passiveRatio > 0.4) {
    score -= 10;
    notes.push(`Rasio pasif ${Math.round(passiveRatio * 100)}% (${passiveMatches.length} kalimat).`);
    weaknesses.push('Terlalu banyak kalimat pasif');
  } else if (passiveRatio > 0.2) {
    notes.push(`Rasio pasif ${Math.round(passiveRatio * 100)}%.`);
  }
  
  // === 3. PUEBI CHECK ===
  const puebi = checkPUEBI(text);
  if (puebi.score < 90) {
    score -= 5;
    notes.push(`PUEBI: ${puebi.note}`);
    if (puebi.issues.length > 0) {
      weaknesses.push('Pelanggaran ejaan PUEBI');
    }
  } else {
    strengths.push('Ejaan sesuai PUEBI');
  }
  
  // === 4. TONE/NEUTRALITY CHECK ===
  const tone = analyzeTone(text);
  if (tone.score < 80) {
    score -= 10;
    notes.push(`Tone: ${tone.note}`);
    weaknesses.push('Bahasa kurang netral');
  } else {
    strengths.push('Bahasa netral dan objektif');
  }
  
  // === 5. LOCALIZATION CHECK ===
  const localization = checkLocalization(text);
  if (localization.foreignCount > 3) {
    score -= 5;
    notes.push(`Localization: ${localization.note}`);
    weaknesses.push('Kata asing yang perlu diterjemahkan');
  }
  
  // === 6. ACTIVE VOICE RATIO ===
  const activeVoice = checkActiveVoice(text);
  if (activeVoice.passiveRatio > 30) {
    score -= 5;
    notes.push(`Rasio pasif ${activeVoice.passiveRatio}% (ideal <10%).`);
  }
  
  // Detect specific weaknesses
  const detectedWeaknesses = [
    ...detectPassiveSentences(text),
    ...detectFormalOveruse(text)
  ];

  // Sanitize weaknesses - ensure all fields are strings
  const sanitizedWeaknesses = detectedWeaknesses.slice(0, 10).map(w => ({
    type: String(w.type || ''),
    text: String(w.text || '').slice(0, 200),
    note: String(w.note || ''),
    // Include other fields if they exist and are primitives
    ...(w.passiveWord !== undefined && { passiveWord: String(w.passiveWord) }),
    ...(w.wordCount !== undefined && { wordCount: Number(w.wordCount) || 0 }),
    ...(w.count !== undefined && { count: Number(w.count) || 0 }),
    ...(w.index !== undefined && { index: Number(w.index) || 0 }),
  }));

  return { 
    score: Math.max(0, Math.min(100, score)), 
    notes, 
    strengths,
    weaknesses,
    meta: { 
      readability, 
      passiveRatio: Math.round(passiveRatio * 100),
      passiveCount: passiveMatches.length,
      puebiScore: puebi.score,
      toneScore: tone.score,
      activeVoiceRatio: activeVoice.passiveRatio,
      localizationScore: localization.score,
    },
    weaknesses: sanitizedWeaknesses
  };
};

// --- TEKNIS ENHANCED ---
// ============================================================================
// PEMERIKSAAN TEKNIS (Enhanced with Consistency & Plagiarism Stub)
// ============================================================================

/**
 * Check heading hierarchy consistency
 */
const checkHeadingHierarchy = (text) => {
  const lines = text.split(/\n/);
  const issues = [];
  
  let prevLevel = 0;
  let hasH1 = false;
  let h1Warning = false;
  
  lines.forEach((line, idx) => {
    // Markdown headings
    const mdMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (mdMatch) {
      const level = mdMatch[1].length;
      
      // First heading should be H1 (only warn once)
      if (!hasH1 && level > 1 && !h1Warning) {
        issues.push('H1 tidak ditemukan - mulailah dengan satu H1');
        h1Warning = true;
      }
      
      // Level should not increase by more than 1
      if (level > prevLevel + 1 && prevLevel > 0) {
        issues.push(`Lewati level heading di baris ${idx + 1}`);
      }
      
      prevLevel = level;
      if (level === 1) hasH1 = true;
    }
  });
  
  return {
    score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15),
    issues,
    hasH1,
    note: issues.length === 0 ? 'Hierarki heading baik' : issues.join('; ')
  };
};

/**
 * Plagiarism check stub (would need external API)
 */
const checkPlagiarism = (text) => {
  // This is a stub - real implementation would use Turnitin/Copyscape API
  // We check for common copy-paste indicators as proxy
  
  const indicators = [];
  
  // Check for "dikutip dari" without source
  if (/dikutip\s+dari\s+(?:sumber\s+)?(?:yang|tidak)/i.test(text)) {
    indicators.push('Kutipan tidak jelas sumbernya');
  }
  
  // Check for "beritakan sebelumnya"
  if (/beritakan\s+\S+\s+sebelumnya/i.test(text)) {
    indicators.push('Referensi ke berita sebelumnya');
  }
  
  // Check for very long quotes without attribution
  const longQuotes = text.match(/"[^"]{200,}"/g) || [];
  if (longQuotes.length > 0) {
    indicators.push(`${longQuotes.length} kutipan panjang tanpa pemisahan`);
  }
  
  // Simple text fingerprinting - check for repetition
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50);
  const unique = new Set(sentences.map(s => s.trim().toLowerCase().slice(0, 50)));
  const repetitionRatio = sentences.length > 0 ? 1 - (unique.size / sentences.length) : 0;
  
  if (repetitionRatio > 0.3) {
    indicators.push('Terdapat pengulangan kalimat signifikan');
  }
  
  return {
    score: Math.max(0, 100 - indicators.length * 20),
    indicators,
    note: indicators.length === 0 ? 'Tidak ada indikasi plagiarisme' : indicators.join('; '),
    // Note: For accurate plagiarism check, use external API
    warning: 'Deteksi ini hanya indikasi, bukan konfirmasi'
  };
};

/**
 * Check image caption presence (simulated - checks for markdown/image patterns)
 */
const checkImagePresence = (text) => {
  const imagePatterns = [
    /!\[.*?\]\(.*?\)/g,  // Markdown image
    /<img\s/g,            // HTML image
    /\.(jpg|jpeg|png|gif|webp)/gi, // Image file references
  ];
  
  let imageCount = 0;
  imagePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) imageCount += matches.length;
  });
  
  // Check if captions are present (text after image)
  const hasCaptionPattern = /!\[.*?\]\(.*?\)\s*\n\s*[A-Z].{10,}/g;
  const captions = text.match(hasCaptionPattern) || [];
  
  return {
    imageCount,
    captionCount: captions.length,
    note: imageCount === 0 ? 'Tidak ada gambar' :
          captions.length < imageCount ? 'Sebagian gambar tanpa keterangan' : 'Semua gambar memiliki keterangan'
  };
};

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
    const beforeWord = beforeMatch ? beforeMatch[1] : '';
    
    // Find the word after the spaces
    const afterText = text.slice(pos + match[0].length);
    const afterMatch = afterText.match(/^(\s*)(\S+)/);
    const afterWord = afterMatch ? afterMatch[2] : '';
    
    // Get context around the issue (50 chars before and after)
    const contextStart = Math.max(0, pos - 50);
    const contextEnd = Math.min(text.length, pos + match[0].length + 50);
    let context = text.slice(contextStart, contextEnd);
    
    // Clean up context for display
    if (contextStart > 0) context = '...' + context;
    if (contextEnd < text.length) context = context + '...';
    context = context.replace(/\n/g, ' '); // Replace newlines for display
    
    issues.push({
      type: 'spacing',
      spaceCount: spaceCount, // 2 = double, 3 = triple, etc.
      before: beforeWord,
      after: afterWord,
      exact: beforeWord + match[0] + afterWord,
      position: pos,
      context: context,
      note: spaceCount >= 3 ? `Spasi tripel (${spaceCount}x spasi)` : `Spasi ganda (${spaceCount}x spasi)`,
      recommendation: `Hapus ${spaceCount - 1} spasi antara "${beforeWord}" dan "${afterWord}"`,
    });
  }

  // Trailing whitespace
  const trailingRegex = /[ \t]+$/gm;
  while ((match = trailingRegex.exec(text)) !== null) {
    const lineNum = text.slice(0, match.index).split('\n').length;
    // Get the line content
    const lineMatch = text.slice(context.startOfLine || 0, text.length).split('\n')[lineNum - 1];
    issues.push({
      type: "trailing",
      position: match.index,
      line: lineNum,
      lineContent: text.split('\n')[lineNum - 1] || '',
      note: 'Spasi di akhir baris',
      recommendation: 'Hapus spasi di akhir baris ini',
    });
  }

  // Inconsistent line breaks
  const hasMixedBreaks =
    (text.includes("\r\n") && text.includes("\n\n")) ||
    (text.includes("\n\n") && text.includes("\n") && !text.includes("\r"));
  if (hasMixedBreaks) {
    issues.push({
      type: 'linebreak',
      context: 'Mixed line breaks',
      note: 'Campuran \\n dan \\n\\n',
      recommendation: 'Gunakan satu jenis line break yang konsisten',
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
  const strengths = [];
  const weaknesses = [];
  let score = 100;
  
  // === 1. SPACING ISSUES ===
  const doubleSpaces = (text.match(/\s{2,}/g) || []).length;
  if (doubleSpaces > 3) {
    score -= 5;
    notes.push(`${doubleSpaces} spasi ganda ditemukan.`);
    weaknesses.push('Spasi ganda berlebihan');
  } else if (doubleSpaces === 0) {
    strengths.push('Tidak ada spasi ganda');
  }
  const trailingSpaces = (text.match(/[ \t]+$/gm) || []).length;
  if (trailingSpaces > 5) {
    score -= 5;
    notes.push(`${trailingSpaces} baris dengan spasi akhir.`);
    weaknesses.push('Spasi akhir berlebihan');
  }
  
  // === 2. HEADING HIERARCHY ===
  const headingCheck = checkHeadingHierarchy(text);
  if (headingCheck.score < 100) {
    score -= 10;
    notes.push(`Heading: ${headingCheck.note}`);
    weaknesses.push('Hierarki heading tidak konsisten');
  } else {
    strengths.push('Hierarki heading baik');
  }
  
  // === 3. PLAGIARISM STUB ===
  const plagiarismCheck = checkPlagiarism(text);
  if (plagiarismCheck.score < 80) {
    score -= 15;
    notes.push(`Plagiarisme: ${plagiarismCheck.note}`);
    weaknesses.push('Indikasi plagiarisme');
  }
  
  // === 4. IMAGE PRESENCE ===
  const imageCheck = checkImagePresence(text);
  // Images are optional, but good to have
  if (imageCheck.imageCount > 0 && imageCheck.captionCount < imageCheck.imageCount) {
    score -= 5;
    notes.push('Beberapa gambar tanpa keterangan');
  }
  
  // === 5. LINE BREAK CONSISTENCY ===
  const hasMixedBreaks = (text.includes('\r\n') && text.includes('\n\n')) ||
                         (text.includes('\n\n') && text.includes('\n') && !text.includes('\r'));
  if (hasMixedBreaks) {
    score -= 5;
    notes.push('Campuran line break (\\n dan \\n\\n)');
    weaknesses.push('Inkonsistensi line break');
  }
  
  // === 6. QUOTE STYLE ===
  const fancyQuotes = text.match(/[""]/g) || [];
  if (fancyQuotes.length > 3) {
    score -= 3;
    notes.push(`${fancyQuotes.length} tanda kutip non-standar (")`);
  }
  
  // Detect technical issues for weak points
  const weaknessesList = detectTechnicalIssues(text);
  
  // Sanitize weaknesses - ensure all fields are strings
  const sanitizedWeaknesses = weaknessesList.slice(0, 10).map(w => ({
    type: String(w.type || ''),
    text: String(w.text || ''),
    note: String(w.note || ''),
    recommendation: String(w.recommendation || ''),
    // Include other fields if they exist and are primitives
    ...(w.spaceCount !== undefined && { spaceCount: Number(w.spaceCount) || 0 }),
    ...(w.before !== undefined && { before: String(w.before) }),
    ...(w.after !== undefined && { after: String(w.after) }),
    ...(w.exact !== undefined && { exact: String(w.exact) }),
    ...(w.context !== undefined && { context: String(w.context) }),
    ...(w.position !== undefined && { position: Number(w.position) || 0 }),
    ...(w.line !== undefined && { line: Number(w.line) || 0 }),
    ...(w.lineContent !== undefined && { lineContent: String(w.lineContent) }),
    ...(w.count !== undefined && { count: Number(w.count) || 0 }),
    ...(w.index !== undefined && { index: Number(w.index) || 0 }),
  }));
  
  // Final score bounds
  score = Math.max(0, Math.min(100, score));
  
  // Build summary
  if (strengths.length > weaknesses.length) {
    notes.unshift('Pemeriksaan teknis baik');
  }
  
  return { 
    score: Math.round(score), 
    notes, 
    strengths,
    weaknesses,
    meta: { 
      doubleSpaces,
      trailingSpaces,
      headingScore: headingCheck.score,
      plagiarismScore: plagiarismCheck.score,
      imageCount: imageCheck.imageCount,
      captionCount: imageCheck.captionCount,
    },
    weaknesses: sanitizedWeaknesses
  };
};

// ============================================================================
// SEO & AUDIENS ANALYSIS (Based on Jawa Pos + Ringkasan Eksekutif)
// ============================================================================

/**
 * Extract main keyword from article title/first paragraph
 */
const extractMainKeyword = (text) => {
  const lines = text.split(/\n/);
  const firstLine = lines[0] || '';
  
  // Remove markdown headings
  const title = firstLine.replace(/^#+\s*/, '').trim();
  
  // Extract first significant noun phrase (simple approach)
  // Common patterns: "X Melaporkan Y", "X Umumkan Z"
  const words = title.split(/\s+/);
  if (words.length >= 2) {
    // Return first 2-3 significant words as keyword
    const significant = words.slice(0, 3).filter(w => 
      w.length > 4 && 
      !['dan','atau','di','ke','dari','yang','ini','itu','akan','telah'].includes(w.toLowerCase())
    );
    if (significant.length > 0) {
      return significant.join(' ');
    }
  }
  return title.slice(0, 30);
};

/**
 * Check keyword density (target: 1-2%)
 */
const checkKeywordDensity = (text, keyword) => {
  if (!keyword || keyword.length < 3) return { density: 0, status: 'unknown' };
  
  const words = text.toLowerCase().split(/\s+/);
  const keywordParts = keyword.toLowerCase().split(/\s+/);
  
  let count = 0;
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (keywordParts.some(k => cleanWord.includes(k.replace(/[^a-z]/g, '')))) {
      count++;
    }
  }
  
  const density = words.length > 0 ? (count / words.length) * 100 : 0;
  
  let status = 'optimal';
  let note = '';
  
  if (density < 0.5) {
    status = 'too_low';
    note = `Keyword density terlalu rendah (${density.toFixed(1)}%)`;
  } else if (density < 1) {
    status = 'low';
    note = `Keyword density rendah (${density.toFixed(1)}%), target 1-2%`;
  } else if (density > 3) {
    status = 'too_high';
    note = `Keyword density terlalu tinggi (${density.toFixed(1)}%), risiko keyword stuffing`;
  } else if (density > 2) {
    status = 'high';
    note = `Keyword density tinggi (${density.toFixed(1)}%), ideal 1-2%`;
  } else {
    note = `Keyword density optimal (${density.toFixed(1)}%)`;
  }
  
  return { density: Math.round(density * 10) / 10, count, status, note };
};

/**
 * Check internal links
 */
const checkInternalLinks = (text) => {
  // Patterns for internal links
  const internalPatterns = [
    /\/(artikel|berita|liputan|read)\//gi,
    /https?:\/\/[^\/]*\.(?:jawapos|detik|kompas|tribunews|kompas|republika|sindonews|merdeka|cnn|jpnn)\.com/gi,
    /https?:\/\/(?:www\.)?([a-z0-9-]+)\.co\.id\/(?!https?)/gi,
  ];
  
  let totalLinks = 0;
  const foundUrls = new Set();
  
  internalPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => {
        if (!foundUrls.has(m.toLowerCase())) {
          foundUrls.add(m.toLowerCase());
          totalLinks++;
        }
      });
    }
  });
  
  return {
    count: totalLinks,
    note: totalLinks >= 2 ? `${totalLinks} tautan internal` :
          totalLinks === 1 ? '1 tautan internal' : 'Tidak ada tautan internal'
  };
};

/**
 * Check external links
 */
const checkExternalLinks = (text) => {
  const externalPattern = /https?:\/\/(?!.*\.(?:com|co\.id|net|org|id)\b)[^\s]+/gi;
  const matches = text.match(externalPattern) || [];
  
  // Filter out common false positives
  const filtered = matches.filter(url => 
    !url.includes('localhost') &&
    url.length > 10 &&
    !url.endsWith('.')
  );
  
  return {
    count: filtered.length,
    note: filtered.length > 0 ? `${filtered.length} tautan eksternal` : 'Tidak ada tautan eksternal'
  };
};

/**
 * Check click-worthy indicators in headline
 */
const checkClickWorthy = (text) => {
  const headline = text.split(/\n/)[0] || '';
  const indicators = [];
  let score = 0;
  
  // Number in headline (strong indicator)
  if (/\d+/.test(headline)) {
    indicators.push('Angka di judul');
    score += 30;
  }
  
  // Question in headline
  if (/^[A-Z].*\?|apa |siapa |kapan |mengapa |bagaimana /.test(headline)) {
    indicators.push('Pertanyaan di judul');
    score += 20;
  }
  
  // Action words
  const actionWords = ['eksklusif', ' BREAKING', 'TERBARU', 'PENTING', 'WAJIB'];
  const hasAction = actionWords.some(w => headline.toUpperCase().includes(w));
  if (hasAction) {
    indicators.push('Kata aksi/urgensi');
    score += 15;
  }
  
  // Specific details
  if (/\d{3,}/.test(headline)) {
    indicators.push('Angka spesifik (ratusan/ribuan)');
    score += 15;
  }
  
  // Location specificity
  if (/di [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,/.test(headline)) {
    indicators.push('Lokasi spesifik');
    score += 10;
  }
  
  return {
    score: Math.min(100, score),
    indicators,
    note: score >= 60 ? 'Judul menarik untuk diklik' :
          score >= 30 ? 'Judul cukup menarik' : 'Judul kurang menarik'
  };
};

/**
 * Check meta description quality (simulated - based on first paragraph analysis)
 */
const checkMetaQuality = (text) => {
  const firstPara = text.split(/\n+/)[0] || '';
  const words = firstPara.split(/\s+/);
  
  let score = 100;
  const issues = [];
  
  // Length check (meta should be 120-160 chars, ~20-30 words)
  if (words.length > 40) {
    score -= 15;
    issues.push('Lead terlalu panjang untuk meta description');
  }
  
  // Check if it starts with the main point
  const startsWithNumber = /^\d+/.test(firstPara);
  const startsWithAttribution = /^(?:menurut|berdasarkan|data)/i.test(firstPara);
  
  if (startsWithAttribution) {
    score -= 20;
    issues.push('Lead dimulai dengan atribusi');
  }
  
  // Check for key information at start
  const hasKeyInfo = /\d{3,}/.test(firstPara.slice(0, 100));
  if (hasKeyInfo) {
    score += 10;
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    note: issues.length === 0 ? 'Lead sesuai standar meta description' : issues.join('; ')
  };
};

export const analyzeSEO = (text, targetKeyword = "") => {
  const wordCount = countWords(text);
  const factCount = countFacts(text);
  const deadParagraphs = countDeadParagraphs(text);
  
  // Calculate ideal fact count based on word count (per Jawa Pos: 1 fact per 150-200 words)
  const idealFactCount = Math.floor(wordCount / 175);
  // For short articles, treat as inadequate regardless of actual fact count
  const isShortArticle = wordCount < 400;
  const factRatio = idealFactCount > 0 ? Math.min(1, factCount / idealFactCount) : 0;
  
  const notes = [];
  const strengths = [];
  const weaknesses = [];
  let score = 100;
  
  // Extract main keyword if not provided
  const keyword = targetKeyword || extractMainKeyword(text);
  
  // === 1. WORD COUNT (≥500 kata per Jawa Pos + Ringkasan Eksekutif) ===
  // Severity multiplier for very short articles
  const wordCountSeverity = wordCount < 200 ? 2.0 : wordCount < 300 ? 1.5 : wordCount < 500 ? 1.0 : 0.8;
  
  if (wordCount < 200) {
    score -= Math.round(25 * wordCountSeverity);
    notes.push(`Artikel sangat pendek (${wordCount} kata, ideal ≥500).`);
    weaknesses.push('Artikel sangat pendek');
  } else if (wordCount < 300) {
    score -= Math.round(20 * wordCountSeverity);
    notes.push(`Artikel pendek (${wordCount} kata, ideal ≥500). AI sulit dapat konteks.`);
    weaknesses.push('Kurang dari 300 kata');
  } else if (wordCount < 500) {
    score -= Math.round(15 * wordCountSeverity);
    notes.push(`Artikel pendek (${wordCount} kata, ideal ≥500).`);
    weaknesses.push('Kurang dari 500 kata');
  } else if (wordCount >= 500 && wordCount < 800) {
    notes.push(`Panjang artikel cukup (${wordCount} kata).`);
  } else if (wordCount >= 800) {
    strengths.push(`Panjang artikel optimal (${wordCount} kata)`);
  }
  
  // === 2. FACT DENSITY (every 150-200 words per Jawa Pos) ===
  // Short articles can't score high on fact density regardless
  if (isShortArticle) {
    // For short articles, fact ratio is inherently limited
    if (factCount < 2) {
      score -= 20;
      notes.push("Fact density sangat rendah untuk artikel pendek.");
      weaknesses.push('Fact density rendah');
    } else if (factCount < 4) {
      score -= 10;
      notes.push("Fact density cukup untuk panjang artikel ini.");
    } else {
      // Good but still penalize for short article
      strengths.push(`${factCount} fakta dalam artikel pendek`);
    }
  } else {
    // Normal articles
    if (factRatio < 0.3) {
      score -= 25;
      notes.push("Fact density sangat rendah - tambahkan fakta tiap 150-200 kata.");
      weaknesses.push('Fact density rendah');
    } else if (factRatio < 0.5) {
      score -= 15;
      notes.push("Fact density rendah.");
      weaknesses.push('Fact density kurang');
    } else if (factRatio < 0.8) {
      score -= 5;
      notes.push("Fact density cukup.");
    } else {
      strengths.push(`Fact density baik (${factCount} fakta)`);
    }
  }
  
  // Dead paragraphs penalty (applies to all lengths)
  if (deadParagraphs > 0) {
    const penalty = isShortArticle ? deadParagraphs * 8 : deadParagraphs * 5;
    score -= penalty;
    notes.push(`${deadParagraphs} paragraf tanpa fakta.`);
    weaknesses.push(`${deadParagraphs} paragraf mati`);
  }
  
  // === 3. KEYWORD DENSITY (1-2% per Ringkasan Eksekutif) ===
  const keywordCheck = checkKeywordDensity(text, keyword);
  if (keywordCheck.status === 'too_low' || keywordCheck.status === 'low') {
    score -= 10;
    notes.push(`"${keyword}": ${keywordCheck.note}`);
    weaknesses.push('Keyword density rendah');
  } else if (keywordCheck.status === 'too_high') {
    score -= 15;
    notes.push(`"${keyword}": ${keywordCheck.note}`);
    weaknesses.push('Keyword stuffing');
  } else if (keywordCheck.status === 'high') {
    score -= 5;
    notes.push(`"${keyword}": ${keywordCheck.note}`);
  } else if (keywordCheck.status === 'optimal') {
    strengths.push(`Keyword density optimal: "${keyword}" (${keywordCheck.density}%)`);
  }
  
  // === 4. INTERNAL LINKS (min 2 per Jawa Pos) ===
  const internalLinks = checkInternalLinks(text);
  const linkPenalty = isShortArticle ? 3 : 5; // Less penalty for short articles
  if (internalLinks.count === 0) {
    score -= linkPenalty;
    notes.push('Tambahkan minimal 2 tautan internal ke artikel terkait.');
    weaknesses.push('Tidak ada tautan internal');
  } else if (internalLinks.count < 2) {
    score -= 3;
    notes.push(`Kurang tautan internal (ada ${internalLinks.count}, ideal ≥2).`);
  } else {
    strengths.push(internalLinks.note);
  }
  
  // === 5. EXTERNAL LINKS (for credibility) ===
  const externalLinks = checkExternalLinks(text);
  // External links are optional but good for credibility
  if (externalLinks.count > 0) {
    strengths.push(`${externalLinks.count} tautan ke sumber eksternal`);
  }
  
  // === 6. CLICK-WORTHY HEADLINE ===
  const clickWorthy = checkClickWorthy(text);
  if (clickWorthy.score >= 60) {
    strengths.push('Judul menarik untuk diklik');
  } else if (clickWorthy.score < 30) {
    score -= 5;
    notes.push('Judul kurang menarik untuk diklik.');
  }
  
  // === 7. META DESCRIPTION QUALITY ===
  const metaQuality = checkMetaQuality(text);
  if (metaQuality.score < 70) {
    score -= 5;
    notes.push('Lead kurang optimal untuk meta description.');
  }
  
  // Final score bounds
  score = Math.max(0, Math.min(100, score));
  
  // Build summary - adjust based on article length
  if (isShortArticle && weaknesses.length > 0) {
    notes.unshift('Artikel pendek - pertimbangkan untuk dikembangkan');
  } else if (strengths.length > weaknesses.length) {
    notes.unshift('SEO artikel baik');
  } else if (weaknesses.length > 2) {
    notes.unshift('SEO perlu perbaikan');
  }
  
  return { 
    score: Math.round(score), 
    notes, 
    strengths,
    weaknesses,
    meta: { 
      wordCount, 
      factCount, 
      deadParagraphs, 
      factRatio: Math.round(factRatio * 100),
      keyword: keyword,
      keywordDensity: keywordCheck.density,
      internalLinkCount: internalLinks.count,
      externalLinkCount: externalLinks.count,
      clickWorthyScore: clickWorthy.score,
      metaQualityScore: metaQuality.score,
      isShortArticle
    }
  };
};

// ============================================================================
// KONTEN & SUMBER ANALYSIS (News Value, Originalitas, Sumber Kredibilitas)
// ============================================================================

/**
 * Analyze Konten & Sumber using heuristics
 * Based on news value, source credibility, and originality
 */
export const analyzeKonten = (text) => {
  const notes = [];
  const strengths = [];
  const weaknesses = [];
  let score = 100;
  
  const wordCount = countWords(text);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  // === 1. NEWS VALUE ANALYSIS ===
  
  // Keywords indicating high news value
  const highNewsValueKeywords = [
    'bencana', 'gempa', 'banjir', 'tsunami', 'kebakaran', 'erupsi',
    'kebijakan', 'peraturan', 'uu', 'undang-undang', 'aturan baru',
    'skandal', 'korupsi', 'OTT', 'penangkapan', 'penyelewengan',
    'kemenangan', 'perdana', 'resmi', 'launching', 'peresmian',
    'tragedi', 'kecelakaan', 'kematian', 'meninggal', 'tewas',
    'ekonomi', 'resesi', 'inflasi', 'krisis', 'pengangguran',
    'pemilu', 'pilpres', 'pilkada', 'pilleg',
  ];
  
  // Keywords indicating low news value
  const lowNewsValueKeywords = [
    'rapat', 'agenda', 'kunjungan', 'silaturahmi', ' Halal bihalal',
    'olahraga', 'hiburan', 'artis', 'selebriti', 'gosip',
  ];
  
  const textLower = text.toLowerCase();
  let newsValueScore = 50; // Neutral start
  
  const highMatches = highNewsValueKeywords.filter(k => textLower.includes(k)).length;
  const lowMatches = lowNewsValueKeywords.filter(k => textLower.includes(k)).length;
  
  if (highMatches >= 3) {
    newsValueScore = 85;
    notes.push("Berita dengan topik penting dan dampak tinggi");
    strengths.push("Topik berita bernilai tinggi");
  } else if (highMatches >= 1) {
    newsValueScore = 70;
    notes.push("Topik berita cukup menarik");
  } else if (lowMatches >= 2) {
    newsValueScore = 45;
    notes.push("Topik kurang berdampak");
    weaknesses.push("Topik berita kurang signifikan");
  }
  
  // === 2. ORIGINALITAS ANALYSIS ===
  
  // Check for quote diversity
  const quotePattern = /"([^"]{10,})"\s*[-–]\s*([^,]+)/g;
  const quotes = [...text.matchAll(quotePattern)];
  const quoteCount = quotes.length;
  
  // Check for internal link patterns
  const internalLinkPattern = /\/(artikel|berita|liputan)\//gi;
  const internalLinks = text.match(internalLinkPattern) || [];
  
  // Check for typical copy-paste indicators
  const copyPasteIndicators = [
    { pattern: /beritakan\s+([a-z]+)\s+sebelumnya/gi, desc: "Referensi ke berita sebelumnya" },
    { pattern: /seperti\s+dikutip\s+dari/gi, desc: "Kutipan tidak jelas sumbernya" },
  ];
  let originalityFlags = 0;
  copyPasteIndicators.forEach(({ pattern, desc }) => {
    if (pattern.test(text)) originalityFlags++;
  });
  
  let originalityScore = 60;
  if (quoteCount >= 3) {
    originalityScore += 20;
    strengths.push(`${quoteCount} kutipan narasumber`);
  } else if (quoteCount >= 1) {
    originalityScore += 10;
  } else {
    weaknesses.push("Tidak ada kutipan langsung");
  }
  
  if (originalityFlags >= 1) {
    originalityScore -= 15;
    weaknesses.push("Terdapat indikasi copy-paste");
  }
  
  // === 3. SUMBER KREDIBILITAS ANALYSIS ===
  
  // Official/government sources
  const officialSources = [
    'bnpb', 'bps', 'kemendagri', 'kementerian', 'bmkg', 'bpk',
    'pupr', 'pemerintah', 'dprd', 'kejaksaan', 'polri', 'mabes',
    'menteri', 'gubernur', 'bupati', 'walikota', 'dirjen', 'dirut',
    'kepala daerah', 'juru bicara', 'jubir',
  ];
  
  // Named sources (with specific names)
  const namedPersonPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*(?:gubernur|menteri|direktur|pengamat|ahli|warga))/g;
  const namedSources = text.match(namedPersonPattern) || [];
  
  // Anonymous/unnamed sources
  const anonymousPatterns = [
    /sumber\s+(?:yang|tidak|instalasi)\s+\S+\s+(?:mengatakan|menyatakan|berkata)/gi,
    /sumber\s+(?:di|di人士)/gi,
    /匿名/gi, // anonymous in Chinese
  ];
  let anonymousCount = 0;
  anonymousPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) anonymousCount += matches.length;
  });
  
  let sumberScore = 60;
  
  // Official sources bonus
  const officialMatches = officialSources.filter(s => textLower.includes(s)).length;
  if (officialMatches >= 2) {
    sumberScore += 25;
    notes.push(`Menggunakan ${officialMatches} sumber resmi`);
    strengths.push("Banyak sumber resmi/institusi");
  } else if (officialMatches >= 1) {
    sumberScore += 15;
    strengths.push("Ada sumber resmi/institusi");
  }
  
  // Named sources bonus
  if (namedSources.length >= 2) {
    sumberScore += 15;
    strengths.push(`${namedSources.length} narasumber bernama jelas`);
  } else if (namedSources.length >= 1) {
    sumberScore += 8;
  } else if (anonymousCount === 0 && quoteCount > 0) {
    // No anonymous and has quotes = good
    sumberScore += 10;
  }
  
  // Anonymous sources penalty
  if (anonymousCount >= 2) {
    sumberScore -= 20;
    weaknesses.push(`${anonymousCount} sumber tanpa identitas`);
  } else if (anonymousCount >= 1) {
    sumberScore -= 10;
    weaknesses.push("1 sumber tanpa identitas");
  }
  
  // === 4. GEOGRAPHIC SCOPE ===
  
  const nationalKeywords = ['nasional', 'pemerintah pusat', 'ri ', 'indonesia', 'republik'];
  const localKeywords = ['kota', 'kabupaten', 'kecamatan', 'kelurahan', 'desa'];
  
  const hasNational = nationalKeywords.some(k => textLower.includes(k));
  const hasLocal = localKeywords.some(k => textLower.includes(k));
  
  if (hasNational) {
    notes.push("Cakupan berita bersifat nasional");
  } else if (hasLocal && !hasNational) {
    notes.push("Cakupan berita bersifat lokal");
  }
  
  // === FINAL SCORE ===
  // Weighted average: NewsValue(35%), Originalitas(25%), Sumber(40%)
  score = Math.round(
    newsValueScore * 0.35 +
    originalityScore * 0.25 +
    sumberScore * 0.40
  );
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    notes,
    strengths,
    weaknesses,
    meta: {
      newsValueScore,
      originalityScore,
      sumberScore,
      quoteCount,
      namedSourcesCount: namedSources.length,
      officialSourcesCount: officialMatches,
      anonymousCount,
    }
  };
};

// ============================================================================
// ETIKA & LEGALITAS ANALYSIS (Based on Ringkasan Eksekutif)
// ============================================================================

/**
 * Analyze Etika & Legalitas using heuristics
 * Based on: Bias/Fairness, Libel/Fitnah, Privasi, Consent
 */
export const analyzeEtika = (text) => {
  const notes = [];
  const strengths = [];
  const weaknesses = [];
  const risks = [];
  let score = 100;
  
  const textLower = text.toLowerCase();
  
  // === 1. LIBEL & FITNAH CHECK ===
  
  // Defamation keywords (need "diduga" or equivalent)
  const defamationKeywords = [
    'koruptor', 'pelaku', 'tersangka', 'terdakwa', 'residivis',
    'pencuri', 'penipu', 'korupsi', 'pengedar', 'narkoba',
    'pelaku kekerasan', 'pembunuh', 'teroris',
  ];
  
  // Qualifier words that soften accusations
  const qualifierWords = [
    'diduga', 'konon', 'dikatakannya', 'katanya', 'tersangka', 
    'dalam proses', 'sedang diselidiki', 'belum terbukti',
  ];
  
  let defamationRisk = 0;
  defamationKeywords.forEach(keyword => {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(pattern);
    if (matches) {
      // Check if preceded by qualifier
      const hasQualifier = qualifierWords.some(q => textLower.includes(q));
      if (!hasQualifier) {
        defamationRisk++;
        risks.push({
          type: 'defamation',
          keyword: keyword,
          context: `Penggunaan "${keyword}" tanpa qualifier`,
          priority: 'high',
          recommendation: `Tambahkan "diduga" sebelum "${keyword}"`
        });
      }
    }
  });
  
  if (defamationRisk >= 2) {
    score -= 30;
    weaknesses.push("Terdapat tuduhan tanpa dasar yang jelas");
  } else if (defamationRisk === 1) {
    score -= 15;
    weaknesses.push("1 tuduhan tanpa qualifier");
  } else {
    strengths.push("Tidak ada tuduhan tanpa bukti");
  }
  
  // === 2. BIAS & FAIRNESS CHECK ===
  
  // Check for multiple perspectives
  const proKeywords = ['setuju', 'mendukung', 'positif', 'berhasil', 'sukses'];
  const contraKeywords = ['tolak', 'protes', 'menolak', 'negatif', 'gagal', ' kritik'];
  
  const proCount = proKeywords.filter(k => textLower.includes(k)).length;
  const contraCount = contraKeywords.filter(k => textLower.includes(k)).length;
  
  // Quote attribution balance
  const quotePattern = /"([^"]{10,})"\s*[-–]\s*([^,]+)/g;
  const quotes = [...text.matchAll(quotePattern)];
  const quoteAttributions = quotes.map(q => q[2]?.toLowerCase() || '');
  
  // Check if quotes are from same side
  const uniqueAttributions = [...new Set(quoteAttributions)];
  let perspectiveBalance = 50;
  
  if (quotes.length >= 3 && uniqueAttributions.length >= 2) {
    perspectiveBalance = 90;
    strengths.push("Perspektif seimbang dari berbagai pihak");
  } else if (quotes.length >= 2 && uniqueAttributions.length >= 2) {
    perspectiveBalance = 75;
    strengths.push("Ada perspektif dari lebih dari satu pihak");
  } else if (quotes.length === 1) {
    perspectiveBalance = 60;
    weaknesses.push("Hanya satu perspektif");
  } else if (quotes.length === 0) {
    perspectiveBalance = 40;
    weaknesses.push("Tidak ada kutipan narasumber");
  }
  
  // Emotional language detection
  const emotionalKeywords = [
    'mengerikan', 'horor', 'menakutkan', 'luar biasa', 'fantastis',
    'memilukan', 'tragis', 'sadis', 'brutal', 'kejam',
  ];
  const emotionalCount = emotionalKeywords.filter(k => textLower.includes(k)).length;
  
  if (emotionalCount >= 3) {
    perspectiveBalance -= 20;
    weaknesses.push("Penggunaan bahasa emosional berlebihan");
  } else if (emotionalCount >= 1) {
    perspectiveBalance -= 10;
  }
  
  score += (perspectiveBalance - 50) * 0.3; // Weighted bias impact
  
  // === 3. PRIVASI CHECK ===
  
  // Patterns that might reveal private information
  const privacyRiskyPatterns = [
    { 
      pattern: /\b(korban|terluka|meninggal)\s+(?:yang\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gi,
      desc: "Nama lengkap korban",
      check: (match) => !textLower.includes('tidak diperbolehkan')
    },
    { 
      pattern: /\b(anak)\s+(?:yang\s+)?(?:usia|berumur)\s+(\d+)\s+(?:tahun)?/gi,
      desc: "Identitas anak",
      check: () => true
    },
  ];
  
  let privacyRisks = 0;
  privacyRiskyPatterns.forEach(({ pattern, desc, check }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (check(match)) {
        privacyRisks++;
        risks.push({
          type: 'privacy',
          context: `Potensi pelanggaran privasi: ${desc}`,
          detail: match[0],
          priority: 'medium',
          recommendation: "Pertimbangkan untuk tidak menyebut identitas lengkap"
        });
      }
    }
  });
  
  if (privacyRisks >= 2) {
    score -= 15;
    weaknesses.push("Potensi pelanggaran privasi");
  } else if (privacyRisks === 1) {
    score -= 8;
  } else {
    strengths.push("Privasi narasumber terjaga");
  }
  
  // === 4. CONSENT CHECK ===
  
  // Patterns indicating potential consent issues
  const consentPatterns = [
    { pattern: /foto\s+(?:tersangka|korban|privat)/gi, desc: "Penggunaan foto tanpa konteks" },
    { pattern: /rekaman\s+(?:wawancara|percakapan)\s+(?:tanpa|belum)\s+izin/gi, desc: "Rekaman tanpa izin" },
  ];
  
  let consentIssues = 0;
  consentPatterns.forEach(({ pattern, desc }) => {
    if (pattern.test(text)) {
      consentIssues++;
      risks.push({
        type: 'consent',
        context: desc,
        priority: 'low',
        recommendation: "Pastikan ada izin narasumber"
      });
    }
  });
  
  // === FINAL SCORE ===
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Build summary notes
  if (strengths.length > weaknesses.length) {
    notes.push("Tidak ada isu etika signifikan");
  } else if (weaknesses.length > 0) {
    notes.push(`${weaknesses.length} masalah etika perlu perhatian`);
  }
  
  if (defamationRisk === 0) {
    notes.push("Penggunaan qualifier untuk tuduhan sudah tepat");
  }
  
  return {
    score,
    notes,
    strengths,
    weaknesses,
    risks,
    meta: {
      defamationRisk,
      perspectiveBalance,
      privacyRisks,
      consentIssues,
      quoteCount: quotes.length,
      uniqueAttributions: uniqueAttributions.length,
    }
  };
};

export { countWords };
