import { useMemo, useState } from "react";

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

Banyak warga menilai perbaikan ini seharusnya sudah dilakukan sejak tahun lalu. Menurut sumber yang tidak disebutkan namanya, proyek ini rawan dikorupsi.

Proyek ini ditargetkan rampung sebelum akhir tahun 2026 dan akan diawasi langsung oleh inspektorat daerah. Beberapa pengamat kebijakan publik menyebut alokasi ini sudah tepat sasaran.`;

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

// Special component for spacing issues with boxed display (Option B)
const SpacingIssueBox = ({ issue }) => {
  const spaceDisplay = '·'.repeat(issue.spaceCount); // Show spaces as dots
  
  return (
    <div className="border-2 border-red-300 bg-red-50 rounded-xl p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-600 font-bold">{issue.note}</span>
      </div>
      
      {/* Main display box */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-sm">
        <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
            {issue.before}
          </span>
          <span className="px-2 py-0.5 bg-red-200 text-red-700 border border-red-400 rounded font-bold">
            {spaceDisplay}
          </span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
            {issue.after}
          </span>
        </div>
        
        {/* Pointer */}
        <div className="text-center text-red-500 text-lg mt-1">↑↑</div>
        
        {/* Context */}
        {issue.context && (
          <div className="text-xs text-slate-500 mt-2 border-t border-slate-200 pt-2">
            <span className="text-slate-400">Konteks:</span>
            <pre className="mt-1 whitespace-pre-wrap break-all font-sans text-slate-600">
              {issue.context}
            </pre>
          </div>
        )}
      </div>
      
      {issue.recommendation && (
        <p className="text-xs text-slate-500 mt-2 italic">
          💡 {issue.recommendation}
        </p>
      )}
    </div>
  );
};

// Special component for trailing whitespace issues
const TrailingIssueBox = ({ issue }) => {
  return (
    <div className="border-2 border-slate-300 bg-slate-50 rounded-xl p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-600 font-bold">{issue.note}</span>
        <span className="text-xs text-slate-500">Baris {issue.line}</span>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-sm">
        <div className="flex items-end">
          <span className="text-slate-400 break-all">{issue.lineContent}</span>
          <span className="text-red-400 flex-shrink-0">· · ·</span>
        </div>
        <div className="text-center text-slate-400 text-xs mt-1">↑ spasi di akhir baris</div>
      </div>
      
      {issue.recommendation && (
        <p className="text-xs text-slate-500 mt-2 italic">
          💡 {issue.recommendation}
        </p>
      )}
    </div>
  );
};

const WeaknessList = ({ weaknesses, max = 5 }) => {
  if (!weaknesses || weaknesses.length === 0) return null;
  const display = weaknesses.slice(0, max);
  
  return (
    <div className="mt-3 space-y-2">
      {display.map((w, i) => {
        const style = weaknessStyles[w.type] || weaknessStyles.passive;
        
        // Special rendering for spacing issues (Option B)
        if (w.type === 'spacing') {
          return (
            <div key={i} className="text-xs">
              <SpacingIssueBox issue={w} />
            </div>
          );
        }
        
        // Special rendering for trailing issues
        if (w.type === 'trailing') {
          return (
            <div key={i} className="text-xs">
              <TrailingIssueBox issue={w} />
            </div>
          );
        }
        
        // Standard rendering for other issues
        return (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${style.class}`}>
            <span className="mt-0.5">{style.icon}</span>
            <div>
              <p className="font-medium text-slate-700">
                {w.passiveWord && <span className="text-red-600 font-bold">"{w.passiveWord}"</span>}
                {w.wordCount && <span>Kalimat {w.wordCount} kata</span>}
                {w.count && <span>"{w.text}" {w.count}x</span>}
                {w.type === 'linebreak' || w.type === 'quotes' ? <span>{w.note || "Masalah teknis"}</span> : null}
              </p>
              {w.text && w.type !== 'formal' && (
                <p className="text-slate-500 mt-0.5">{w.text.slice(0, 120)}...</p>
              )}
              {w.recommendation && (
                <p className="text-slate-500 mt-0.5 italic">💡 {w.recommendation}</p>
              )}
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

// Verification Flag Styles
const flagStyles = {
  high: { icon: "🔴", label: "Prioritas Tinggi", class: "border-l-4 border-red-500 bg-red-50" },
  medium: { icon: "🟡", label: "Prioritas Sedang", class: "border-l-4 border-yellow-500 bg-yellow-50" },
  low: { icon: "🔵", label: "Prioritas Rendah", class: "border-l-4 border-blue-500 bg-blue-50" },
};

