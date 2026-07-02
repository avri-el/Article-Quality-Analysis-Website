import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const sampleArticle = `Pemerintah Kota Manado resmi mengalokasikan anggaran sebesar Rp45 miliar untuk perbaikan jalan rusak di sejumlah kecamatan pada tahun anggaran 2026. Menurut Kepala Dinas PUPR Kota Manado, Ferry Lompoliu, anggaran tersebut akan difokuskan pada 32 ruas jalan yang dinilai paling rusak berdasarkan hasil survei lapangan bulan Mei lalu.

Banyak warga menilai perbaikan ini seharusnya sudah dilakukan sejak tahun lalu. Sumber di lingkungan pemkot yang tidak ingin disebutkan namanya mengatakan proyek ini rawan dikorupsi.

Proyek ini ditargetkan rampung sebelum akhir tahun 2026 dan akan diawasi langsung oleh inspektorat daerah. Beberapa pengamat kebijakan publik menyebut alokasi ini sudah tepat sasaran. Jelas ini adalah langkah terbaik yang pernah diambil pemkot dalam lima tahun terakhir.`;

const analyzeText = (text) => {
  const clean = text.trim();
  const words = clean.length ? clean.split(/\s+/).length : 0;
  const score = Math.min(
    95,
    Math.max(
      40,
      Math.round(
        50 +
          words / 10 +
          (clean.includes("sumber") ? 5 : 0) +
          (clean.includes("anonim") ? -8 : 0),
      ),
    ),
  );
  const highlights = [];

  if (clean.includes("anonim")) {
    highlights.push({
      type: "bad",
      text: "Terdapat sumber anonim yang belum jelas kredibilitasnya.",
      note: "Sumber anonim dapat menurunkan kepercayaan pembaca.",
    });
  }
  if (clean.includes("menilai") || clean.includes("pengamat")) {
    highlights.push({
      type: "warn",
      text: "Beberapa opini disampaikan tanpa data pendukung yang jelas.",
      note: "Tandai klaim opini agar tidak tampil sebagai fakta.",
    });
  }
  if (highlights.length === 0) {
    highlights.push({
      type: "good",
      text: "Artikel tampak terstruktur dengan jelas dan faktual.",
      note: "Tidak ada sorotan kualitas utama yang memerlukan perbaikan.",
    });
  }

  return {
    overallScore: score,
    summary:
      "Analisis AI menunjukkan artikel memiliki struktur yang baik dengan beberapa poin yang dapat diperbaiki pada kredibilitas dan penanda opini.",
    details: [
      {
        name: "Relevansi",
        value: `${Math.min(100, score + 5)}`,
        text: "Judul dan isi artikel relatif cocok satu sama lain.",
      },
      {
        name: "Objektivitas",
        value: `${Math.max(45, score - 10)}`,
        text: "Terdapat beberapa frasa opini yang perlu diperjelas.",
      },
      {
        name: "Kredibilitas",
        value: `${Math.max(40, score - 15)}`,
        text: "Sumber artikel perlu diverifikasi terutama bila anonim.",
      },
      {
        name: "Bahasa",
        value: `${Math.min(100, score + 8)}`,
        text: "Bahasa cukup jelas dan mudah dipahami.",
      },
      {
        name: "Keterbacaan",
        value: `${Math.min(100, score + 6)}`,
        text: "Paragraf relatif pendek sehingga mudah dibaca.",
      },
    ],
    highlights,
  };
};

app.post("/api/analyze", (req, res) => {
  const { text, url } = req.body;

  if (!text && !url) {
    return res.status(400).json({ error: "Teks atau URL diperlukan." });
  }

  const article = url ? sampleArticle : text;
  const result = analyzeText(article);
  return res.json(result);
});

app.listen(port, () => {
  console.log(`Backend berjalan pada http://localhost:${port}`);
});
