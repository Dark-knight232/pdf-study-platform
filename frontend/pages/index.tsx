"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import MontfortIngestionDropzone from "../components/MontfortIngestionDropzone";
import QuizEngine from "../components/QuizEngine";

const API_BASE = "https://pdf-study-api.onrender.com";

interface RoadmapModule {
  id: string;
  title: string;
  description: string;
  source_pages: number[];
}

interface SummaryData {
  executive_overview: string;
  chapter_breakdown: string;
  flashcards: { term: string; definition: string }[];
}

const FEATURES = [
  {
    num: "01",
    title: "Ingestion",
    body: "Structural validation runs entirely in your browser. Every PDF is checked for page count and payload size before a single byte is transmitted.",
  },
  {
    num: "02",
    title: "Synthesis",
    body: "Your document is distilled into a learning roadmap, an executive summary, and flashcards — a complete study companion in seconds.",
  },
  {
    num: "03",
    title: "Ascension",
    body: "Prove mastery through gamified quiz levels. Earn XP, build streaks, and protect your hearts as you ascend every module.",
  },
];

export default function Home() {
  const [docId, setDocId] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapModule[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const skyRef = useRef<HTMLDivElement>(null);
  const mtnRef = useRef<HTMLDivElement>(null);
  const forestRef = useRef<HTMLDivElement>(null);

  const handleDocumentComplete = (id: string) => {
    setDocId(id);
  };

  useEffect(() => {
    if (!docId) {
      setRoadmap([]);
      setSummary(null);
      return;
    }
    const load = async () => {
      setRoadmapLoading(true);
      setSummaryLoading(true);
      try {
        const [rRes, sRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/documents/${docId}/roadmap`, { method: "POST" }),
          fetch(`${API_BASE}/api/v1/documents/${docId}/summary`, { method: "POST" }),
        ]);
        const rData = await rRes.json();
        const sData = await sRes.json();
        setRoadmap(rData.modules || []);
        setSummary(sData);
      } catch (e) {
        console.error("Failed to load roadmap/summary", e);
      } finally {
        setRoadmapLoading(false);
        setSummaryLoading(false);
      }
    };
    load();
  }, [docId]);

  // Three-layer parallax background: sky -> mountain -> forest, driven by scroll.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.max(0, Math.min(1, y / max)) : 0;

      const skyO = Math.max(0, 1 - p * 2.5);
      const mtnO = Math.max(
        0,
        Math.min(1, (p - 0.1) * 5) * Math.max(0, Math.min(1, (0.8 - p) * 3))
      );
      const forestO = Math.max(0, Math.min(1, (p - 0.45) * 3));

      const layers = [
        { ref: skyRef, opacity: skyO, posPct: p * 50 },        // 0->50% pan across first half of scroll
        { ref: mtnRef, opacity: mtnO, posPct: p * 100 },        // full-image pan throughout
        {
          ref: forestRef,
          opacity: forestO,
          posPct: Math.max(0, Math.min(1, (p - 0.5) * 2)) * 100, // starts panning after 50% scroll
        },
      ];

      // Highest opacity layer paints on top (correct crossfade layering)
      layers.sort((a, b) => b.opacity - a.opacity);
      layers.forEach((l, i) => {
        const el = l.ref.current;
        if (el) {
          el.style.opacity = l.opacity.toFixed(3);
          el.style.backgroundPosition = `center ${l.posPct.toFixed(2)}%`;
          el.style.zIndex = (2 - i).toString();
        }
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0D0E] text-white relative">
      {/* ===== LAYER 1 // SKY ===== */}
      <div
        ref={skyRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/sky.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 0%",
        }}
      />
      {/* ===== LAYER 2 // MOUNTAIN ===== */}
      <div
        ref={mtnRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/montfort-bg.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 0%",
          opacity: 0,
        }}
      />
      {/* ===== LAYER 3 // FOREST ===== */}
      <div
        ref={forestRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/forest.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 0%",
          opacity: 0,
        }}
      />

      {/* Readability + royal tint overlays (above images, below content) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,13,14,0.66) 0%, rgba(11,13,14,0.42) 25%, rgba(11,13,14,0.52) 65%, rgba(11,13,14,0.82) 100%)",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(15,81,50,0.10) 0%, transparent 70%)",
        }}
      />

      {/* ================= SECTION 1 // THE TITLE ================= */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <div className="absolute left-[18%] top-[38%] hidden md:block">
          <div className="w-16 h-16 rounded-full border border-[#C6A15B]/60" />
        </div>

        <span className="text-[11px] font-mono tracking-[0.35em] uppercase text-[#C6A15B] mb-10">
          Est. 2026 // Knowledge Engine
        </span>

        <h1 className="text-6xl sm:text-8xl lg:text-9xl font-light tracking-tight text-white leading-[1.02] uppercase">
          Grand<br />
          <span className="italic font-serif text-[#C6A15B]">Master</span> Suite
        </h1>

        <p className="mt-10 text-sm md:text-base text-white max-w-xl font-normal leading-relaxed">
          A royal knowledge engine that transforms raw PDFs into structured
          roadmaps, executive summaries, and ascension trials.
        </p>

        <div className="absolute bottom-12 flex flex-col items-center gap-3 text-[#C6A15B]">
          <span className="text-[10px] font-mono tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-[#C6A15B] to-transparent" />
        </div>
      </section>

      {/* ================= SECTION 2 // WHAT IT DOES ================= */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-32">
        <span className="text-[11px] font-mono tracking-[0.35em] uppercase text-[#C6A15B] block mb-6">
          02 // Purpose
        </span>
        <h2 className="text-4xl md:text-6xl font-light tracking-tight text-white uppercase leading-[1.05] mb-6">
          Engineered <span className="italic font-serif text-[#C6A15B]">for Mastery.</span>
        </h2>
        <p className="text-sm text-white max-w-2xl leading-relaxed mb-16">
          Three disciplines, one instrument. Every stage of your document is
          refined, stored, and transported with integrity.
        </p>

        <div className="grid gap-px bg-[#22292D] md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.num}
              className="bg-[#0B0D0E]/80 backdrop-blur-sm p-8 md:p-10 flex flex-col"
            >
              <div className="text-xs font-mono tracking-widest text-[#C6A15B] mb-6">
                {f.num}
              </div>
              <h3 className="text-2xl font-light tracking-tight text-white uppercase mb-4">
                {f.title}
              </h3>
              <p className="text-sm text-white leading-relaxed">{f.body}</p>
              <div className="mt-8 pt-6 border-t border-[#22292D]">
                <div className="w-8 h-px bg-[#0F5132]" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= SECTION 3 // THE INSTRUMENT ================= */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-32">
        <span className="text-[11px] font-mono tracking-[0.35em] uppercase text-[#C6A15B] block mb-6">
          03 // The Instrument
        </span>
        <h2 className="text-4xl md:text-6xl font-light tracking-tight text-white uppercase leading-[1.05] mb-6">
          Begin Your <span className="italic font-serif text-[#C6A15B]">Ascent.</span>
        </h2>
        <p className="text-sm text-white max-w-2xl leading-relaxed mb-16">
          Upload your source PDF. The pipeline executes client-side validation,
          high-density extraction, and multi-tier knowledge synthesis before
          tokenization.
        </p>

        <MontfortIngestionDropzone onDocumentComplete={handleDocumentComplete} />

        {docId && (
          <>
            {/* ROADMAP */}
            <div className="mt-24">
              <header className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl md:text-3xl font-light tracking-tight uppercase">
                  Learning <span className="italic font-serif text-[#C6A15B]">Roadmap</span>
                </h3>
                {roadmapLoading && <span className="text-xs font-mono text-white">LOADING...</span>}
              </header>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roadmap.map((m) => (
                  <article key={m.id} className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-[#C6A15B] uppercase mb-2">
                      {m.id}
                    </div>
                    <h4 className="text-xl font-light text-white mb-2">{m.title}</h4>
                    <p className="text-sm text-white mb-4">{m.description}</p>
                    <div className="text-xs font-mono text-white">
                      Source pages: {m.source_pages?.join(", ") || "—"}
                    </div>
                  </article>
                ))}
                {roadmap.length === 0 && !roadmapLoading && (
                  <p className="text-sm text-white col-span-full">No modules generated.</p>
                )}
              </div>
            </div>

            {/* SUMMARY */}
            <div className="mt-24">
              <header className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl md:text-3xl font-light tracking-tight uppercase">
                  Executive <span className="italic font-serif text-[#C6A15B]">Summary</span>
                </h3>
                {summaryLoading && <span className="text-xs font-mono text-white">LOADING...</span>}
              </header>
              {summary ? (
                <div className="space-y-8">
                  <div className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-white uppercase mb-3">
                      Overview
                    </div>
                    <p className="text-base leading-relaxed text-white">{summary.executive_overview || "—"}</p>
                  </div>
                  <div className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-white uppercase mb-3">
                      Chapter Breakdown
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-white font-mono">
                      {summary.chapter_breakdown || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono tracking-widest text-white uppercase mb-3">
                      Flashcards
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {summary.flashcards?.map((fc, i) => (
                        <article key={i} className="border border-[#22292D] bg-[#121618]/90 p-4">
                          <div className="font-mono text-sm text-white mb-1">{fc.term}</div>
                          <div className="text-sm text-white">{fc.definition}</div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white">Generating summary...</p>
              )}
            </div>

            {/* QUIZ */}
            <div className="mt-24">
              <QuizEngine documentId={docId} />
            </div>
          </>
        )}
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-[#22292D] mt-16">
        <div className="max-w-7xl mx-auto px-8 py-10 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] tracking-widest uppercase text-white">
          <span>GrandMaster Suite // Knowledge Engine</span>
          <span className="text-[#C6A15B]">Est. 2026</span>
          <span>Secure Parsing Pipeline</span>
        </div>
      </footer>
    </div>
  );
}