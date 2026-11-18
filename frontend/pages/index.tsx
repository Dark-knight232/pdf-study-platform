import MontfortIngestionDropzone from "../components/MontfortIngestionDropzone";
import QuizEngine from "../components/QuizEngine";
import { useState } from "react";

export default function Home() {
  const [docId, setDocId] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-[#080808] text-[#E6E6E6]">
      <div className="max-w-7xl mx-auto px-8 py-12">
        <MontfortIngestionDropzone />
        {docId && (
          <div className="mt-12">
            <QuizEngine documentId={docId} />
          </div>
        )}
      </div>
    </div>
  );
}