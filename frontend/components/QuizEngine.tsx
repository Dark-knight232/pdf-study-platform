"use client";

import React, { useState, useCallback, useEffect } from "react";

interface QuizQuestion {
  question: string;
  type: "mcq" | "true_false" | "fill_blank";
  options: string[];
  correct_answer: string;
  explanation: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://pdf-study-api.onrender.com";
const START_HEARTS = 5;
const XP_PER_CORRECT = 15;

export default function QuizEngine({ documentId }: { documentId: string }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hearts, setHearts] = useState(START_HEARTS);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/quiz`, { method: "POST" });
        const data = await res.json();
        setQuestions(data.questions || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [documentId]);

  const current = questions[index];

  const submit = useCallback(
    (answer: string) => {
      if (!current || flash) return;
      setSelected(answer);
      const correct = answer === current.correct_answer;
      if (correct) {
        setFlash("correct");
        setXp((x) => x + XP_PER_CORRECT);
        setStreak((s) => s + 1);
      } else {
        setFlash("wrong");
        setHearts((h) => {
          const nh = h - 1;
          if (nh <= 0) setGameOver(true);
          return Math.max(0, nh);
        });
        setStreak(0);
      }
      setTimeout(() => {
        setFlash(null);
        setSelected(null);
        setIndex((i) => i + 1);
      }, 900);
    },
    [current, flash]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current || flash || gameOver) return;
      const opts = current.options.length ? current.options : [];
      if (e.key >= "1" && e.key <= "4") {
        const i = parseInt(e.key) - 1;
        if (opts[i]) submit(opts[i]);
      }
      if (e.key === "Enter" && selected) submit(selected);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, flash, gameOver, selected, submit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex items-center justify-center font-mono text-xs tracking-widest">
        LOADING QUIZ...
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex flex-col items-center justify-center">
        <h1 className="text-5xl font-light uppercase tracking-tight">Game Over</h1>
        <p className="mt-4 font-mono text-sm text-[#888]">XP EARNED: {xp}</p>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex flex-col items-center justify-center">
        <h1 className="text-5xl font-light uppercase tracking-tight">Complete</h1>
        <p className="mt-4 font-mono text-sm text-[#888]">XP EARNED: {xp} // STREAK: {streak}</p>
      </div>
    );
  }

  const opts = current.options.length ? current.options : [];

  return (
    <main className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] font-sans px-8 py-12 flex flex-col">
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between mb-8 text-xs font-mono tracking-widest">
        <div className="text-[#888]">Q {index + 1} / {questions.length}</div>
        <div className="text-[#0F5132]">XP {xp}</div>
        <div className="text-[#E6E8EA]">{"♥".repeat(hearts)}{"♡".repeat(START_HEARTS - hearts)}</div>
      </header>

      <section className="max-w-3xl mx-auto w-full flex-1">
        <div
          className={[
            "border border-[#22292D] bg-[#121618] p-10 transition-colors",
            flash === "correct" ? "border-[#0F5132]" : "",
            flash === "wrong" ? "border-[#7A1F1F] bg-[#1A0F10]" : "",
          ].join(" ")}
        >
          <div className="text-[10px] font-mono tracking-widest text-[#6B7280] uppercase mb-4">
            {current.type.replace("_", " ")}
          </div>
          <h2 className="text-2xl font-light tracking-tight text-white leading-snug">
            {current.question}
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          {opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => submit(opt)}
              disabled={!!flash}
              className={[
                "border border-[#22292D] bg-[#121618] px-6 py-4 text-left text-sm font-mono tracking-wide",
                "hover:border-[#3A4248] active:translate-y-[0.5px] transition-all",
                selected === opt ? "border-[#0F5132]" : "",
              ].join(" ")}
            >
              <span className="text-[#6B7280] mr-3">[{i + 1}]</span>
              {opt}
            </button>
          ))}
          {current.type === "fill_blank" && (
            <input
              className="border border-[#22292D] bg-[#121618] px-6 py-4 text-sm font-mono text-white outline-none focus:border-[#0F5132]"
              placeholder="Type answer and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit((e.target as HTMLInputElement).value);
              }}
            />
          )}
        </div>

        {flash && (
          <div className="mt-6 font-mono text-xs tracking-widest">
            {flash === "correct" ? (
              <span className="text-[#0F5132]">CORRECT // +{XP_PER_CORRECT} XP</span>
            ) : (
              <span className="text-[#E8A0A0]">INCORRECT // {current.explanation}</span>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
