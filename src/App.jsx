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

const weaknessStyles = {
  passive: { icon: "🔴", label: "Kalimat Pasif", class: "border-l-4 border-red-400 bg-red-50" },
  complex: { icon: "🟡", label: "Kalimat Kompleks", class: "border-l-4 border-yellow-400 bg-yellow-50" },
  formal: { icon: "🔵", label: "Kata Formal Berulang", class: "border-l-4 border-blue-400 bg-blue-50" },
  spacing: { icon: "⚪", label: "Spasi Ganda", class: "border-l-4 border-gray-400 bg-gray-50" },
  trailing: { icon: "⚪", label: "Spasi Akhir Baris", class: "border-l-4 border-gray-400 bg-gray-50" },
  linebreak: { icon: "⚪", label: "Inkonsisten Line Break", class: "border-l-4 border-gray-400 bg-gray-50" },
  quotes: { icon: "⚪", label: "Tanda Kutip Non-standar", class: "border-l-4 border-gray-400 bg-gray-50" },
};

const WeaknessLegend = () => (
  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
    {Object.entries(weaknessStyles).map(([key, val]) => (
      <span key={key} className="flex items-center gap-1">
        <span>{val.icon}</span>
        {val.label}
      </span>
    ))}
  </div>
);

const WeaknessList = ({ weaknesses, max = 5 }) => {
  if (!weaknesses || weaknesses.length === 0) return null;
  const display = weaknesses.slice(0, max);
  
  return (
    <div className="mt-3 space-y-2">
      {display.map((w, i) => {
        const style = weaknessStyles[w.type] || weaknessStyles.passive;
        return (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${style.class}`}>
            <span className="mt-0.5">{style.icon}</span>
            <div>
              <p className="font-medium text-slate-700">
                {w.passiveWord && <span className="text-red-600 font-bold">"{w.passiveWord}"</span>}
                {w.wordCount && <span>Kalimat {w.wordCount} kata</span>}
                {w.count && <span>"{w.text}" {w.count}x</span>}
                {w.type === 'spacing' || w.type === 'trailing' || w.type === 'linebreak' || w.type === 'quotes' ? <span>{w.note || "Masalah teknis"}</span> : null}
              </p>
              {w.text && w.type !== 'spacing' && w.type !== 'formal' && (
                <p className="text-slate-500 mt-0.5">{w.text.slice(0, 120)}...</p>
              )}
              {w.note && <p className="text-slate-500 mt-0.5">{w.note}</p>}
            </div>
          </div>
        );
      })}
      {weaknesses.length > max && (
        <p className="text-xs text-slate-400">...dan {weaknesses.length - max} lainnya</p>
      )}
    </div>
  );
};

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

          <div className="mb-6 flex gap-2 rounded-2xl bg-blue-50 p-1 text-sm font-semibold text-blue-700 w-fit">
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 transition ${activeTab === "paste" ? "bg-blue-900 text-white" : "hover:bg-blue-100"}`}
              onClick={() => setActiveTab("paste")}
            >
              Analisis
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 transition ${activeTab === "url" ? "bg-blue-900 text-white" : "hover:bg-blue-100"}`}
              onClick={() => setActiveTab("url")}
            >
              URL
            </button>
          </div>

          {activeTab === "paste" && (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="rounded-3xl bg-blue-50 p-4 ring-1 ring-blue-200">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={12}
                    className="w-full rounded-3xl border border-blue-200 bg-white px-5 py-4 text-sm leading-6 text-blue-950 outline-none ring-blue-300 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Tempel artikel Anda di sini..."
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-blue-200">
                  <div className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                    Ringkasan
                  </div>
                  <div className="text-4xl font-semibold text-blue-950">
                    {words}
                  </div>
                  <div className="text-sm text-slate-500">
                    Jumlah kata
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
                  disabled={loading || !text.trim()}
                  className="inline-flex items-center justify-center rounded-3xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loading ? "Menganalisis..." : "Mulai Analisis"}
                </button>
              </div>
            </>
          )}

          {activeTab === "url" && (
            <>
              <div className="rounded-3xl bg-blue-50 p-4 ring-1 ring-blue-200">
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  type="url"
                  className="w-full rounded-3xl border border-blue-200 bg-white px-5 py-4 text-sm outline-none ring-blue-300 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Masukkan tautan artikel, misal manadopost.id/..."
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

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  AI akan mengekstrak konten dari URL dan menganalisisnya.
                </div>
                <button
                  type="button"
                  onClick={analyze}
                  disabled={loading || !url.trim()}
                  className="inline-flex items-center justify-center rounded-3xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loading ? "Menganalisis..." : "Analisis dari URL"}
                </button>
              </div>
            </>
          )}

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
                  className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blue-200 ${item.name.includes("Bahasa") || item.name.includes("Teknis") ? "ring-2" : ""}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-blue-700">{item.name}</p>
                    <span className="text-2xl font-semibold text-blue-950">{item.value}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                  
                  {(item.name === "Bahasa & Gaya" || item.name === "Pemeriksaan Teknis") && (
                    <WeaknessList weaknesses={item.weaknesses} />
                  )}
                </article>
              ))}
            </div>

            {result.details.some(d => d.weaknesses?.length > 0) && (
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-blue-950">
                    Titik Kelemahan Detail
                  </h3>
                  <WeaknessLegend />
                </div>
                <div className="mt-4 space-y-3">
                  {result.details.filter(d => d.weaknesses?.length > 0).map(d => (
                    <div key={d.name}>
                      <p className="text-sm font-semibold text-slate-700 mb-2">
                        {d.name} ({d.weaknesses.length} temuan)
                      </p>
                      <WeaknessList weaknesses={d.weaknesses} max={10} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
              <h3 className="text-xl font-semibold text-blue-950">
                Sorotan kalimat
              </h3>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
                {result.highlights && result.highlights.length > 0 ? (
                  result.highlights.map((item, idx) => (
                    <div
                      key={idx}
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
                  ))
                ) : (
                  <p className="text-slate-500">Tidak ada sorotan khusus.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
