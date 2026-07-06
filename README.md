# Article Quality Analyzer

Sistem analisis kualitas artikel berita Bahasa Indonesia dengan pendekatan hybrid yang menggabungkan heuristics (gratis, cepat) dan LLM (akurat, berbayar) untuk mencapai keseimbangan optimal antara biaya dan akurasi.

## Mengapa Pendekatan Hybrid?

### Tantangan

| Pendekatan | Kelebihan | Kekurangan |
|------------|-----------|------------|
| **LLM Only** | Akurat, nuanced | Mahal ($0.01-0.05/req), lambat (2-5s), overkill untuk artikel jelas |
| **Heuristic Only** | Gratis, cepat (<100ms) | Kurang akurat untuk konten kompleks, tidak bisa menilai "nuansa" |

### Solusi: Hybrid Architecture

Dengan menganalisis karakteristik artikel terlebih dahulu, sistem dapat menentukan:

```
┌─────────────────────────────────────────────────────────────┐
│                    ARTICLE QUALITY SPECTRUM                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CLEARLY GOOD          BORDERLINE              CLEARLY BAD  │
│      │                      │                       │        │
│      ▼                      ▼                       ▼        │
│  ┌──────────┐        ┌──────────┐         ┌──────────┐  │
│  │ HEURISTIC │        │  HYBRID  │         │ HEURISTIC │  │
│  │   ONLY    │        │          │         │   ONLY    │  │
│  │  (SKIP   │◄──────►│ (HEURISTIC│◄──────►│  (SKIP    │  │
│  │   LLM)   │  50-85 │   + LLM) │  ≥85    │   LLM)    │  │
│  └──────────┘        └──────────┘         └──────────┘  │
│      │                      │                       │        │
│      ▼                      ▼                       ▼        │
│    Gratis               $0.001-0.01              Gratis     │
│    <100ms                 ~1-2s                  <100ms     │
│    ~70% akurat         ~85% akurat             ~70%       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Hasil

| Metric | Before (LLM Only) | After (Hybrid) |
|--------|-------------------|----------------|
| Biaya per request | $0.01-0.05 | ~$0.001-0.005 |
| LLM calls | 100% | ~30-40% |
| Response time | 2-5s | <200ms (cache hit: instant) |
| Akurasi | 95% | 85% |

---

## Arsitektur Sistem

```mermaid
flowchart TB
    subgraph INPUT["📥 INPUT"]
        A["Paste Text"] 
        B["URL Article"]
    end

    subgraph FRONTEND["🖥️ Frontend (React)"]
        C["Mode Selector"]
        C1["Lokal<br/>Gratis"]
        C2["Hybrid<br/>Hemat"]
        C3["LLM Penuh<br/>Akurat"]
        C --> C1
        C --> C2
        C --> C3
    end

    subgraph BACKEND["⚙️ Backend (Express)"]
        subgraph PREPROCESS["1️⃣ PREPROCESSING"]
            D{"Input Type?"}
            D -->|Text| E["Validate Text"]
            D -->|URL| F["Fetch Article"]
            F --> F1["Try Main URL"]
            F1 -->|OK| E
            F1 -->|Fail| F2["Try AMP"]
            F2 -->|OK| E
            F2 -->|Fail| F3["OG Fallback"]
            F3 --> E
        end

        subgraph HEURISTICS["2️⃣ HEURISTICS ANALYSIS (GRATIS)"]
            E --> G["analyzeStruktur"]
            E --> H["analyzeBahasa"]
            E --> I["analyzeSEO"]
            E --> J["analyzeTeknis"]
            E --> K["analyzeMachineReadability"]
            E --> L["extractVerificationFlags"]
        end

        subgraph DECISION["3️⃣ DECISION GATE"]
            G --> M{"LLM Needed?"}
            H --> M
            I --> M
            J --> M
            K --> M
            
            M -->|Mode: Lokal| N["Skip LLM"]
            M -->|Estimated ≥85| N
            M -->|Estimated <50| N
            M -->|Borderline| O["Call Claude LLM"]
        end

        subgraph CACHE["4️⃣ CACHE LAYER"]
            N --> P["Check Cache"]
            O --> P
            P -->|Hit| Q["Return Cached"]
            P -->|Miss| O
        end

        subgraph OUTPUT["5️⃣ OUTPUT"]
            N --> R["Combine Scores"]
            O --> R
            R --> S["Build Response"]
        end
    end

    subgraph RESPONSE["📤 RESPONSE"]
        T["Overall Score"]
        U["Verdict Badge"]
        V["Score Breakdown"]
        W["Verification Flags"]
        X["Highlights"]
    end

    S --> T
    S --> U
    S --> V
    S --> W
    S --> X

    style INPUT fill:#e1f5fe
    style FRONTEND fill:#f3e5f5
    style BACKEND fill:#fff3e0
    style HEURISTICS fill:#e8f5e9
    style DECISION fill:#fce4ec
    style CACHE fill:#f1f8e9
    style OUTPUT fill:#e0f7fa
    style RESPONSE fill:#f9fbe7
