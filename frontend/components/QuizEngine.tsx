"use client";

import React, { useState, useCallback, useEffect } from "react";

interface QuizQuestion {
  question: string;
  type: "mcq" | "true_false";
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface QuizLevel {
  title: string;
  questions: QuizQuestion[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://pdf-study-api.onrender.com";
const START_HEARTS = 5;
const XP_PER_CORRECT = 15;

export default function QuizEngine({ documentId }: { documentId: string }) {
  const [levels, setLevels] = useState<QuizLevel[]>([]);
  const [flatQuestions, setFlatQuestions] = useState<QuizQuestion[]>([]);
  const [isLevelMode, setIsLevelMode] = useState(false);
  const [levelIndex, setLevelIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hearts, setHearts] = useState(START_HEARTS);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchQuiz = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/quiz`, { method: "POST" });
      const data = await res.json();
      if (data.levels && data.levels.length > 0) {
        setLevels(data.levels);
        setIsLevelMode(true);
        setLevelIndex(0);
        setQuestionIndex(0);
      } else if (data.questions && data.questions.length > 0) {
        setFlatQuestions(data.questions);
        setIsLevelMode(false);
        setQuestionIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, retryCount]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const retry = useCallback(() => {
    setHearts(START_HEARTS);
    setXp(0);
    setStreak(0);
    setGameOver(false);
    setLoading(true);
    setRetryCount((c) => c + 1);
  }, []);

  const currentLevel = isLevelMode && levelIndex < levels.length ? levels[levelIndex] : null;
  const currentQuestion = currentLevel
    ? (currentLevel.questions[questionIndex] || null)
    : (flatQuestions[questionIndex] || null);

  const totalQuestions = isLevelMode
    ? levels.reduce((acc, l) => acc + l.questions.length, 0)
    : flatQuestions.length;

  const currentQuestionNumber = isLevelMode
    ? levels.slice(0, levelIndex).reduce((acc, l) => acc + l.questions.length, 0) + questionIndex + 1
    : questionIndex + 1;

  const isLastLevel = isLevelMode && levelIndex >= levels.length - 1;
  const isLastQuestionInLevel = currentLevel && questionIndex >= currentLevel.questions.length - 1;
  const isLastQuestion = isLevelMode
    ? (isLastLevel && questionIndex >= currentLevel.questions.length - 1)
    : (questionIndex >= flatQuestions.length - 1);

  const advance = useCallback(() => {
    if (isLevelMode && currentLevel) {
      if (questionIndex < currentLevel.questions.length - 1) {
        setQuestionIndex((q) => q + 1);
      } else if (levelIndex < levels.length - 1) {
        setLevelIndex((l) => l + 1);
        setQuestionIndex(0);
      } else {
        setGameOver(true);
      }
    } else {
      if (questionIndex < flatQuestions.length - 1) {
        setQuestionIndex((q) => q + 1);
      } else {
        setGameOver(true);
      }
    }
  }, [isLevelMode, currentLevel, questionIndex, levelIndex, levels.length, flatQuestions.length]);

  const submit = useCallback(
    (answer: string) => {
      if (!currentQuestion || flash) return;
      setSelected(answer);
      const correct = answer === currentQuestion.correct_answer;
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
        advance();
      }, 900);
    },
    [currentQuestion, flash, advance]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentQuestion || flash || gameOver) return;
      const opts = currentQuestion.options.length ? currentQuestion.options : [];
      if (e.key >= "1" && e.key <= "4") {
        const i = parseInt(e.key) - 1;
        if (opts[i]) submit(opts[i]);
      }
      if (e.key === "Enter" && selected) submit(selected);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentQuestion, flash, gameOver, selected, submit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex items-center justify-center font-mono text-xs tracking-widest">
        LOADING QUIZ...
      </div>
    );
  }

  if (gameOver && hearts <= 0) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex flex-col items-center justify-center">
        <h1 className="text-5xl font-light uppercase tracking-tight">Game Over</h1>
        <p className="mt-4 font-mono text-sm text-[#888]">XP EARNED: {xp}</p>
        <button
          onClick={retry}
          className={[
            "mt-6 rounded bg-[#1F2937] px-6 py-3 text-sm font-medium text-white hover:bg-[#27354A] transition-colors",
          ].join(" ")}
        >
          Retry
        </button>
      </div>
    );
  }

  if (gameOver && hearts > 0) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex flex-col items-center justify-center">
        <h1 className="text-5xl font-light uppercase tracking-tight">Complete</h1>
        <p className="mt-4 font-mono text-sm text-[#888]">XP EARNED: {xp} // STREAK: {streak}</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] flex items-center justify-center font-mono text-xs tracking-widest">
        NO QUESTIONS AVAILABLE
      </div>
    );
  }

  const opts = currentQuestion.options.length ? currentQuestion.options : [];

  return (
    <main className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] font-sans px-8 py-12 flex flex-col">
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between mb-8 text-xs font-mono tracking-widest">
        <div className="text-[#888]">
          {isLevelMode ? (
            <>
              LEVEL {levelIndex + 1} / {levels.length} // {currentLevel?.title}
            </>
          ) : (
            <>Q {currentQuestionNumber} / {totalQuestions}</>
          )}
        </div>
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
            {isLevelMode && (
              <div className="text-[#0F5132] mb-2">
                {currentLevel?.title}
              </div>
            )}
            {currentQuestion.type.replace("_", " ")}
          </div>
          <h2 className="text-2xl font-light tracking-tight text-white leading-snug">
            {currentQuestion.question}
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
        </div>

        {flash && (
          <div className="mt-6 font-mono text-xs tracking-widest">
            {flash === "correct" ? (
              <span className="text-[#0F5132]">CORRECT // +{XP_PER_CORRECT} XP</span>
            ) : (
              <span className="text-[#E8A0A0]">INCORRECT // {currentQuestion.explanation}</span>
            )}
          </div>
        )}
      </section>
    </main>
  );
}