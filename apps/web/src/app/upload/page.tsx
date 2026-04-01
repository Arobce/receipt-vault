"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<Array<{ name: string; status: string; id?: string }>>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    const newUploads = fileArray.map((f) => ({ name: f.name, status: "uploading" }));
    setUploads((prev) => [...newUploads, ...prev]);
    setUploading(true);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const formData = new FormData();
      formData.append("receipt", file);

      try {
        const result = await api.post<{ id: string }>("/receipts/upload", formData);
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "uploading"
              ? { ...u, status: "success", id: result.id }
              : u
          )
        );
      } catch (err: any) {
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "uploading"
              ? { ...u, status: err.message || "Upload failed" }
              : u
          )
        );
      }
    }
    setUploading(false);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
  }

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Upload Receipts</h1>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`bg-white rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <div className="text-4xl mb-4">📄</div>
          <p className="text-sm font-medium text-slate-700 mb-1">
            Drag and drop receipt images here
          </p>
          <p className="text-xs text-slate-400 mb-4">JPG, PNG, or PDF up to 10MB</p>
          <label className="inline-block cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Browse files
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        {uploads.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {uploads.map((upload, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700 truncate mr-4">{upload.name}</span>
                {upload.status === "uploading" ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 shrink-0" />
                ) : upload.status === "success" ? (
                  <button
                    onClick={() => router.push(`/receipts/${upload.id}`)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  >
                    View →
                  </button>
                ) : (
                  <span className="text-xs text-red-500 shrink-0">{upload.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
