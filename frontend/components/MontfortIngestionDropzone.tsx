"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';

type UploadState = 'IDLE' | 'VALIDATING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export default function MontfortIngestionDropzone() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const validateAndProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setUploadState('VALIDATING');
    setLogs([]);
    addLog(`INIT // INGESTION SEQUENCE: ${selectedFile.name}`);

    if (selectedFile.type !== 'application/pdf') {
      setUploadState('ERROR');
      setErrorMessage('REJECTED: INVALID MIME TYPE [APPLICATION/PDF REQUIRED]');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setUploadState('ERROR');
      setErrorMessage(`REJECTED: FILE SIZE EXCEEDS 15MB THRESHOLD`);
      return;
    }

    try {
      addLog('ANALYZING DOCUMENT STRUCTURE...');
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      addLog(`PAGE COUNT VERIFIED: ${pageCount} PAGES`);

      if (pageCount > 20) {
        setUploadState('ERROR');
        setErrorMessage(`REJECTED: EXCEEDS 20-PAGE LIMIT [DETECTED: ${pageCount}]`);
        return;
      }

      setFile(selectedFile);
      addLog('VALIDATION SUCCESSFUL. INITIATING UPLOAD.');
      triggerUpload(selectedFile);
    } catch (err) {
      setUploadState('ERROR');
      setErrorMessage('FATAL: UNABLE TO PARSE BINARY STRUCTURE');
    }
  };

  const triggerUpload = async (pdfFile: File) => {
    setUploadState('UPLOADING');
    addLog('ESTABLISHING SECURE MULTIPART UPLOAD...');

    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      setUploadProgress(50);
      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Server ingestion failed.');

      setUploadProgress(100);
      const data = await response.json();
      setDocumentId(data.document_id);
      addLog(`TRANSMISSION COMPLETE [ID: ${data.document_id}]`);
      setUploadState('PROCESSING');
    } catch (err: any) {
      setUploadState('ERROR');
      setErrorMessage(`TRANSMISSION ERROR: ${err.message}`);
    }
  };

  useEffect(() => {
    if (uploadState !== 'PROCESSING' || !documentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/documents/${documentId}/status`);
        const data = await res.json();

        if (data.status === 'PROCESSING') {
          addLog(`[OCR WORKER] Parsing layout layer...`);
        } else if (data.status === 'COMPLETED') {
          setUploadState('COMPLETED');
          addLog('[SUCCESS] Extraction & Knowledge Pipeline Synchronized.');
          clearInterval(interval);
        } else if (data.status === 'FAILED') {
          setUploadState('ERROR');
          setErrorMessage(`PIPELINE FAILURE: ${data.error_message}`);
          clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploadState, documentId]);

  return (
    <main className="min-h-screen bg-[#080808] text-[#E6E6E6] font-sans px-8 py-16 flex flex-col justify-between selection:bg-white selection:text-black">
      
      {/* TOP EDITORIAL HEADER */}
      <header className="max-w-7xl mx-auto w-full grid grid-cols-2 md:grid-cols-4 pb-8 border-b border-[#222] text-[11px] tracking-widest uppercase text-[#888]">
        <div>PHASE 01 // INGESTION</div>
        <div className="text-right md:text-left">SYSTEM: SECURE</div>
        <div className="hidden md:block">LIMIT: 20 PAGES</div>
        <div className="hidden md:block text-right">STATUS: {uploadState}</div>
      </header>

      {/* HERO STATEMENT (MONTFORT STYLE) */}
      <section className="max-w-7xl mx-auto w-full my-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
        <div className="lg:col-span-8">
          <h1 className="text-5xl sm:text-7xl font-light tracking-tight text-white leading-[1.05] uppercase">
            Document <br />
            <span className="italic font-serif text-[#999]">Ingestion</span> & <br />
            Validation.
          </h1>
          <p className="mt-8 text-sm text-[#888] max-w-xl font-normal leading-relaxed">
            Upload raw study material. Our pipeline executes client-side structural validation, high-density OCR extraction, and multi-tier knowledge synthesis before tokenization.
          </p>
        </div>

        {/* METRIC CARD */}
        <div className="lg:col-span-4 border border-[#222] p-6 bg-[#0D0D0D] flex flex-col justify-between h-48">
          <span className="text-[10px] tracking-widest text-[#666] uppercase">SECURE REPOSITORY</span>
          <div>
            <div className="text-3xl font-light text-white font-mono">15.0 MB</div>
            <div className="text-xs text-[#888] mt-1">Maximum payload capacity per stream</div>
          </div>
          <div className="text-[10px] text-emerald-500 font-mono">READY FOR INPUT</div>
        </div>
      </section>

      {/* DROPZONE ARCHITECTURE */}
      <section className="max-w-7xl mx-auto w-full mb-16">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) validateAndProcessFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border transition-all p-16 md:p-24 text-center cursor-pointer bg-[#0D0D0D] relative group ${
            dragOver ? 'border-white bg-white/5' : 'border-[#222] hover:border-[#444]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && validateAndProcessFile(e.target.files[0])}
          />

          <div className="space-y-4 max-w-md mx-auto">
            <span className="text-xs font-mono uppercase tracking-widest text-[#666] block">
              [ DROPZONE // SOURCE_PDF ]
            </span>
            <h2 className="text-xl font-light tracking-wide text-white">
              {file ? file.name : 'Drag & drop your PDF document here, or click to browse.'}
            </h2>
            <span className="text-xs text-[#888] block">
              Enforces strict client-side page counts (≤ 20 pages) prior to network transmission.
            </span>
          </div>
        </div>

        {/* ERROR NOTICE */}
        {errorMessage && (
          <div className="mt-4 p-4 border border-red-900/50 bg-red-950/20 text-red-400 text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {/* TERMINAL LOGS */}
        {logs.length > 0 && (
          <div className="mt-4 border border-[#222] bg-[#0A0A0A] p-6 font-mono text-xs text-[#888] space-y-2">
            <div className="text-[#550000] uppercase tracking-widest text-[10px] pb-2 border-b border-[#222] flex justify-between">
              <span>Execution Log</span>
              <span>{uploadState}</span>
            </div>
            {logs.map((log, i) => (
              <div key={i} className={log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('FATAL') ? 'text-red-400' : ''}>
                {log}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto w-full pt-8 border-t border-[#222] flex flex-col md:flex-row justify-between items-center text-[11px] text-[#666] tracking-wider">
        <span>MONTFORT ARCHITECTURE // KNOWLEDGE ENGINE</span>
        <span className="mt-2 md:mt-0">SECURE PARSING PIPELINE</span>
      </footer>

    </main>
  );
}
