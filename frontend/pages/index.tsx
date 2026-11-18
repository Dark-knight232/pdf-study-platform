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
    <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] relative overflow-hidden">
      {/* PARALLAX BACKGROUND IMAGE (GrandMaster Mountain) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/montfort-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          transform: `translateY(${scrollY * 0.3}px)`,
          opacity: 0.12,
          filter: "blur(0.5px)",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#0B0D0E]/60 to-[#0B0D0E]/95"
      />

      <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
        <MontfortIngestionDropzone onDocumentComplete={handleDocumentComplete} />

        {docId && (
          <>
            {/* ROADMAP */}
            <section className="mt-16 relative z-10">
              <header className="mb-8 flex items-center justify-between">
                <h2 className="text-3xl font-light tracking-tight uppercase">
                  Learning <span className="italic font-serif text-[#999]">Roadmap</span>
                </h2>
                {roadmapLoading && <span className="text-xs font-mono text-[#666]">LOADING...</span>}
              </header>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roadmap.map((m, i) => (
                  <article key={m.id} className="border border-[#22292D] bg-[#121618] p-6">
                    <div className="text-xs font-mono tracking-widest text-[#666] uppercase mb-2">
                      {m.id}
                    </div>
                    <h3 className="text-xl font-light text-white mb-2">{m.title}</h3>
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
            </section>

            {/* SUMMARY */}
            <section className="mt-16 relative z-10">
              <header className="mb-8 flex items-center justify-between">
                <h2 className="text-3xl font-light tracking-tight uppercase">
                  Executive <span className="italic font-serif text-[#999]">Summary</span>
                </h2>
                {summaryLoading && <span className="text-xs font-mono text-[#666]">LOADING...</span>}
              </header>
              {summary ? (
                <div className="space-y-8">
                  <div className="border border-[#22292D] bg-[#121618] p-6">
                    <div className="text-xs font-mono tracking-widest text-[#666] uppercase mb-3">
                      Overview
                    </div>
                    <p className="text-base leading-relaxed text-white">{summary.executive_overview || "—"}</p>
                  </div>
                  <div className="border border-[#22292D] bg-[#121618] p-6">
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
                        <article key={i} className="border border-[#22292D] bg-[#121618] p-4">
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
            </section>

            {/* QUIZ */}
            <section className="mt-16 relative z-10">
              <QuizEngine documentId={docId} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}