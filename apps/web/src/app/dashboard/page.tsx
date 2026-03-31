"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";

interface DashboardData {
  totalSpent: number;
  receiptCount: number;
  categoryBreakdown: Array<{
    category: string;
    icon: string | null;
    total: number;
    count: number;
  }>;
  dailyTotals: Array<{ date: string; total: number }>;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .get<DashboardData>(`/dashboard/summary?period=month&date=${month}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, month]);

  if (authLoading || !user) return null;

  const maxDaily = data ? Math.max(...data.dailyTotals.map((d) => d.total), 1) : 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          </div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500">Total Spent</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  ${data.totalSpent.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500">Receipts</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {data.receiptCount}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500">Avg per Receipt</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  ${data.receiptCount > 0 ? (data.totalSpent / data.receiptCount).toFixed(2) : "0.00"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily spending bar chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Daily Spending</h2>
                {data.dailyTotals.length > 0 ? (
                  <div className="space-y-2">
                    {data.dailyTotals.map((day) => (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-12 shrink-0">
                          {new Date(day.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(day.total / maxDaily) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-16 text-right">
                          ${day.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">No spending data for this period</p>
                )}
              </div>

              {/* Category breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">By Category</h2>
                {data.categoryBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {data.categoryBreakdown
                      .sort((a, b) => b.total - a.total)
                      .map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{cat.icon || "📦"}</span>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{cat.category}</p>
                              <p className="text-xs text-slate-400">{cat.count} receipt{cat.count !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">${cat.total.toFixed(2)}</p>
                            <p className="text-xs text-slate-400">
                              {data.totalSpent > 0 ? ((cat.total / data.totalSpent) * 100).toFixed(0) : 0}%
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">No categories yet</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
