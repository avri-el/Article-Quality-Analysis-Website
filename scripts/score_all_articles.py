#!/usr/bin/env python3
"""
score_all_articles.py — Hybrid Heuristics + IndoBERT Clustering

Dua-pass pipeline untuk memberi label 6 dimensi ke 80k artikel:
  Pass 1: Heuristic scoring + IndoBERT embedding, checkpoint tiap 5 batch
  Pass 2: K-means clustering → refine konten & etika → final CSV

Features:
  - Resumable: tiap stage bisa resume dari checkpoint
  - Memmap embeddings (hemat RAM)
  - Checkpoint tiap 5 batch (~16 save untuk 80k artikel)

Usage:
  python scripts/score_all_articles.py              # full pipeline
  python scripts/score_all_articles.py --skip-stage1 # resume dari stage 2
  python scripts/score_all_articles.py --skip-stage2 # hanya stage 1

Output:
  outputs/embeddings/embeddings.mmap (80k × 768 float32)
  outputs/embeddings/article_ids.npy
  outputs/scan_results/heuristic_scores.csv
  outputs/scan_results/dataset_with_labels.csv     ← FINAL
  outputs/scan_results/scan_checkpoint.json
  outputs/scan_results/stage2_checkpoint.json
"""

import os, json, re, math, time, argparse
import numpy as np
import pandas as pd

import torch
from transformers import AutoTokenizer, AutoModel

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_CSV = os.path.join(PROJECT_ROOT, "data/raw/final_merge_dataset.csv")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "outputs")
EMBED_DIR = os.path.join(OUTPUT_DIR, "embeddings")
SCAN_DIR = os.path.join(OUTPUT_DIR, "scan_results")
CHECKPOINT_FILE = os.path.join(SCAN_DIR, "scan_checkpoint.json")
FINAL_CSV = os.path.join(SCAN_DIR, "dataset_with_labels.csv")
HEURISTIC_CSV = os.path.join(SCAN_DIR, "heuristic_scores.csv")
EMMAP_PATH = os.path.join(EMBED_DIR, "embeddings.mmap")
ID_PATH = os.path.join(EMBED_DIR, "article_ids.npy")
STAGE2_CHECKPOINT = os.path.join(SCAN_DIR, "stage2_checkpoint.json")

BATCH_SIZE = 1000
CHECKPOINT_INTERVAL = 5  # checkpoint every 5 batches (80 total batches = 16 saves)
MAX_LENGTH = 512
MODEL_NAME = "indolem/indobert-base-uncased"
N_CLUSTERS = 30

WEIGHTS = {
    "konten": 0.3,
    "struktur": 0.2,
    "bahasa": 0.15,
    "etika": 0.15,
    "seo": 0.1,
    "teknis": 0.1,
}


# ── Heuristics (port from heuristics.js) ──────────────────────────────────


def clean(text):
    return re.sub(r"\s+", " ", str(text).strip())


def count_words(text):
    return len(text.strip().split()) if text.strip() else 0


def count_syllables_id(word):
    return max(len(re.findall(r"[aiueo]+", word.lower())), 1)


def flesch_reading_ease_id(text):
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    words = text.strip().split()
    if not sentences or not words:
        return 0
    total_syllables = sum(count_syllables_id(w) for w in words)
    avg_words = len(words) / len(sentences)
    avg_syllables = total_syllables / len(words)
    score = 206.835 - 1.015 * avg_words - 84.6 * avg_syllables
    return max(0, min(100, round(score)))


def estimate_passive_ratio(text):
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    if not sentences:
        return 0.0
    passive_pattern = re.compile(r"\b(di[a-z]+ oleh|ter[a-z]+ oleh)\b", re.IGNORECASE)
    passive_count = sum(1 for s in sentences if passive_pattern.search(s))
    return passive_count / len(sentences)


def has_attribution(text):
    return bool(
        re.search(
            r"\b(menurut|ujar|kata|jelas\w*|tutur|sebut\w*)\b", text, re.IGNORECASE
        )
    )


def count_attributions(text):
    return len(
        re.findall(
            r"\b(menurut|ujar|kata|jelas\w*|tutur|sebut\w*)\b", text, re.IGNORECASE
        )
    )


def analyze_struktur(text):
    text_c = clean(text)
    paragraphs = [p for p in text_c.split("\n") if p.strip()]
    first_para = paragraphs[0] if paragraphs else ""
    lead_words = count_words(first_para)
    score = 100
    notes = []
    if lead_words > 35:
        score -= 15
        notes.append(f"Lead too long ({lead_words} words, max 35)")
    if len(paragraphs) < 3:
        score -= 10
        notes.append("Too few paragraphs (<3)")
    if not has_attribution(text_c):
        score -= 15
        notes.append("No attribution found")
    return (
        max(0, score),
        notes,
        {"lead_words": lead_words, "paragraph_count": len(paragraphs)},
    )


