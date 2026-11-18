"use client";

import React, { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';

const API_BASE = "https://pdf-study-api.onrender.com";

type UploadState = 'IDLE' | 'VALIDATING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export default function MontfortIngestionDropzone({
  onDocumentComplete,
}: {
  onDocumentComplete?: (id: string) => void;
}) {
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
      const response = await fetch(`${API_BASE}/api/v1/documents/upload`, {
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

  React.useEffect(() => {
    if (uploadState !== 'PROCESSING' || !documentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/documents/${documentId}/status`);
        const data = await res.json();

        if (data.status === 'PROCESSING') {
          addLog(`[OCR WORKER] Parsing layout layer...`);
        } else if (data.status === 'COMPLETED') {
          setUploadState('COMPLETED');
          addLog('[SUCCESS] Extraction & Knowledge Pipeline Synchronized.');
          clearInterval(interval);
          if (onDocumentComplete) onDocumentComplete(documentId);
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
  }, [uploadState, documentId, onDocumentComplete]);

  return (
    <section className="relative z-10">
      {/* DROPZONE ARCHITECTURE */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.[0]) validateAndProcessFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border transition-all p-16 md:p-24 text-center cursor-pointer bg-[#0D0D0D]/80 backdrop-blur-sm relative group ${
          dragOver ? 'border-white bg-white/5' : 'border-[#22292D] hover:border-[#444]'
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
          <h3 className="text-xl font-light tracking-wide text-white">
            {file ? file.name : 'Drag & drop your PDF document here, or click to browse.'}
          </h3>
          <span className="text-xs text-[#888] block">
            Enforces strict client-side page counts (≤ 20 pages) prior to network transmission.
          </span>
          {uploadState !== 'IDLE' && (
            <div className="pt-2">
              <div className="h-px w-full bg-[#22292D] relative overflow-hidden">
                <div
                  className="h-full bg-[#0F5132] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#666] mt-2 block">
                {uploadState} // {uploadProgress}%
              </span>
            </div>
          )}
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
        <div className="mt-4 border border-[#22292D] bg-[#0A0A0A]/90 p-6 font-mono text-xs text-[#888] space-y-2">
          <div className="text-[#555] uppercase tracking-widest text-[10px] pb-2 border-b border-[#22292D] flex justify-between">
            <span>Execution Log</span>
            <span>{uploadState}</span>
          </div>
          {logs.map((log, i) => (
            <div key={i} className={log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('FATAL') || log.includes('ERROR') ? 'text-red-400' : ''}>
              {log}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}