```

---

## Alur Scoring

```mermaid
flowchart LR
    subgraph WEIGHTS["📊 WEIGHT DISTRIBUTION"]
        W1["Konten & Sumber<br/>30%"]
        W2["Struktur/Format<br/>20%"]
        W3["Bahasa & Gaya<br/>15%"]
        W4["Etika & Legalitas<br/>15%"]
        W5["SEO & Audiens<br/>10%"]
        W6["Teknis<br/>10%"]
    end

    subgraph METHODS["🔧 ANALYSIS METHODS"]
        W1 -.->|LLM| M1["Claude: newsworthiness<br/>originalitas<br/>relevansi"]
        W2 -.->|Heuristic| M2["Lead: 40-60 kata<br/>H3 density<br/>Paragraph count"]
        W3 -.->|Heuristic| M3["Readability score<br/>Passive ratio<br/>Complex sentences"]
        W4 -.->|LLM| M4["Claude: bias<br/>defamation<br/>privacy"]
        W5 -.->|Heuristic| M5["Word count<br/>Fact density<br/>Dead paragraphs"]
        W6 -.->|Heuristic| M6["Spacing issues<br/>Trailing spaces<br/>Line breaks"]
    end

    subgraph AI_SEO["🤖 AI-SEO SCORING (NEW)"]
        A1["Lead Strength<br/>(40-60 kata)"]
        A2["H3 Structure<br/>(sesuai panjang)"]
        A3["Section<br/>Self-Containment"]
        A4["Fact Density<br/>(150-200 kata)"]
        A5["Attribution<br/>Score"]
        
        A1 & A2 & A3 & A4 & A5 --> A6["Mesin-Baca<br/>Score"]
    end

    style WEIGHTS fill:#e3f2fd
    style METHODS fill:#f3e5f5
    style AI_SEO fill:#e8f5e9
```

---

## Verification Flags Flow

```mermaid
flowchart TB
    A["Article Text"] --> B["Extract All Claims"]
    
    B --> C{"Claim Type?"}
    C -->|Quote| D["Quote Pattern"]
    C -->|Statistic| E["Number Pattern"]
    C -->|Accusation| F["Defamation Check"]
    
    D --> G{"Has Attribution?"}
    G -->|No| H["🟡 MEDIUM FLAG"]
    G -->|Yes, Unofficial| H
    G -->|Yes, Official| I["✅ Verified"]
    
    E --> J{"Has Source?"}
    J -->|No| K["🟡 MEDIUM FLAG"]
    J -->|Yes, Official| I
    J -->|Yes, Unofficial| K
    
    F --> L{"Has 'diduga'?"}
    L -->|No| M["🔴 HIGH FLAG<br/>Defamation Risk"]
    L -->|Yes| I
    
    H --> N["🟡 Prioritas Sedang"]
    K --> N
    M --> O["🔴 Prioritas Tinggi"]
    
    N & O --> P["Display in UI"]
    I --> Q["✅ No Flag"]
    P --> R["Manual Verification<br/>Required"]
    
    style H fill:#fff9c4
    style K fill:#fff9c4
    style M fill:#ffcdd2
    style P fill:#fff9c4
    style Q fill:#c8e6c9
    style R fill:#fff3e0
