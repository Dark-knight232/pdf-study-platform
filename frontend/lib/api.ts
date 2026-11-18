const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API_URL}/api/v1/documents/upload`, { method: "POST", body: fd }).then((r) => r.json());
  },
  status: (id: string) => apiFetch(`/api/v1/documents/${id}/status`),
  roadmap: (id: string) => apiFetch(`/api/v1/documents/${id}/roadmap`, { method: "POST" }),
  summary: (id: string) => apiFetch(`/api/v1/documents/${id}/summary`, { method: "POST" }),
  quiz: (id: string) => apiFetch(`/api/v1/documents/${id}/quiz`, { method: "POST" }),
};
