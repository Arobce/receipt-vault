"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";
import Link from "next/link";

interface Receipt {
  id: string;
  merchant: string | null;
  totalAmount: string | null;
  currency: string;
  receiptDate: string | null;
  status: string;
  originalName: string;
  category: { name: string; icon: string | null } | null;
  createdAt: string;
}

interface ReceiptsResponse {
  receipts: Receipt[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSED: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

export default function ReceiptsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ReceiptsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchReceipts = useCallback(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    api
      .get<ReceiptsResponse>(`/receipts?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, page, search]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Receipts</h1>
          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search merchant..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          </div>
        ) : data && data.receipts.length > 0 ? (
          <>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Merchant</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3 hidden sm:table-cell">Category</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Amount</th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3 hidden sm:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.receipts.map((receipt) => (
                    <tr
                      key={receipt.id}
                      onClick={() => router.push(`/receipts/${receipt.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {receipt.receiptDate
                          ? new Date(receipt.receiptDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">
                          {receipt.merchant || receipt.originalName}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 hidden sm:table-cell">
                        {receipt.category ? (
                          <span>
                            {receipt.category.icon} {receipt.category.name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                        {receipt.totalAmount
                          ? `$${parseFloat(receipt.totalAmount).toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-center hidden sm:table-cell">
                        <span
                          className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${
                            statusStyles[receipt.status] || ""
                          }`}
                        >
                          {receipt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, data.pagination.total)} of {data.pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.pagination.totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500 mb-4">No receipts found</p>
            <Link
              href="/upload"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Upload your first receipt
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