```

---

## Comparison: LLM Only vs Hybrid

```mermaid
flowchart LR
    subgraph LLM_ONLY["❌ LLM Only Approach"]
        L1["Full LLM for<br/>Every Request"]
        L2["$0.01-0.05<br/>per Request"]
        L3["2-5 seconds<br/>Latency"]
        L4["~95% Accuracy<br/>But Overkill"]
    end

    subgraph HYBRID["✅ Hybrid Approach"]
        H1["Smart Routing"]
        H1 --> H2{"Article<br/>Quality?"}
        H2 -->|Good (>85)| H3["Heuristic Only"]
        H2 -->|Borderline| H4["Heuristic + LLM"]
        H2 -->|Bad (<50)| H5["Heuristic Only"]
        
        H3 --> H6["<100ms<br/>Free"]
        H4 --> H7["1-2s<br/>$0.001-0.01"]
        H5 --> H8["<100ms<br/>Free"]
        
        H6 & H7 & H8 --> H9["~85% Accuracy<br/>Optimized Cost"]
    end

    style LLM_ONLY fill:#ffebee
    style HYBRID fill:#e8f5e9
```

---

## Referensi Metodologi

### Jawa Pos (80%)

Panduan penulisan "Piramida Terbalik Berlapis" untuk optimasi mesin:

| Prinsip | Impact |
|---------|--------|
| Lead 40-60 kata | 44% AI citations dari 30% awal teks |
| H3 sesuai panjang | Struktur = lebih banyak citation |
| Section mandiri | AI bisa "mendarat" di tengah artikel |
| Fakta tiap 150-200 kata | Paragraf tanpa fakta = "paragraf mati" |

### Ringkasan Eksekutif (20%)

Standar verifikasi untuk media Indonesia:

| Kategori | Kriteria |
|----------|----------|
| Akurasi | Sumber terpercaya, atribusi jelas |
| Etika | Tanpa fitnah, privasi terjaga |
| Bahasa | Sesuai PUEBI, aktif, jelas |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Olagon Gateway API key (untuk mode Hybrid/LLM)

### Running

```bash
# Install dependencies
npm install

# Start backend (terminal 1)
npm run server

# Start frontend (terminal 2)
npm run client

# Buka http://localhost:5173
```

### Mode Analysis

| Mode | Biaya | Akurasi | Use Case |
|------|-------|---------|----------|
| **Lokal** | Gratis | ~70% | Development, testing, budget constraint |
| **Hybrid** | Rendah | ~85% | Production (recommended) |
| **LLM Penuh** | Tinggi | ~95% | High-stakes decisions |

---

## Environment Variables

```bash
PORT=4000                    # Backend port
ANTHROPIC_API_KEY=xxx        # Olagon API key
MODE=hybrid                  # Default mode: local|hybrid|llm
```

---

## Project Structure

```
├── src/
│   └── App.jsx              # Frontend UI + mode selector
├── server/
│   ├── config.js            # Environment config
│   ├── routes/
│   │   └── analyze.js      # Main analysis endpoint
│   └── services/
│       ├── heuristics.js    # Free analysis algorithms
│       ├── llmEvaluator.js # Claude LLM integration
│       ├── factExtractor.js # Claim extraction
│       ├── urlScraper.js    # URL → text
│       └── cache.js        # File-based cache
├── data/
│   └── calibrate.js         # Calibration script
├── Referensi_penulisan/
│   ├── Penulisan Jawa Pos.pdf
│   └── Ringkasan Eksekutif.docx
└── AGENTS.md                # Developer notes
```

---

## License

MIT
