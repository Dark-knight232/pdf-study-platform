"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    setScrollY(window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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

  return (
    <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] relative">
      {/* ROYAL PARALLAX BACKGROUND — fixed, never runs out, drifts on scroll */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/montfort-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: `center ${scrollY * 0.35}px`,
          opacity: 0.6,
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,13,14,0.55) 0%, rgba(11,13,14,0.25) 30%, rgba(11,13,14,0.35) 60%, rgba(11,13,14,0.85) 100%)",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(15,81,50,0.18) 0%, transparent 70%)",
        }}
      />

      {/* ================= SECTION 1 // THE TITLE ================= */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8 text-center">
        {/* gold circle ornament */}
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

        <p className="mt-10 text-sm md:text-base text-[#B8BEC2] max-w-xl font-normal leading-relaxed">
          A royal knowledge engine that transforms raw PDFs into structured
          roadmaps, executive summaries, and ascension trials.
        </p>

        {/* scroll indicator */}
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
        <p className="text-sm text-[#9AA1A6] max-w-2xl leading-relaxed mb-16">
          Three disciplines, one instrument. Every stage of your document is
          refined, stored, and transported with integrity.
        </p>

        <div className="grid gap-px bg-[#22292D] md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.num}
              className="bg-[#0B0D0E]/85 backdrop-blur-sm p-8 md:p-10 flex flex-col"
            >
              <div className="text-xs font-mono tracking-widest text-[#C6A15B] mb-6">
                {f.num}
              </div>
              <h3 className="text-2xl font-light tracking-tight text-white uppercase mb-4">
                {f.title}
              </h3>
              <p className="text-sm text-[#9AA1A6] leading-relaxed">{f.body}</p>
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
        <p className="text-sm text-[#9AA1A6] max-w-2xl leading-relaxed mb-16">
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
                {roadmapLoading && <span className="text-xs font-mono text-[#666]">LOADING...</span>}
              </header>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roadmap.map((m, i) => (
                  <article key={m.id} className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-[#C6A15B] uppercase mb-2">
                      {m.id}
                    </div>
                    <h4 className="text-xl font-light text-white mb-2">{m.title}</h4>
                    <p className="text-sm text-[#888] mb-4">{m.description}</p>
                    <div className="text-xs font-mono text-[#0F5132]">
                      Source pages: {m.source_pages?.join(", ") || "—"}
                    </div>
                  </article>
                ))}
                {roadmap.length === 0 && !roadmapLoading && (
                  <p className="text-sm text-[#888] col-span-full">No modules generated.</p>
                )}
              </div>
            </div>

            {/* SUMMARY */}
            <div className="mt-24">
              <header className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl md:text-3xl font-light tracking-tight uppercase">
                  Executive <span className="italic font-serif text-[#C6A15B]">Summary</span>
                </h3>
                {summaryLoading && <span className="text-xs font-mono text-[#666]">LOADING...</span>}
              </header>
              {summary ? (
                <div className="space-y-8">
                  <div className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-[#666] uppercase mb-3">
                      Overview
                    </div>
                    <p className="text-base leading-relaxed text-white">{summary.executive_overview || "—"}</p>
                  </div>
                  <div className="border border-[#22292D] bg-[#121618]/90 p-6">
                    <div className="text-xs font-mono tracking-widest text-[#666] uppercase mb-3">
                      Chapter Breakdown
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#CCC] font-mono">
                      {summary.chapter_breakdown || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono tracking-widest text-[#666] uppercase mb-3">
                      Flashcards
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {summary.flashcards?.map((fc, i) => (
                        <article key={i} className="border border-[#22292D] bg-[#121618]/90 p-4">
                          <div className="font-mono text-sm text-[#0F5132] mb-1">{fc.term}</div>
                          <div className="text-sm text-[#CCC]">{fc.definition}</div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#888]">Generating summary...</p>
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
        <div className="max-w-7xl mx-auto px-8 py-10 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] tracking-widest uppercase text-[#666]">
          <span>GrandMaster Suite // Knowledge Engine</span>
          <span className="text-[#C6A15B]">Est. 2026</span>
          <span>Secure Parsing Pipeline</span>
        </div>
      </footer>
    </div>
  );
}