"use client";

import React, { useCallback, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 20;
const POLL_INTERVAL_MS = 2000;

type UploadStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

interface DocumentStatusResponse {
  status: string;
  progress?: number;
  stage?: string;
  error?: string;
}

interface UploadResponse {
  job_id: string;
  document_id: string;
}

interface LogEntry {
  id: number;
  text: string;
}

const LOG_SEQUENCE: string[] = [
  "[01] INGESTING_STREAM...",
  "[02] PARSING_NATIVE_LAYERS...",
  "[03] EXECUTING_OCR_FALLBACK...",
  "[04] INDEXING_COMPLETE",
];

const PdfIngestionDropzone: React.FC = () => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIndexRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setFile(null);
    setPageCount(null);
    setErrorMessage(null);
    setProgress(0);
    setLogs([]);
    setDocumentId(null);
    logIndexRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [stopPolling]);

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, { id: prev.length + 1, text }]);
  }, []);

  const validateFile = useCallback(
    async (selected: File): Promise<{ valid: boolean; pages?: number }> => {
      if (selected.type !== "application/pdf") {
        setErrorMessage("ERROR // INVALID_MIME_TYPE [EXPECTED: application/pdf]");
        return { valid: false };
      }
      if (selected.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(
          `ERROR // EXCEEDS_SIZE_LIMIT [DETECTED: ${(selected.size / (1024 * 1024)).toFixed(2)}MB / MAX: 15MB]`
        );
        return { valid: false };
      }
      try {
        const arrayBuffer = await selected.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPageCount();
        if (pages > MAX_PAGES) {
          setErrorMessage(`ERROR // EXCEEDS 20-PAGE LIMIT [DETECTED: ${pages} PAGES]`);
          return { valid: false, pages };
        }
        setPageCount(pages);
        return { valid: true, pages };
      } catch {
        setErrorMessage("ERROR // UNREADABLE_PDF [CORRUPT_OR_ENCRYPTED]");
        return { valid: false };
      }
    },
    []
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const selected = files[0];
      setErrorMessage(null);
      setStatus("validating");
      const result = await validateFile(selected);
      if (!result.valid) {
        setStatus("error");
        setFile(null);
        return;
      }
      setFile(selected);
      setStatus("idle");
    },
    [validateFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const startPolling = useCallback(
    (docId: string) => {
      logIndexRef.current = 0;
      setLogs([]);
      appendLog(LOG_SEQUENCE[0]);
      logIndexRef.current = 1;

      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/documents/${docId}/status`);
          if (!res.ok) throw new Error(`STATUS_${res.status}`);
          const data: DocumentStatusResponse = await res.json();

          if (typeof data.progress === "number") {
            setProgress(Math.min(100, Math.max(0, data.progress)));
          }

          if (logIndexRef.current < LOG_SEQUENCE.length && data.stage) {
            const nextLog = LOG_SEQUENCE[logIndexRef.current];
            if (nextLog) {
              appendLog(nextLog);
              logIndexRef.current += 1;
            }
          }

          const normalized = (data.status || "").toLowerCase();
          if (normalized === "complete" || normalized === "completed" || normalized === "done") {
            setStatus("complete");
            setProgress(100);
            if (logIndexRef.current < LOG_SEQUENCE.length) {
              appendLog(LOG_SEQUENCE[LOG_SEQUENCE.length - 1]);
              logIndexRef.current = LOG_SEQUENCE.length;
            }
            stopPolling();
          } else if (normalized === "error" || normalized === "failed") {
            setStatus("error");
            setErrorMessage(data.error || "ERROR // PROCESSING_FAILED");
            stopPolling();
          }
        } catch {
          setStatus("error");
          setErrorMessage("ERROR // STATUS_POLL_FAILED");
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [appendLog, stopPolling]
  );

  const upload = useCallback(async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setLogs([]);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`UPLOAD_${res.status}`);
      }

      const data: UploadResponse = await res.json();
      setDocumentId(data.document_id);
      setStatus("processing");
      startPolling(data.document_id);
    } catch {
      setStatus("error");
      setErrorMessage("ERROR // UPLOAD_FAILED");
    }
  }, [file, startPolling]);

  const statusLabel: Record<UploadStatus, string> = {
    idle: "READY",
    validating: "VALIDATING",
    uploading: "UPLOADING",
    processing: "PROCESSING",
    complete: "COMPLETE",
    error: "ERROR",
  };

  return (
    <div className="min-h-screen bg-[#0B0D0E] text-[#E6E8EA] font-sans">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <header className="mb-16 border-b border-[#22292D] pb-8">
          <div className="text-[11px] tracking-[0.3em] text-[#6B7280] font-mono uppercase mb-4">
            PHASE 01 // DOCUMENT INGESTION
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-[1.05] text-[#F2F4F5]">
            PDF Ingestion &amp; Validation
          </h1>
          <p className="mt-4 text-sm text-[#8A9199] max-w-2xl leading-relaxed">
            Upload a single PDF for extraction, validation, and indexing. Client-side
            pre-validation enforces format, size, and page constraints before any
            data leaves the browser.
          </p>
        </header>

        <section
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={onBrowseClick}
          className={[
            "relative border border-dashed transition-colors duration-200 cursor-pointer",
            isDragging
              ? "border-[#0F5132] bg-[#121618]"
              : "border-[#22292D] bg-[#121618]/60 hover:border-[#3A4248]",
            "p-16 flex flex-col items-center justify-center text-center min-h-[280px]",
          ].join(" ")}
        >
          <div className="text-[11px] font-mono tracking-[0.3em] text-[#6B7280] uppercase mb-6">
            DROPZONE // SINGLE PDF
          </div>
          <div className="text-2xl font-medium tracking-tight text-[#F2F4F5] mb-3">
            Drag &amp; drop a PDF, or click to browse
          </div>
          <div className="text-xs font-mono text-[#6B7280] tracking-wider">
            MIME: application/pdf &nbsp;|&nbsp; MAX: 15 MB &nbsp;|&nbsp; PAGES: &le; 20
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onFileInputChange}
          />
        </section>

        {errorMessage && (
          <div className="mt-6 border border-[#7A1F1F] bg-[#1A0F10] px-5 py-4">
            <div className="font-mono text-sm tracking-wide text-[#E8A0A0]">
              {errorMessage}
            </div>
          </div>
        )}

        {file && (
          <section className="mt-10 border border-[#22292D] bg-[#121618]">
            <div className="px-6 py-4 border-b border-[#22292D] flex items-center justify-between">
              <div className="text-[11px] font-mono tracking-[0.3em] text-[#6B7280] uppercase">
                SELECTED DOCUMENT
              </div>
              <div className="text-[11px] font-mono tracking-wider text-[#0F5132]">
                {statusLabel[status]}
              </div>
            </div>
            <div className="px-6 py-5 grid grid-cols-12 gap-4 text-sm">
              <div className="col-span-8">
                <div className="text-[#F2F4F5] font-medium truncate">{file.name}</div>
                <div className="text-xs text-[#6B7280] font-mono mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
              <div className="col-span-4 text-right">
                <div className="text-xs text-[#6B7280] font-mono uppercase tracking-wider">
                  Pages
                </div>
                <div className="text-2xl font-semibold tracking-tight text-[#F2F4F5] mt-1">
                  {pageCount ?? "—"}
                </div>
              </div>
            </div>

            {(status === "uploading" || status === "processing") && (
              <div className="px-6 pb-5">
                <div className="h-[2px] w-full bg-[#22292D] overflow-hidden">
                  <div
                    className="h-full bg-[#0F5132] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] font-mono text-[#6B7280] tracking-wider">
                  {progress.toFixed(0)}%
                </div>
              </div>
            )}

            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                onClick={upload}
                disabled={status === "uploading" || status === "processing" || status === "complete"}
                className="px-6 py-2.5 bg-[#0F5132] text-[#F2F4F5] text-xs font-mono tracking-[0.2em] uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#146340] transition-colors"
              >
                INITIATE UPLOAD
              </button>
              <button
                onClick={reset}
                className="px-6 py-2.5 border border-[#22292D] text-[#8A9199] text-xs font-mono tracking-[0.2em] uppercase hover:border-[#3A4248] hover:text-[#F2F4F5] transition-colors"
              >
                RESET
              </button>
            </div>
          </section>
        )}

        {logs.length > 0 && (
          <section className="mt-10 border border-[#22292D] bg-[#0B0D0E]">
            <div className="px-6 py-4 border-b border-[#22292D]">
              <div className="text-[11px] font-mono tracking-[0.3em] text-[#6B7280] uppercase">
                EXECUTION LOG
              </div>
            </div>
            <div className="px-6 py-5 font-mono text-xs leading-6 text-[#9CA3AF]">
              {logs.map((entry) => (
                <div key={entry.id} className="whitespace-pre">
                  {entry.text}
                </div>
              ))}
              {status === "processing" && (
                <div className="text-[#0F5132] animate-pulse">_</div>
              )}
            </div>
          </section>
        )}

        {status === "complete" && documentId && (
          <div className="mt-8 border border-[#0F5132] bg-[#0A1610] px-6 py-4">
            <div className="text-[11px] font-mono tracking-[0.3em] text-[#0F5132] uppercase mb-1">
              INDEXED
            </div>
            <div className="text-sm text-[#D1D5DB] font-mono">
              DOCUMENT_ID: {documentId}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfIngestionDropzone;
export { PdfIngestionDropzone };
