// Fact Extraction Service - Extract claims requiring manual verification
// Priority: Flag quotes, statistics, and claims for human review

// Pattern: "text" - Name, Title
const QUOTE_PATTERN =
  /"([^"]{10,200})"\s*[-–—]\s*([^,]+),?\s*([A-Z][a-zA-Z\s]+)?/g;

// Pattern: Number + unit (statistics, percentages, counts)
const STAT_PATTERN =
  /(?:sekitar|kurang|lebih|sekitar|sekitarnya)?\s*(\d+(?:[.,]\d+)?)\s*(%|persen|juta|ribu|ratus|miliar|kg|km|m|orang|korban|pengungsi|rumah|hektare|mm|mm\/jam)/gi;

// Pattern: Attribution without verification keywords
const UNVERIFIED_ATTRIBUTION = [
  /\bsumber\s+(?:menyatakan|mengatakan|berkata)\b/i,
  /\bkonon\b/i,
  /\bkatannya\b/i,
  /\bdiperkirakan\b/i,
  /\bkabar\b/i,
  /\brumor\b/i,
];

// Defamation keywords (need "diduga" or equivalent)
const DEFAMATION_KEYWORDS = [
  "koruptor",
  "pelaku",
  "tersangka",
  "terdakwa",
  "residivis",
  "pencuri",
  "penipu",
  "korupsi",
  "pengedar",
  "narkoba",
];

// Priority levels
export const PRIORITY = {
  HIGH: "high", // Red - defamation claims without "diduga"
  MEDIUM: "medium", // Yellow - quotes/statistics without source
  LOW: "low", // Blue - specific terminology
};

/**
 * Extract all quoted statements with attribution
 */
export const extractQuotes = (text) => {
  const quotes = [];
  let match;

  while ((match = QUOTE_PATTERN.exec(text)) !== null) {
    const [full, quoteText, name, title] = match;

    // Check if quote has proper attribution
    const hasAttribution = name && name.trim().length > 1;

    // Check if it's a verifiable quote (official title)
    const officialTitles = [
      "presiden",
      "menteri",
      "gubernur",
      "bupati",
      "walikota",
      "direktur",
      "kepala",
      "chairman",
      "CEO",
      "menteri",
      "jaksa",
      "hakim",
      "polisi",
      "panglima",
      "ketua",
    ];
    const isOfficialQuote =
      title && officialTitles.some((t) => title.toLowerCase().includes(t));

    quotes.push({
      text: quoteText,
      attributedTo: name ? name.trim() : null,
      title: title ? title.trim() : null,
      hasAttribution,
      isOfficialQuote,
      index: match.index,
      priority: !hasAttribution
        ? PRIORITY.MEDIUM
        : isOfficialQuote
          ? PRIORITY.LOW
          : PRIORITY.MEDIUM,
    });
  }

  return quotes;
};

/**
 * Extract statistical claims
 */
export const extractStatistics = (text) => {
  const stats = [];
  const sentences = text.split(/[.!?]+/);

  sentences.forEach((sentence, idx) => {
    // Extract numbers with context
    const statMatches = [...sentence.matchAll(STAT_PATTERN)];

    if (statMatches.length > 0) {
      // Check if sentence has source attribution
      const hasSource = /\b(menurut|data dari|berdasarkan|sources?|:)\b/i.test(
        sentence,
      );
      const hasInstitution =
        /\b(BNPB|BPS|Kemendagri|Kementerian|BMKG|BPK|PUPR)\b/i.test(sentence);

      // Check for specific claims without verification
      const claimStarters = [
        "mengatasi",
        "meningkat",
        "menurun",
        "menyebabkan",
        "disebabkan",
      ];
      const hasClaim = claimStarters.some((c) =>
        sentence.toLowerCase().includes(c),
      );

      statMatches.forEach((match) => {
        stats.push({
          number: match[1],
          unit: match[2],
          context: sentence.trim().slice(0, 100),
          hasSource: hasSource || hasInstitution,
          needsVerification: !hasSource && hasClaim,
          index: match.index,
          priority: !hasSource && hasClaim ? PRIORITY.MEDIUM : PRIORITY.LOW,
        });
      });
    }
  });

  return stats;
};

/**
 * Detect defamation claims (accusations without "diduga")
 */
