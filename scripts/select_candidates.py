#!/usr/bin/env python3
"""
select_candidates.py — Stratified sampling dari dataset_with_labels.csv

Memilih kandidat representatif per tier skor (Sangat Baik / Baik / Cukup / Buruk)
untuk divalidasi manusia sebelum dijadikan reference set RAG.

Output: outputs/candidates/candidates_for_validation.csv
        outputs/candidates/candidates_stats.json

Tiap baris ditandai "PERLU VALIDASI MANUSIA" — skor IndoBERT TIDAK BOLEH
langsung dipakai tanpa validasi untuk reference set.

Usage:
  python scripts/select_candidates.py
"""

import os, sys, json
import pandas as pd
import numpy as np

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL_CSV = os.path.join(PROJECT_ROOT, "outputs/scan_results/dataset_with_labels.csv")
CANDIDATE_DIR = os.path.join(PROJECT_ROOT, "outputs/candidates")
CANDIDATE_CSV = os.path.join(CANDIDATE_DIR, "candidates_for_validation.csv")
STATS_FILE = os.path.join(CANDIDATE_DIR, "candidates_stats.json")

SAMPLES_PER_TIER = 10  # ~10 per tier = ~40 total


def assign_tier(overall):
    if overall >= 85:
        return "Sangat Baik"
    if overall >= 70:
        return "Baik"
    if overall >= 50:
        return "Cukup"
    return "Buruk"


def select_candidates():
    os.makedirs(CANDIDATE_DIR, exist_ok=True)

    print("Loading dataset_with_labels.csv...")
    df = pd.read_csv(FINAL_CSV)
    print(f"Total articles: {len(df)}")

    # assign tiers
    df["tier"] = df["overall"].apply(assign_tier)

    print("\nTier distribution:")
    tier_counts = df["tier"].value_counts()
    for tier in ["Sangat Baik", "Baik", "Cukup", "Buruk"]:
        count = tier_counts.get(tier, 0)
        pct = count / len(df) * 100 if len(df) > 0 else 0
        print(f"  {tier:15s}: {count:6d} ({pct:.1f}%)")

    samples = []
    for tier in ["Sangat Baik", "Baik", "Cukup", "Buruk"]:
        tier_df = df[df["tier"] == tier]
        if len(tier_df) == 0:
            print(f"  WARNING: No articles in tier '{tier}'")
            continue

        # within tier, sample proportionally by source
        source_counts = tier_df["source"].value_counts()
        n_sources = len(source_counts)

        per_source = max(1, SAMPLES_PER_TIER // n_sources)
        extra = SAMPLES_PER_TIER - per_source * n_sources

        total_sampled = 0
        for i, (source, _) in enumerate(source_counts.items()):
            source_df = tier_df[tier_df["source"] == source]
            n = per_source + (1 if i < extra else 0)
            n = min(n, len(source_df))

            if n == 0:
                continue

            # pick most confident predictions (highest score for good tiers, lowest for bad)
            if tier in ("Sangat Baik", "Baik"):
                selected = source_df.nlargest(n, "overall")
            elif tier == "Cukup":
                # mid-range: pick closest to tier midpoint (60)
                source_df = source_df.copy()
                source_df["_dist_mid"] = abs(source_df["overall"] - 60)
                selected = source_df.nsmallest(n, "_dist_mid")
            else:
                selected = source_df.nsmallest(n, "overall")

            samples.append(selected)
            total_sampled += len(selected)

        print(f"  {tier:15s}: sampled {total_sampled} candidates")

    candidates = pd.concat(samples).reset_index(drop=True)
    candidates["status"] = "PERLU VALIDASI MANUSIA"
    candidates["validated_konten"] = np.nan
    candidates["validated_konten_note"] = ""
    candidates["validated_by"] = ""
    candidates["validation_date"] = ""

    # select and reorder columns
    cols = [
        "idx",
        "judul",
        "link",
        "source",
        "waktu",
        "konten",
        "struktur",
        "bahasa",
        "etika",
        "seo",
        "teknis",
        "overall",
        "verdict",
        "tier",
        "cluster",
        "word_count",
        "readability",
        "status",
        "validated_konten",
        "validated_konten_note",
        "validated_by",
        "validation_date",
    ]

    existing_cols = [c for c in cols if c in candidates.columns]
    candidates_out = candidates[existing_cols].copy()
    candidates_out.to_csv(CANDIDATE_CSV, index=False)

    print(f"\nSaved {len(candidates_out)} candidates to {CANDIDATE_CSV}")
    print(f"\n{'=' * 50}")
    print("IMPORTANT: Skor IndoBERT di atas adalah PREDIKSI.")
    print("Semua kandidat bertanda 'PERLU VALIDASI MANUSIA'.")
    print("Skor ini TIDAK boleh dipakai langsung sebagai reference set RAG.")
    print("Validasi manusia (atau validasi Claude) WAJIB sebelum dipakai.")
    print(f"{'=' * 50}\n")

    # save stats
    tier_stats = {}
    for tier in ["Sangat Baik", "Baik", "Cukup", "Buruk"]:
        tier_cands = candidates_out[candidates_out["tier"] == tier]
        tier_stats[tier] = {
            "count": len(tier_cands),
            "avg_overall": round(tier_cands["overall"].mean(), 1)
            if len(tier_cands) > 0
            else 0,
            "sources": tier_cands["source"].value_counts().to_dict(),
        }

    stats = {
        "total_candidates": len(candidates_out),
        "samples_per_tier": SAMPLES_PER_TIER,
        "source_distribution": candidates_out["source"].value_counts().to_dict(),
        "tier_distribution": candidates_out["tier"].value_counts().to_dict(),
        "tier_stats": tier_stats,
        "note": "Skor IndoBERT — perlu validasi manusia sebelum dipakai sebagai RAG reference",
    }

    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(f"Stats saved to {STATS_FILE}")

    # summary
    print(f"\nSummary:")
    for tier in ["Sangat Baik", "Baik", "Cukup", "Buruk"]:
        count = len(candidates_out[candidates_out["tier"] == tier])
        print(f"  {tier:15s}: {count} candidates")


if __name__ == "__main__":
    select_candidates()
