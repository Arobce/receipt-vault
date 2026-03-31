"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";

interface ReceiptDetail {
  id: string;
  merchant: string | null;
  totalAmount: string | null;
  currency: string;
  receiptDate: string | null;
  status: string;
  originalName: string;
  isEdited: boolean;
  lineItems: Array<{ description: string; amount: number | null }> | null;
  category: { id: string; name: string; icon: string | null } | null;
  imageUrl: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export default function ReceiptDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [merchant, setMerchant] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    api
      .get<ReceiptDetail>(`/receipts/${id}`)
      .then((data) => {
        setReceipt(data);
        setMerchant(data.merchant || "");
        setTotalAmount(data.totalAmount ? parseFloat(data.totalAmount).toString() : "");
        setReceiptDate(data.receiptDate ? data.receiptDate.split("T")[0] : "");
        setCategoryId(data.category?.id || "");
      })
      .catch(() => router.push("/receipts"))
      .finally(() => setLoading(false));
  }, [user, id, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put<ReceiptDetail>(`/receipts/${id}`, {
        merchant: merchant || null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        receiptDate: receiptDate || null,
        categoryId: categoryId || null,
      });
      setReceipt({ ...receipt!, ...updated, imageUrl: receipt!.imageUrl });
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this receipt?")) return;
    try {
      await api.delete(`/receipts/${id}`);
      router.push("/receipts");
    } catch (err) {
      console.error(err);
    }
  }

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        </div>
      </div>
    );
  }

  if (!receipt) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push("/receipts")}
          className="text-sm text-slate-500 hover:text-slate-700 mb-6 flex items-center gap-1 transition-colors"
        >
          ← Back to receipts
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <img
              src={receipt.imageUrl}
              alt={receipt.originalName}
              className="w-full rounded-lg object-contain max-h-[600px]"
            />
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-slate-900">Receipt Details</h1>
                <div className="flex items-center gap-2">
                  {!editing ? (
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Field label="Merchant" editing={editing}>
                  {editing ? (
                    <input
                      type="text"
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-sm text-slate-900">{receipt.merchant || "-"}</span>
                  )}
                </Field>

                <Field label="Amount" editing={editing}>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-slate-900">
                      {receipt.totalAmount
                        ? `$${parseFloat(receipt.totalAmount).toFixed(2)} ${receipt.currency}`
                        : "-"}
                    </span>
                  )}
                </Field>

                <Field label="Date" editing={editing}>
                  {editing ? (
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-sm text-slate-900">
                      {receipt.receiptDate
                        ? new Date(receipt.receiptDate).toLocaleDateString()
                        : "-"}
                    </span>
                  )}
                </Field>

                <Field label="Category" editing={editing}>
                  {editing ? (
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-900">
                      {receipt.category
                        ? `${receipt.category.icon} ${receipt.category.name}`
                        : "Uncategorized"}
                    </span>
                  )}
                </Field>

                <Field label="Status" editing={false}>
                  <span className="text-sm text-slate-900">{receipt.status}</span>
                </Field>

                {receipt.isEdited && (
                  <p className="text-xs text-slate-400 italic">Manually edited</p>
                )}
              </div>
            </div>

            {/* Line items */}
            {receipt.lineItems && receipt.lineItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Line Items</h2>
                <div className="space-y-2">
                  {receipt.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{item.description}</span>
                      <span className="font-medium text-slate-900">
                        {item.amount !== null ? `$${item.amount.toFixed(2)}` : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  editing,
  children,
}: {
  label: string;
  editing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
