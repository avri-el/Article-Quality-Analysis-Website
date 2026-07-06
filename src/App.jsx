import { useMemo, useState } from "react";
import logo from "./assets/logo.webp";

const verdictFromScore = (score) => {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Verification";
  return "Low Quality";
};

const badgeColor = (score) => {
  if (score >= 85) return "bg-emerald-100 text-emerald-700";
  if (score >= 70) return "bg-blue-100 text-blue-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const sampleArticle = `Pemerintah Kota Manado resmi mengalokasikan anggaran sebesar Rp45 miliar untuk perbaikan jalan rusak di sejumlah kecamatan pada tahun anggaran 2026. Menurut Kepala Dinas PUPR Kota Manado, Ferry Lompoliu, anggaran tersebut akan difokuskan pada 32 ruas jalan yang dinilai paling rusak berdasarkan hasil survei lapangan bulan Mei lalu.

Banyak warga menilai perbaikan ini seharusnya sudah dilakukan sejak tahun lalu. Sumber di lingkungan pemkot yang tidak ingin disebutkan namanya mengatakan proyek ini rawan dikorupsi.

Proyek ini ditargetkan rampung sebelum akhir tahun 2026 dan akan diawasi langsung oleh inspektorat daerah. Beberapa pengamat kebijakan publik menyebut alokasi ini sudah tepat sasaran. Jelas ini adalah langkah terbaik yang pernah diambil pemkot dalam lima tahun terakhir.`;

const metrics = [
  { name: "Relevansi", value: "88" },
  { name: "Objektivitas", value: "72" },
  { name: "Kredibilitas", value: "65" },
  { name: "Bahasa", value: "90" },
  { name: "Keterbacaan", value: "84" },
];

function App() {
  const [text, setText] = useState(sampleArticle);
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState("paste");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const words = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text],
  );

  const analyze = async () => {
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeTab === "url" ? "" : text,
          url: activeTab === "url" ? url : "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal melakukan analisis");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50 text-blue-950">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="logo" className="h-20 w-auto object-contain" />
          </div>
        </div>
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200/80">
          <div className="mb-6 max-w-3xl">
            <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
              AI Artikel Analyzer
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-blue-950">
              Analisis kualitas artikel secara cepat
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Tempel teks artikel atau masukkan tautan. Tidak ada login, tidak
              ada dashboard yang rumit — langsung analisis.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="rounded-3xl bg-blue-50 p-4 ring-1 ring-blue-200">
              <div className="mb-4 flex gap-2 rounded-2xl bg-white p-1 text-sm font-semibold text-blue-700 shadow-sm">
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 transition ${activeTab === "paste" ? "bg-blue-900 text-white" : "hover:bg-blue-100"}`}
                  onClick={() => setActiveTab("paste")}
                >
                  Paste Artikel
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 transition ${activeTab === "url" ? "bg-blue-900 text-white" : "hover:bg-blue-100"}`}
                  onClick={() => setActiveTab("url")}
                >
                  Analisis URL
                </button>
              </div>

              {activeTab === "paste" ? (
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={12}
                  className="w-full rounded-3xl border border-blue-200 bg-white px-5 py-4 text-sm leading-6 text-blue-950 outline-none ring-blue-300 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Tempel artikel Anda di sini..."
                />
              ) : (
                <div className="space-y-4">
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    type="url"
                    className="w-full rounded-3xl border border-blue-200 bg-white px-5 py-4 text-sm outline-none ring-blue-300 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Masukkan tautan artikel, misal manadopost.id/..."
                  />
                  <p className="text-sm text-slate-500">
                    Tempel URL artikel dari website mana pun untuk dianalisis.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-blue-200">
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                Ringkasan
              </div>
              <div className="text-4xl font-semibold text-blue-950">
                {activeTab === "paste" ? words : url ? "URL" : "0"}
              </div>
              <div className="text-sm text-slate-500">
                {activeTab === "paste"
                  ? "Jumlah kata"
                  : "Tautan yang akan dianalisis"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Data tetap lokal dan sederhana. Fokus pada analisis artikel.
            </div>
            <button
              type="button"
              onClick={analyze}
              disabled={
                loading || (activeTab === "paste" ? !text.trim() : !url.trim())
              }
              className="inline-flex items-center justify-center rounded-3xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? "Menganalisis..." : "Mulai Analisis"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-3xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}
        </div>

        {result && (
          <section className="space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                    Hasil Analisis
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold text-blue-950">
                    Skor artikel: {result.overallScore}
                  </h2>
                  {result.sourceDomain && (
                    <p className="mt-1 text-sm text-slate-500">
                      Sumber: {result.sourceDomain}
                      {result.fromCache && " (dari cache)"}
                    </p>
                  )}
                  <p className="mt-2 max-w-2xl text-slate-600">
                    {result.summary}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${badgeColor(result.overallScore)}`}
                >
                  {verdictFromScore(result.overallScore)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.details.map((item) => (
                <article
                  key={item.name}
                  className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blue-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-blue-700">
                      {item.name}
                    </p>
                    <span className="text-2xl font-semibold text-blue-950">
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
              <h3 className="text-xl font-semibold text-blue-950">
                Sorotan kalimat
              </h3>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
                {result.highlights.map((item) => (
                  <div
                    key={item.text}
                    className={`rounded-3xl border p-4 ${item.type === "bad" ? "border-rose-200 bg-rose-50" : item.type === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                  >
                    <p className="font-semibold text-blue-950">
                      {item.type === "bad"
                        ? "Perlu perbaikan serius"
                        : item.type === "warn"
                          ? "Perlu perhatian"
                          : "Baik"}
                    </p>
                    <p className="mt-2 text-slate-700">{item.text}</p>
                    {item.note && (
                      <p className="mt-2 text-sm text-slate-500">{item.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
