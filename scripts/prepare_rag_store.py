#!/usr/bin/env python3
"""
prepare_rag_store.py — Embed candidates + simpan ke vector store (ChromaDB)

Membaca candidates_for_validation.csv, meng-embed tiap artikel dengan
sentence-transformer (multilingual-e5-small), dan menyimpannya ke:
  1. ChromaDB persistent (outputs/rag/chromadb/)
  2. Juga fallback: outputs/rag/reference_embeddings.npy (untuk akses dari Node.js)

Jika ChromaDB tidak tersedia, fallback ke numpy + CSV saja.

Usage:
  python scripts/prepare_rag_store.py
  python scripts/prepare_rag_store.py --embedder all-MiniLM-L6-v2   # embedder ringan
"""

import os, sys, json, argparse
import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATE_CSV = os.path.join(
    PROJECT_ROOT, "outputs/candidates/candidates_for_validation.csv"
)
RAG_DIR = os.path.join(PROJECT_ROOT, "outputs/rag")
REFERENCE_CSV = os.path.join(RAG_DIR, "reference_set.csv")
EMBEDDINGS_PATH = os.path.join(RAG_DIR, "reference_embeddings.npy")
IDS_PATH = os.path.join(RAG_DIR, "reference_ids.npy")
CHROMA_DIR = os.path.join(RAG_DIR, "chromadb")

DEFAULT_EMBEDDER = "intfloat/multilingual-e5-small"  # good for Indonesian


def embed_candidates():
    os.makedirs(RAG_DIR, exist_ok=True)

    if not os.path.exists(CANDIDATE_CSV):
        print(f"ERROR: {CANDIDATE_CSV} not found. Run select_candidates.py first.")
        return

    df = pd.read_csv(CANDIDATE_CSV)
    print(f"Loaded {len(df)} candidates")

    # build text for embedding: combine key fields
    texts = []
    for _, row in df.iterrows():
        text = f"Judul: {row.get('judul', '')}\n"
        text += f"Sumber: {row.get('source', '')}\n"
        text += f"Konten: {row.get('word_count', 0)} kata\n"
        text += f"Nilai: konten={row.get('konten', '?')} struktur={row.get('struktur', '?')} "
        text += f"bahasa={row.get('bahasa', '?')} etika={row.get('etika', '?')} "
        text += f"seo={row.get('seo', '?')} teknis={row.get('teknis', '?')} "
        text += f"overall={row.get('overall', '?')} ({row.get('verdict', '?')})"
        texts.append(text)

    # embed
    print(f"Loading embedder: {EMBEDDER_NAME}...")
    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer(EMBEDDER_NAME)
    print(f"Embedding {len(texts)} texts...")
    embeddings = embedder.encode(
        texts, show_progress_bar=True, normalize_embeddings=True
    )

    # save numpy fallback
    np.save(EMBEDDINGS_PATH, embeddings.astype("float32"))
    np.save(IDS_PATH, df["idx"].values)
    print(f"Embeddings saved: {EMBEDDINGS_PATH} ({embeddings.shape})")

    # try ChromaDB
    chroma_ok = False
    try:
        import chromadb
        from chromadb.config import Settings

        os.makedirs(CHROMA_DIR, exist_ok=True)
        client = chromadb.PersistentClient(
            path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False)
        )

        collection_name = "article_references"
        try:
            client.delete_collection(collection_name)
        except Exception:
            pass

        collection = client.create_collection(
            name=collection_name,
            metadata={
                "hnsw:space": "cosine",
                "description": "Reference articles for RAG",
            },
        )

        # prepare data for chroma
        ids = [str(idx) for idx in df["idx"].values]
        metadatas = []
        for _, row in df.iterrows():
            meta = {
                "judul": str(row.get("judul", ""))[:200],
                "source": str(row.get("source", "")),
                "konten": int(row.get("konten", 0)),
                "struktur": int(row.get("struktur", 0)),
                "bahasa": int(row.get("bahasa", 0)),
                "etika": int(row.get("etika", 0)),
                "seo": int(row.get("seo", 0)),
                "teknis": int(row.get("teknis", 0)),
                "overall": int(row.get("overall", 0)),
                "verdict": str(row.get("verdict", "")),
                "tier": str(row.get("tier", "")),
                "word_count": int(row.get("word_count", 0)),
                "status": str(row.get("status", "")),
                "validated_konten": str(row.get("validated_konten", "")),
            }
            metadatas.append(meta)

        # strip NaN from metadata
        for m in metadatas:
            for k, v in list(m.items()):
                if isinstance(v, float) and np.isnan(v):
                    m[k] = ""

        documents = [str(row.get("judul", "")) for _, row in df.iterrows()]

        batch_size = 16
        for i in range(0, len(ids), batch_size):
            end = min(i + batch_size, len(ids))
            collection.add(
                ids=ids[i:end],
                embeddings=embeddings[i:end].tolist(),
                metadatas=metadatas[i:end],
                documents=documents[i:end],
            )
            print(f"  ChromaDB: added {end}/{len(ids)}")

        print(f"ChromaDB collection '{collection_name}' ready at {CHROMA_DIR}")
        print(f"  Total items: {collection.count()}")
        chroma_ok = True

    except ImportError:
        print("ChromaDB not installed. Skipping vector store.")
    except Exception as e:
        print(f"ChromaDB error: {e}. Using numpy fallback only.")

    # save reference CSV
    df.to_csv(REFERENCE_CSV, index=False)
    print(f"Reference CSV saved: {REFERENCE_CSV}")

    # print RAG query example
    embed_dim = embeddings.shape[1]
    print(f"\n{'=' * 50}")
    print("RAG Store Ready!")
    print(f"{'=' * 50}")
    print(f"  Candidates:   {len(df)}")
    print(f"  Embed dim:    {embed_dim}")
    print(f"  Embedder:     {EMBEDDER_NAME}")
    print(f"  ChromaDB:     {'YES' if chroma_ok else 'NO (numpy fallback)'}")
    print(f"\n  Files:")
    print(f"    {REFERENCE_CSV}")
    print(f"    {EMBEDDINGS_PATH}")
    if chroma_ok:
        print(f"    {CHROMA_DIR}/")
    print(f"\n  To query from Node.js (cosine similarity):")
    print(f"    1. Load reference_embeddings.npy")
    print(f"    2. Load reference_set.csv")
    print(f"    3. Compute new article embedding with same model")
    print(f"    4. Cosine similarity → top-k results")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare RAG store from candidates")
    parser.add_argument(
        "--embedder",
        default=DEFAULT_EMBEDDER,
        help=f"SentenceTransformer model (default: {DEFAULT_EMBEDDER})",
    )
    args = parser.parse_args()
    EMBEDDER_NAME = args.embedder

    embed_candidates()