def analyze_bahasa(text):
    text_c = clean(text)
    readability = flesch_reading_ease_id(text_c)
    passive_ratio = estimate_passive_ratio(text_c)
    score = 100
    if readability < 50:
        score -= 20
    if passive_ratio > 0.5:
        score -= 15
    return max(0, score), readability, passive_ratio


def analyze_seo(text):
    words = count_words(clean(text))
    score = 100
    if words < 500:
        score -= 20
    return max(0, score), words


def analyze_teknis(text):
    text_c = clean(text)
    score = 100
    double_spaces = len(re.findall(r"\s{2,}", text_c))
    if double_spaces > 3:
        score -= 5
    return max(0, score)


def score_konten_heuristic(text, word_count, attribution_present, readability):
    length_score = (
        min(40, 40 * math.log(word_count + 1) / math.log(2500))
        if word_count > 100
        else 0
    )
    attr_score = 30 if attribution_present else 0
    read_score = (
        max(0, min(30, 30 * (readability / 60)))
        if readability < 60
        else max(0, 30 - (readability - 60) * 1.5)
    )
    return round(length_score + attr_score + read_score)


def score_etika_heuristic(text, attribution_count, passive_ratio):
    attr_score = min(40, attribution_count * 8)
    pass_score = max(0, 30 - round(passive_ratio * 60))
    form_score = 30
    return min(100, attr_score + pass_score + form_score)


# ── Stage 1: Heuristics + Embeddings ─────────────────────────────────────