const VerificationFlagList = ({ flags }) => {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="space-y-3">
      {flags.map((flag, idx) => {
        const style = flagStyles[flag.priority] || flagStyles.medium;
        return (
          <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl text-sm ${style.class}`}>
            <span className="mt-0.5 text-lg">{style.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">{style.label}</span>
              </div>
              <p className="mt-1 text-slate-600">
                {flag.text && <span>"{flag.text}" </span>}
                {flag.attributedTo && <span>- {flag.attributedTo}</span>}
                {flag.context && !flag.text && <span>{flag.context.slice(0, 100)}</span>}
                {flag.keyword && <span className="text-red-600 font-semibold">"{flag.keyword}"</span>}
                {flag.subject && <span>{flag.subject}</span>}
              </p>
              {flag.recommendation && (
                <p className="mt-1 text-xs text-slate-500 italic">
                  💡 {flag.recommendation}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <span>Sudah diverifikasi</span>
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function App() {
  const [text, setText] = useState(sampleArticle);
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState("paste");
  const [mode, setMode] = useState("hybrid");
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
          mode: mode,
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

  const modeOptions = [
    { id: 'local', name: 'Lokal (Gratis)', desc: '~70% akurat, tanpa API' },
    { id: 'hybrid', name: 'Hybrid (Disarankan)', desc: '~85% akurat, hemat biaya' },
    { id: 'llm', name: 'LLM Penuh', desc: '~95% akurat, biaya lebih tinggi' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50 text-blue-950">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 lg:px-10">
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

          {/* Mode Selector */}
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mode Analisis
            </label>
            <div className="flex flex-wrap gap-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    mode === opt.id
                      ? "bg-blue-900 text-white"
                      : "bg-white text-slate-600 hover:bg-blue-50 border border-slate-200"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {modeOptions.find(m => m.id === mode)?.desc}
              {mode !== 'local' && (
                <span className="ml-2 text-amber-600">
                  ⚠️ Butuh API key Olagon
                </span>
              )}
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
                <p className="mt-3 text-sm text-slate-500">
                  Tempel URL artikel dari website mana pun untuk dianalisis.
                </p>
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
            {/* Result Header */}
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                      Hasil Analisis
                    </p>
                    {result.skippedLLM && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                        Mode Lokal
                      </span>
                    )}
                    {result.fromCache && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                        Cache
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold text-blue-950">
                    Skor artikel: {result.overallScore}
                  </h2>
                  {result.sourceDomain && (
                    <p className="mt-1 text-sm text-slate-500">
                      Sumber: {result.sourceDomain}
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

            {/* Verification Flags Section */}
            {result.verificationFlags && result.verificationFlags.length > 0 && (
              <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-sm ring-2 ring-amber-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-amber-800">
                      ⚠️ Perlu Verifikasi Manual
                    </h3>
                    <p className="text-sm text-amber-600 mt-1">
                      {result.verificationFlags.length} item memerlukan perhatian sebelum publish
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-amber-200 text-amber-800 text-sm font-semibold rounded-full">
                    {result.verificationFlags.length} item
                  </span>
                </div>
                <VerificationFlagList flags={result.verificationFlags} />
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <button className="text-sm text-amber-700 hover:text-amber-900 font-medium">
                    📋 Tandai Semua Terverifikasi
                  </button>
                </div>
              </div>
            )}

            {/* Score Cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.details.map((item) => (
                <article
                  key={item.name}
                  className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blue-200 ${
                    item.name.includes("Bahasa") || item.name.includes("Teknis") 
                      ? "ring-2 ring-blue-300" 
                      : item.name.includes("Mesin-Baca") 
                        ? "ring-2 ring-purple-300" 
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-blue-700">{item.name}</p>
                    <span className={`text-2xl font-semibold ${
                      parseInt(item.value) >= 80 
                        ? "text-emerald-600" 
                        : parseInt(item.value) >= 60 
                          ? "text-blue-600" 
                          : parseInt(item.value) >= 50 
                            ? "text-amber-600" 
                            : "text-red-600"
                    }`}>
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                  
                  {(item.name === "Bahasa & Gaya" || item.name === "Pemeriksaan Teknis") && (
                    <WeaknessList weaknesses={item.weaknesses} />
                  )}
                </article>
              ))}
            </div>

            {/* Weaknesses Section */}
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

            {/* Highlights Section */}
            {result.highlights && result.highlights.length > 0 && (
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-200">
                <h3 className="text-xl font-semibold text-blue-950">
                  Sorotan Kalimat
                </h3>
                <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
                  {result.highlights.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-3xl border p-4 ${
                        item.type === "bad" 
                          ? "border-rose-200 bg-rose-50" 
                          : item.type === "warn" 
                            ? "border-amber-200 bg-amber-50" 
                            : "border-emerald-200 bg-emerald-50"
                      }`}
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
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
