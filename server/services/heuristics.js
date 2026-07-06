// Enhanced heuristics berdasarkan Standar Penulisan Jawa Pos
// Fokus: struktur mesin-readable + weakness detection

const clean = (text) => text.trim().replace(/\s+/g, " ");
const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

// Check 5W1H in lead
const has5W1H = (text) => {
  const patterns = [
    /\b(apa|siapa|kapan|di mana|mengapa|bagaimana)\b/i,
    /\b(what|who|when|where|why|how)\b/i,
  ];
  return patterns.some(p => p.test(text));
};

// Count facts
const countFacts = (text) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  let facts = 0;
  sentences.forEach(s => {
    if (/\d+/.test(s)) facts++;
    if (/".*".*?\b(menurut|kata|ujar|sebut)\b/i.test(s)) facts++;
    if (/\b(persen|ratus|puluh|juta|ribu|kali|lebih|kurang)\b/i.test(s)) facts++;
  });
  return facts;
};

// Count headings
const countHeadings = (text) => {
  let count = 0;
  const lines = text.split(/\n/);
  lines.forEach(line => {
    if (/^#{2,3}\s+/.test(line) || /<h[23][^>]*>/i.test(line) || 
        (/^[A-Z][A-Za-z\s]{8,50}$/.test(line.trim()) && line.trim().length > 10)) {
      count++;
    }
  });
  return count;
};

// Count dead paragraphs
const countDeadParagraphs = (text) => {
  const paragraphs = clean(text).split(/\n{2,}|\n/).filter(p => p.trim().length > 50);
  let dead = 0;
  paragraphs.forEach(p => {
    const facts = countFacts(p);
    const words = countWords(p);
    if (facts === 0 && words >= 100) dead++;
  });
  return dead;
};

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
    notes.push(`Lead terlalu panjang (${leadWords} kata, ideal 40-60). AI sulit ekstrak.`);
  }
  
  const requiredHeadings = wordCount < 400 ? 0 : wordCount < 800 ? 2 : 3;
  if (wordCount >= 400 && headingCount < requiredHeadings) {
    score -= 10;
    notes.push(`Butuh minimal ${requiredHeadings} subjudul untuk artikel ${wordCount} kata.`);
  }
  
  if (paragraphs.length < 3) {
    score -= 10;
    notes.push("Minimal 3 paragraf untuk struktur piramida terbalik.");
  }
  
  const hasAttr = /\b(menurut|ujar|kata|jelas|tutur|sebut)\b/i.test(text);
  if (!hasAttr) {
    score -= 10;
    notes.push('Tidak ada atribusi narasumber.');
  }
  
  const hasFiveW = has5W1H(firstParagraph);
  
  return { 
    score: Math.max(0, score), 
    notes, 
    meta: { leadWords, headingCount, requiredHeadings, paragraphCount: paragraphs.length, has5W1H: hasFiveW }
  };
};

// --- BAHASA & GAYA ENHANCED ---
const detectPassiveSentences = (text) => {
  const weaknesses = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let charIndex = 0;
  
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
        text: trimmed,
        passiveWord: passiveWord,
        index: idx,
        note: `Kalimat pasif: "${passiveWord}"`
      });
    }
    
    // Check for complex sentences (>25 words)
    const words = trimmed.split(/\s+/);
    if (words.length > 25) {
      weaknesses.push({
        type: 'complex',
        text: trimmed,
        wordCount: words.length,
        index: idx,
        note: `Kalimat panjang (${words.length} kata, ideal ≤25)`
      });
    }
  });
  
  return weaknesses;
};

const detectFormalOveruse = (text) => {
  const weaknesses = [];
  const formalWords = /\b(jika|karena|bahwa|sehingga|agar|bila|supaya|dengan demikian|di mana|hal ini|yaitu)\b/gi;
  const matches = text.match(formalWords) || [];
  const unique = [...new Set(matches.map(m => m.toLowerCase()))];
  
  // Flag if same formal word appears 5+ times
  const wordCounts = {};
  matches.forEach(m => {
    const w = m.toLowerCase();
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  });
  
  Object.entries(wordCounts).forEach(([word, count]) => {
    if (count >= 5) {
      weaknesses.push({
        type: 'formal',
        text: word,
        count: count,
        note: `"${word}" muncul ${count}x - pertimbangkan variasi`
      });
    }
  });
  
  return weaknesses;
};

