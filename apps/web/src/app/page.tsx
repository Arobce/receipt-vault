"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <span className="text-xl font-bold text-blue-600">ReceiptVault</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Your receipts,
            <span className="text-blue-600"> organized</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Upload receipt photos and let smart OCR extract the details
            automatically. Track spending, browse by category, and export
            your data anytime.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Start for free
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div className="p-6 bg-white rounded-xl border border-slate-200">
              <div className="text-2xl mb-3">📸</div>
              <h3 className="font-semibold text-slate-900">Snap & Upload</h3>
              <p className="mt-2 text-sm text-slate-500">
                Upload a photo of any receipt. We support JPG, PNG, HEIC, and PDF.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border border-slate-200">
              <div className="text-2xl mb-3">🔍</div>
              <h3 className="font-semibold text-slate-900">Auto-Extract</h3>
              <p className="mt-2 text-sm text-slate-500">
                OCR reads the merchant, total, date, and line items automatically.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border border-slate-200">
              <div className="text-2xl mb-3">📊</div>
              <h3 className="font-semibold text-slate-900">Track & Export</h3>
              <p className="mt-2 text-sm text-slate-500">
                See spending breakdowns by category and export to CSV anytime.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
