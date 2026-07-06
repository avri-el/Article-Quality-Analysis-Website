# Article Quality Analysis Website

Indonesian news article analyzer using hybrid heuristics + Claude LLM via Olagon Gateway.

## Architecture

- **Frontend**: React 18 + Vite (port 5173) + Tailwind CSS
- **Backend**: Express.js (port 4000) + Anthropic Claude API (via Olagon Gateway)
- **Proxy**: Vite proxies `/api/*` → `http://localhost:4000`
- **Module system**: ES Modules (`"type": "module"` in package.json)

## Commands

```bash
npm run client    # Start Vite dev server (frontend only)
npm run server    # Start Express backend only
npm run dev      # Alias for npm run client
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

To run full stack: start backend first (`npm run server`), then frontend (`npm run client`).

## Analysis Modes

Three analysis modes available:

| Mode | Cost | Accuracy | Description |
|------|------|----------|-------------|
| `local` | Free | ~70% | Heuristic-only (no API call) |
| `hybrid` | Low | ~85% | Heuristics + LLM for borderline cases |
| `llm` | High | ~95% | Full LLM analysis |

Set via `MODE` env variable or UI selector.

## Analysis Flow

1. **Heuristic analysis** (free, instant): Struktur, Bahasa, SEO, Teknis, Mesin-Baca (AI-SEO)
2. **LLM analysis** (costs money via Olagon): Konten & Sumber, Etika & Legalitas

**Weights**: konten 30%, struktur 20%, bahasa 15%, etika 15%, seo 10%, teknis 10%

### LLM Cost Optimization

LLM is **skipped** when:
- Mode is `local`
- Heuristic-only score ≥85 (assumed good enough)
- Heuristic-only score <50 (assumed poor enough)

### AI-SEO Scoring (Jawa Pos Methodology)

New scoring based on "Piramida Terbalik Berlapis":
- Lead strength (40-60 kata dengan fakta utama)
- H3 density sesuai panjang artikel
- Section self-containment (tiap section bisa disitasi AI)
- Fact density (setiap 150-200 kata ada fakta)
- Attribution (sumber resmi teridentifikasi)

## API Endpoint

```
POST /api/analyze
Content-Type: application/json

// Body options
{ "text": "article content..." }
{ "url": "https://example.com/article" }
{ "text": "...", "mode": "local" }  // Optional: local|hybrid|llm

// Response
{
  "overallScore": 75,
  "verdict": "Layak terbit",
  "summary": "...",
  "mode": "hybrid",              // Analysis mode used
  "skippedLLM": false,           // True if LLM was bypassed
  "details": [
    { "name": "Konten & Sumber", "value": "70", "text": "..." },
    { "name": "Struktur/Format", "value": "85", "text": "..." },
    { "name": "Bahasa & Gaya", "value": "78", "text": "...", "weaknesses": [] },
    { "name": "Etika & Legalitas", "value": "80", "text": "..." },
    { "name": "SEO & Audiens", "value": "75", "text": "..." },
    { "name": "Pemeriksaan Teknis", "value": "90", "text": "...", "weaknesses": [] },
    { "name": "Mesin-Baca (AI-SEO)", "value": "82", "text": "..." }
  ],
  "highlights": [...],
  "verificationFlags": [          // Claims needing manual check
    { "type": "defamation", "priority": "high", "context": "...", "recommendation": "..." },
    { "type": "quote", "priority": "medium", "text": "...", "attributedTo": "..." }
  ],
  "verificationSummary": { "total": 3, "highPriority": 1, "mediumPriority": 2 },
  "sourceUrl": "https://...",
  "sourceDomain": "example.com",
  "fromCache": false
}
```

## Verification Flags

Items flagged for manual verification:
- **🔴 High Priority**: Defamation claims without "diduga", unverified accusations
- **🟡 Medium Priority**: Quotes without attribution, statistics without sources
- **🔵 Low Priority**: Specific terminology, historical claims

## Verdict Thresholds

| Score | Backend Verdict | Frontend Badge |
|-------|-----------------|----------------|
| ≥75 | Layak terbit | Good |
| ≥50 | Perlu revisi | Needs Verification |
| <50 | Ditolak | Low Quality |

**Note**: Frontend thresholds (85/70) differ from backend (75/50) - intentional for UI display.

## URL Scraping

Uses AMP fallback for JavaScript-rendered sites (SPA/Inertia.js):
1. Try main URL → parse with cheerio
2. If content < 100 chars, try AMP version (`/amp/path`)
3. If still no content, fallback to Open Graph description

**Supported AMP sites**: jawapos.com, detik.com, kompas.com, tribunnews.com, sindonews.com, republika.co.id, merdeka.com, cnnindonesia.com, jpnn.com

## Caching

- Results cached in `server/.cache/` using SHA256 hash of article text + mode
- Same text + mode = instant result (bypasses LLM call)
- Cache location is gitignored (`server/.cache/`)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Backend server port |
| `ANTHROPIC_API_KEY` | - | Olagon Gateway API key |
| `MODE` | hybrid | Analysis mode (local/hybrid/llm) |

**Important**: `.env` is gitignored. Never commit real keys.

## Key Files

| File | Purpose |
|------|---------|
| `server/config.js` | Environment config (port, API key, mode) |
| `server/routes/analyze.js` | Main analysis endpoint + score calculation |
| `server/services/heuristics.js` | Heuristic analyzers + AI-SEO scoring |
| `server/services/llmEvaluator.js` | Claude LLM via Olagon Gateway |
| `server/services/factExtractor.js` | Quote/claim extraction for verification |
| `server/services/urlScraper.js` | URL → article text (with AMP fallback) |
| `server/services/cache.js` | File-based result cache |
| `src/App.jsx` | React frontend with mode selector + verification flags |

## Dependencies

- `cheerio` - HTML parsing for URL scraping
- `express` - Backend server
- `cors` - CORS middleware
- `dotenv` - Environment variables