export const detectDefamationRisks = (text) => {
  const risks = [];
  const sentences = text.split(/[.!?]+/);

  sentences.forEach((sentence, idx) => {
    const lowerSentence = sentence.toLowerCase();

    // Check for defamation keywords
    DEFAMATION_KEYWORDS.forEach((keyword) => {
      const pattern = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = sentence.match(pattern);

      if (matches) {
        // Check if preceded by "diduga" or similar
        const hasQualifier =
          /\b(diduga|konon|dikatakan|katanya|tersangka)\b/i.test(sentence);

        if (!hasQualifier) {
          risks.push({
            type: "defamation",
            keyword: keyword,
            context: sentence.trim().slice(0, 150),
            needsQualifier: true,
            index: match?.index || 0,
            priority: PRIORITY.HIGH,
            recommendation: `Tambahkan "diduga" atau "konon" sebelum "${keyword}"`,
          });
        }
      }
    });
  });

  return risks;
};

/**
 * Detect unverified attributions (sources without proper verification)
 */
export const detectUnverifiedAttributions = (text) => {
  const issues = [];
  const sentences = text.split(/[.!?]+/);

  sentences.forEach((sentence, idx) => {
    // Check for unverified attribution patterns
    UNVERIFIED_ATTRIBUTION.forEach((pattern) => {
      if (pattern.test(sentence)) {
        // Check if there's a name after the pattern
        const namePattern =
          /sumber\s+(?:menyatakan|mengatakan|berkata)\b,?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
        const nameMatch = sentence.match(namePattern);

        issues.push({
          type: "unverified",
          pattern: pattern.source,
          context: sentence.trim().slice(0, 150),
          namedSource: nameMatch ? nameMatch[1] : null,
          index: idx,
          priority: PRIORITY.MEDIUM,
          recommendation:
            "Verifikasi dengan sumber resmi atau tambahkan disclaimer",
        });
      }
    });
  });

  return issues;
};

/**
 * Extract claims that mention specific people/institutions without verification
 */
export const extractUnverifiedClaims = (text) => {
  const claims = [];

  // Pattern: Person name + controversial action without source
  // e.g., "Joko Widodo mengatakan Indonesia telah..."
  const claimPatterns = [
    {
      // Statements made by specific people
      pattern:
        /([A-Z][a-z]+(?:\s+(?:dan|&)\s+[A-Z][a-z]+)*)\s+(?:mengatakan|mengaku|meyakini|berpendapat)\s+([^.,]+)/g,
      priority: PRIORITY.MEDIUM,
    },
    {
      // Claims about victims without attribution
      pattern:
        /(?:korban|terluka|meninggal)\s+(?:diakatakan|dikatakan|konon)\s+([A-Z][^.,]+)/gi,
      priority: PRIORITY.HIGH,
    },
  ];

  claimPatterns.forEach(({ pattern, priority }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const [, subject, claim] = match;

      // Skip if already has official indicator
      const isOfficial = /\b(presiden|menteri|gubernur)\b/i.test(subject);

      if (!isOfficial) {
        claims.push({
          type: "unverified_claim",
          subject: subject.trim(),
          claim: claim.trim().slice(0, 100),
          context: match[0].slice(0, 150),
          priority,
        });
      }
    }
  });

  return claims;
};

/**
 * Main function - extract all verification flags
 */
export const extractVerificationFlags = (text) => {
  const quotes = extractQuotes(text);
  const statistics = extractStatistics(text);
  const defamationRisks = detectDefamationRisks(text);
  const unverifiedAttributions = detectUnverifiedAttributions(text);
  const unverifiedClaims = extractUnverifiedClaims(text);

  // Combine and deduplicate
  const allFlags = [
    ...defamationRisks,
    ...quotes.filter((q) => q.priority !== PRIORITY.LOW),
    ...statistics.filter((s) => s.needsVerification),
    ...unverifiedAttributions,
    ...unverifiedClaims,
  ];

  // Sort by priority (HIGH first)
  const priorityOrder = {
    [PRIORITY.HIGH]: 0,
    [PRIORITY.MEDIUM]: 1,
    [PRIORITY.LOW]: 2,
  };
  allFlags.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  // Limit to top 10 most important
  const topFlags = allFlags.slice(0, 10);

  return {
    flags: topFlags,
    summary: {
      total: allFlags.length,
      highPriority: defamationRisks.length,
      mediumPriority:
        quotes.filter((q) => q.priority === PRIORITY.MEDIUM).length +
        statistics.filter((s) => s.needsVerification).length,
      lowPriority: 0,
    },
    quotes: quotes.slice(0, 5),
    statistics: statistics.slice(0, 5),
  };
};

export default extractVerificationFlags;