export const analyzeBahasaHeuristic = (text) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = countWords(text);
  const syllables = words > 0 ? words * 1.5 : 0;
  const readability = sentences.length > 0 
    ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words / sentences.length) - 84.6 * (syllables / words))))
    : 0;
  
  const passivePattern = /\b(di[a-z]+|ter[a-z]+)\b/gi;
  const passiveMatches = text.match(passivePattern) || [];
  const passiveRatio = sentences.length > 0 ? passiveMatches.length / sentences.length : 0;
  
  const notes = [];
  let score = 100;
  
  if (readability < 50) {
    score -= 15;
    notes.push(`Keterbacaan rendah (skor ≈${readability}).`);
  }
  if (passiveRatio > 0.4) {
    score -= 10;
    notes.push(`Rasio pasif ${Math.round(passiveRatio * 100)}% (${passiveMatches.length} kalimat).`);
  }
  
  // Detect specific weaknesses
  const weaknesses = [
    ...detectPassiveSentences(text),
    ...detectFormalOveruse(text)
  ];
  
  return { 
    score: Math.max(0, score), 
    notes, 
    meta: { readability, passiveRatio, passiveCount: passiveMatches.length },
    weaknesses: weaknesses.slice(0, 10) // Limit to 10 for display
  };
};

// --- TEKNIS ENHANCED ---
const detectTechnicalIssues = (text) => {
  const issues = [];
  
  // Double/multiple spaces
  let match;
  const doubleSpaceRegex = /\s{2,}/g;
  while ((match = doubleSpaceRegex.exec(text)) !== null) {
    const pos = match.index;
    // Get surrounding context
    const start = Math.max(0, pos - 15);
    const end = Math.min(text.length, pos + match[0].length + 15);
    const context = text.slice(start, end);
    
    issues.push({
      type: 'spacing',
      position: pos,
      context: context,
      note: 'Spasi ganda/tripel'
    });
  }
  
  // Trailing whitespace
  const trailingRegex = /[ \t]+$/gm;
  while ((match = trailingRegex.exec(text)) !== null) {
    issues.push({
      type: 'trailing',
      position: match.index,
      line: text.slice(0, match.index).split('\n').length,
      note: 'Spasi di akhir baris'
    });
  }
  
  // Inconsistent line breaks
  const hasMixedBreaks = (text.includes('\r\n') && text.includes('\n\n')) ||
                         (text.includes('\n\n') && text.includes('\n') && !text.includes('\r'));
  if (hasMixedBreaks) {
    issues.push({
      type: 'linebreak',
      context: 'Mixed line breaks',
      note: 'Campuran \n dan \n\n'
    });
  }
  
  // Non-standard quotes
  const fancyQuotes = text.match(/[""]/g) || [];
  if (fancyQuotes.length > 3) {
    issues.push({
      type: 'quotes',
      count: fancyQuotes.length,
      note: `${fancyQuotes.length} tanda kutip non-standar (")`
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
    weaknesses: weaknesses.slice(0, 10)
  };
};

export const analyzeSEO = (text, targetKeyword = "") => {
  const wordCount = countWords(text);
  const factCount = countFacts(text);
  const deadParagraphs = countDeadParagraphs(text);
  
  const idealFactCount = Math.floor(wordCount / 175);
  const factRatio = idealFactCount > 0 ? Math.min(1, factCount / idealFactCount) : 1;
  
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
    const density = wordCount > 0 ? (text.match(new RegExp(targetKeyword, "gi")) || []).length / wordCount : 0;
    if (density < 0.003) {
      score -= 10;
      notes.push(`Kata kunci "${targetKeyword}" kurang.`);
    }
  }
  
  return { score: Math.max(0, score), notes, meta: { wordCount, factCount, deadParagraphs, factRatio } };
};

export { countWords };