def stage1_heuristics_and_embeddings():
    os.makedirs(EMBED_DIR, exist_ok=True)
    os.makedirs(SCAN_DIR, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Stage 1] Device: {device}")
    print(f"[Stage 1] Loading model: {MODEL_NAME}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device).eval()

    # check checkpoint
    checkpoint = {"last_idx": 0, "total": 0, "batch": 0}
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE) as f:
            checkpoint = json.load(f)
        print(
            f"[Stage 1] Resuming from idx {checkpoint['last_idx']} (batch {checkpoint['batch']})"
        )

    # count total lines
    if checkpoint["last_idx"] == 0:
        with open(RAW_CSV, "rb") as f:
            total = sum(1 for _ in f) - 1  # -1 for header
        checkpoint["total"] = total
        print(f"[Stage 1] Total articles: {total}")

        # create memmap
        os.makedirs(os.path.dirname(EMMAP_PATH), exist_ok=True)
        mmap = np.memmap(EMMAP_PATH, dtype="float32", mode="w+", shape=(total, 768))
        mmap.flush()
    else:
        total = checkpoint["total"]
        mmap = np.memmap(EMMAP_PATH, dtype="float32", mode="r+", shape=(total, 768))

    # read CSV in chunks
    reader = pd.read_csv(
        RAW_CSV,
        chunksize=BATCH_SIZE,
        quotechar='"',
        doublequote=True,
        dtype={
            "Content": str,
            "Judul": str,
            "source": str,
            "tag1": str,
            "tag2": str,
            "tag3": str,
            "tag4": str,
            "tag5": str,
        },
    )

    heuristic_rows = []
    start_idx = checkpoint["last_idx"]
    start_batch = checkpoint["batch"]
    batch_num = 0
    skipped_first = False

    for chunk in reader:
        if not skipped_first:
            batch_num = 0
            skipped_first = True

        batch_start = start_idx + batch_num * BATCH_SIZE

        if batch_num < start_batch:
            batch_num += 1
            continue

        if batch_start >= total:
            break

        batch_end = min(batch_start + BATCH_SIZE, total)
        current_batch_size = batch_end - batch_start

        content_col = chunk["Content"].fillna("").tolist()[:current_batch_size]
        judul_col = chunk["Judul"].fillna("").tolist()[:current_batch_size]
        source_col = chunk["source"].fillna("").tolist()[:current_batch_size]
        waktu_col = chunk["Waktu"].fillna("").tolist()[:current_batch_size]
        link_col = chunk["Link"].fillna("").tolist()[:current_batch_size]

        batch_data = []
        texts_for_embed = []
        valid_indices = []

        for i, (content, judul) in enumerate(zip(content_col, judul_col)):
            if len(content.strip()) < 100:
                continue

            struktur_score, _, struktur_meta = analyze_struktur(content)
            bahasa_score, readability, passive_ratio = analyze_bahasa(content)
            seo_score, word_count = analyze_seo(content)
            teknis_score = analyze_teknis(content)
            attr_count = count_attributions(content)
            attr_present = attr_count > 0

            konten_score = score_konten_heuristic(
                content, word_count, attr_present, readability
            )
            etika_score = score_etika_heuristic(content, attr_count, passive_ratio)

            row = {
                "idx": batch_start + i,
                "judul": judul,
                "link": link_col[i] if i < len(link_col) else "",
                "source": source_col[i] if i < len(source_col) else "",
                "waktu": waktu_col[i] if i < len(waktu_col) else "",
                "konten_h": konten_score,
                "struktur": struktur_score,
                "bahasa": bahasa_score,
                "etika_h": etika_score,
                "seo": seo_score,
                "teknis": teknis_score,
                "word_count": word_count,
                "readability": readability,
                "passive_ratio": round(passive_ratio, 3),
                "attr_count": attr_count,
            }
            batch_data.append(row)
            texts_for_embed.append(clean(content))
            valid_indices.append(batch_start + i)

        # embed
        if texts_for_embed:
            encodings = tokenizer(
                texts_for_embed,
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
                return_tensors="pt",
            )
            encodings = {k: v.to(device) for k, v in encodings.items()}

            with torch.no_grad():
                outputs = model(**encodings)
                cls_embeds = (
                    outputs.last_hidden_state[:, 0, :].cpu().numpy().astype("float32")
                )

            for j, idx in enumerate(valid_indices):
                mmap[idx] = cls_embeds[j]

            mmap.flush()
            heuristic_rows.extend(batch_data)

        batch_num += 1

        if batch_num % CHECKPOINT_INTERVAL == 0 and heuristic_rows:
            checkpoint["last_idx"] = batch_end
            checkpoint["batch"] = batch_num
            with open(CHECKPOINT_FILE, "w") as f:
                json.dump(checkpoint, f)

            temp_df = pd.DataFrame(heuristic_rows)
            temp_df.to_csv(HEURISTIC_CSV, index=False)

        elapsed = time.time() - stage1_start
        rate = batch_num / elapsed if elapsed > 0 else 0
        remaining = (total / BATCH_SIZE - batch_num) / rate if rate > 0 else 0
        print(
            f"  Batch {batch_num}/{math.ceil(total / BATCH_SIZE)} | {len(heuristic_rows)} articles | "
            f"{elapsed:.0f}s elapsed | ETA: {remaining:.0f}s"
        )

    # final save
    if heuristic_rows:
        df = pd.DataFrame(heuristic_rows)
        df.to_csv(HEURISTIC_CSV, index=False)
        print(f"[Stage 1] Saved {len(heuristic_rows)} rows to {HEURISTIC_CSV}")

    # save article IDs for mapping
    ids = np.array([r["idx"] for r in heuristic_rows], dtype=np.int64)
    np.save(ID_PATH, ids)

    checkpoint["last_idx"] = total
    checkpoint["batch"] = math.ceil(total / BATCH_SIZE)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(checkpoint, f)

    del model, mmap
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    print(f"[Stage 1] Done. Processed {len(heuristic_rows)} articles.")


# ── Stage 2: Clustering + Final Scoring ──────────────────────────────────


