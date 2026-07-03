# Article Quality Analysis Website

Indonesian news article analyzer using hybrid heuristics + Claude LLM via Olagon Gateway.

## Architecture

- **Frontend**: React 18 + Vite (port 5173) + Tailwind CSS
- **Backend**: Express.js (port 4000) + Anthropic Claude API (via Olagon Gateway)
- **Proxy**: Vite proxies `/api/*` → `http://localhost:4000`

## Commands

```bash
npm run client    # Start Vite dev server (frontend only)
npm run server    # Start Express backend only
npm run dev      # Alias for npm run client
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

To run full stack: start backend first (`npm run server`), then frontend (`npm run client`).

## Input Methods

1. **Paste Article**: Directly paste article text
2. **URL Analysis**: Fetch and analyze article from any URL

## Analysis Flow

1. **Heuristic analysis** (free, instant): Struktur, Bahasa, SEO, Teknis
2. **LLM analysis** (costs money via Olagon): Konten & Sumber, Etika & Legalitas

**Weights**: konten 30%, struktur 20%, bahasa 15%, etika 15%, seo 10%, teknis 10%

## URL Scraping

Uses AMP fallback for JavaScript-rendered sites (SPA/Inertia.js):
- Try main URL → parse with cheerio
- If content < 100 chars, try AMP version (`/amp/path`)
- If still no content, fallback to Open Graph description

### Supported News Sites (AMP)

jawapos.com, detik.com, kompas.com, tribunnews.com, sindonews.com, republika.co.id, merdeka.com, cnnindonesia.com, jpnn.com + generic fallback

## API Endpoint

```
POST /api/analyze
Content-Type: application/json

// Paste text
{ "text": "article content..." }

// URL (text extracted automatically)
{ "url": "https://example.com/article" }

// Response
{
  "overallScore": 75,
  "verdict": "Layak terbit",
  "summary": "...",
  "details": [...],
  "highlights": [...],
  "sourceUrl": "https://...",      // If from URL
  "sourceDomain": "example.com"    // If from URL
}
```

## Caching

- Results cached in `server/.cache/` using SHA256 hash of article text
- Same text = instant result (bypasses LLM call)
- Clear cache during testing to force fresh LLM calls

## Calibration

```bash
node data/calibrate.js data/raw/sample.csv
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Backend server port (default: 4000) |
| `ANTHROPIC_API_KEY` | Olagon Gateway API key |

**Important**: `.env` is gitignored. Never commit real keys.

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/analyze.js` | Main analysis endpoint |
| `server/services/heuristics.js` | Free heuristic analyzers (Indonesian) |
| `server/services/llmEvaluator.js` | Claude LLM via Olagon Gateway |
| `server/services/urlScraper.js` | URL → article text (with AMP fallback) |
| `server/services/cache.js` | File-based result cache |

## Dependencies

| Package | Purpose |
|---------|---------|
| `cheerio` | HTML parsing for URL scraping |
| `express` | Backend server |
| `cors` | CORS middleware |
| `dotenv` | Environment variables |

## Notes

- All UI text is in Bahasa Indonesia
- Heuristics tuned for Indonesian (syllable counting, attribution patterns)
- LLM uses `claude-sonnet-5` via Olagon Gateway
- Verdict thresholds: ≥75 "Layak terbit", ≥50 "Perlu revisi", <50 "Ditolak"
- LLM response parser handles markdown code fences (`\`\`\`json ... ```)