def stage2_cluster_and_score():
    # Check if already complete
    if os.path.exists(FINAL_CSV):
        existing = pd.read_csv(FINAL_CSV)
        if len(existing) > 0:
            print(f"[Stage 2] {FINAL_CSV} already exists ({len(existing)} articles).")
            print("[Stage 2] Skipping. Delete the file to re-run.")
            return

    print("[Stage 2] Loading heuristic scores...")
    if not os.path.exists(HEURISTIC_CSV):
        print("[Stage 2] ERROR: heuristic_scores.csv not found. Run stage 1 first.")
        return

    df = pd.read_csv(HEURISTIC_CSV)

    print(f"[Stage 2] Loading embeddings ({len(df)} articles)...")
    mmap = np.memmap(
        EMMAP_PATH, dtype="float32", mode="r", shape=(checkpoint_total(), 768)
    )
    ids = np.load(ID_PATH)
    embeddings = mmap[ids]

    print(f"[Stage 2] K-means clustering (k={N_CLUSTERS})...")
    scaler = StandardScaler()
    emb_scaled = scaler.fit_transform(embeddings)

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10, verbose=0)
    cluster_labels = kmeans.fit_predict(emb_scaled)
    df["cluster"] = cluster_labels

    print(f"[Stage 2] Computing refined scores within clusters...")
    konten_refined = []
    etika_refined = []

    for cluster_id in range(N_CLUSTERS):
        mask = df["cluster"] == cluster_id
        cluster_df = df[mask].copy()
        if len(cluster_df) < 2:
            for _ in range(len(cluster_df)):
                konten_refined.append(cluster_df.iloc[0]["konten_h"])
                etika_refined.append(cluster_df.iloc[0]["etika_h"])
            continue

        # normalize word_count within cluster
        wc = cluster_df["word_count"].values
        wc_min, wc_max = wc.min(), wc.max()
        wc_norm = (
            np.clip((wc - wc_min) / (wc_max - wc_min + 1), 0, 1) * 40
            if wc_max > wc_min
            else np.full_like(wc, 20)
        )

        # attribution score within cluster
        ac = cluster_df["attr_count"].values
        ac_max = ac.max()
        ac_norm = (
            np.clip(ac / (ac_max + 1), 0, 1) * 30 if ac_max > 0 else np.zeros_like(ac)
        )

        # readability score within cluster
        rd = cluster_df["readability"].values
        rd_ideal = 55
        rd_dist = 1 - np.abs(rd - rd_ideal) / 60
        rd_norm = np.clip(rd_dist, 0, 1) * 30

        k_scores = wc_norm + ac_norm + rd_norm
        konten_refined.extend(np.round(k_scores).astype(int).tolist())

        # etika refined
        attr_et = np.clip(ac / (ac_max + 1), 0, 1) * 40
        pr = cluster_df["passive_ratio"].values
        pass_et = np.clip((1 - pr * 2), 0, 1) * 30
        form_et = np.full_like(ac, 30)
        e_scores = attr_et + pass_et + form_et
        etika_refined.extend(np.round(e_scores).astype(int).tolist())

    df["konten"] = konten_refined
    df["etika"] = etika_refined

    # compute overall
    def compute_overall(row):
        return round(
            row["konten"] * WEIGHTS["konten"]
            + row["struktur"] * WEIGHTS["struktur"]
            + row["bahasa"] * WEIGHTS["bahasa"]
            + row["etika"] * WEIGHTS["etika"]
            + row["seo"] * WEIGHTS["seo"]
            + row["teknis"] * WEIGHTS["teknis"]
        )

    def assign_verdict(score):
        if score >= 75:
            return "Layak terbit"
        if score >= 50:
            return "Perlu revisi"
        return "Ditolak"

    df["overall"] = df.apply(compute_overall, axis=1)
    df["verdict"] = df["overall"].apply(assign_verdict)

    # reorder columns for final output
    output_cols = [
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
        "cluster",
        "word_count",
        "readability",
        "passive_ratio",
        "attr_count",
        "konten_h",
        "etika_h",
    ]
    existing_cols = [c for c in output_cols if c in df.columns]
    df_out = df[existing_cols].copy()
    df_out.to_csv(FINAL_CSV, index=False)

    # mark complete
    with open(STAGE2_CHECKPOINT, "w") as f:
        json.dump({"complete": True, "rows": len(df_out)}, f)

    # stats
    verdict_counts = df_out["verdict"].value_counts()
    avg_score = df_out["overall"].mean()
    print(f"\n[Stage 2] Done! Saved {len(df_out)} articles to {FINAL_CSV}")
    print(f"  Layak terbit: {verdict_counts.get('Layak terbit', 0)}")
    print(f"  Perlu revisi: {verdict_counts.get('Perlu revisi', 0)}")
    print(f"  Ditolak:      {verdict_counts.get('Ditolak', 0)}")
    print(f"  Avg overall:  {avg_score:.1f}")
    print(f"  Clusters:     {N_CLUSTERS}")
    del mmap


def checkpoint_total():
    with open(CHECKPOINT_FILE) as f:
        cp = json.load(f)
    return cp["total"]


# ── Main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Hybrid Heuristics + IndoBERT Clustering Scoring"
    )
    parser.add_argument(
        "--skip-stage1",
        action="store_true",
        help="Skip Stage 1 (heuristics + embeddings)",
    )
    parser.add_argument(
        "--skip-stage2",
        action="store_true",
        help="Skip Stage 2 (clustering + final scoring)",
    )
    args = parser.parse_args()

    stage1_start = time.time()

    if not args.skip_stage1:
        print("=" * 60)
        print("Stage 1: Heuristics + IndoBERT Embeddings")
        print("=" * 60)
        stage1_heuristics_and_embeddings()
        print(f"Stage 1 finished in {time.time() - stage1_start:.0f}s\n")

    if not args.skip_stage2:
        print("=" * 60)
        print("Stage 2: K-means Clustering + Refined Scoring")
        print("=" * 60)
        stage2_cluster_and_score()
        print(f"Stage 2 finished in {time.time() - stage1_start:.0f}s")

    print(f"\nTotal: {time.time() - stage1_start:.0f}s")
