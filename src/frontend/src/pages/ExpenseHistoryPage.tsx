import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import EditExpenseModal from "../components/EditExpenseModal";
import EmptyExpenseState from "../components/EmptyExpenseState";
import PageTransition from "../components/PageTransition";
import { useDeleteExpense, useListExpenses } from "../hooks/useQueries";
import type { Expense } from "../types/backend-types";

const CATEGORIES = [
  "All",
  "Food",
  "Entertainment",
  "Transport",
  "Bills",
  "Shopping",
  "Healthcare",
  "Travel",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "var(--primary)",
  Transport: "#10B981",
  Shopping: "#F97316",
  Entertainment: "#8B5CF6",
  Healthcare: "#EF4444",
  Bills: "#F59E0B",
  Travel: "#3B82F6",
  Other: "#64748B",
};

function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? "#94A3B8";
}

function formatINR(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(date: string | bigint): string {
  try {
    const d =
      typeof date === "bigint"
        ? new Date(Number(date) / 1_000_000)
        : new Date(date);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (_e) {
    return String(date);
  }
}

function getMethodKey(method: Expense["paymentMethod"]): string {
  if (typeof method === "string") return method as string;
  return Object.keys(method as Record<string, unknown>)[0] || "Cash";
}

function getCategoryKey(category: Expense["category"]): string {
  if (typeof category === "string") return category as string;
  return Object.keys(category)[0] || "Other";
}

type SortField = "date" | "amount" | "category" | "merchant";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

export default function ExpenseHistoryPage() {
  const { data: expenses, isLoading } = useListExpenses();
  const deleteExpense = useDeleteExpense();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...(expenses ?? [])];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.merchant.toLowerCase().includes(q) ||
          getCategoryKey(e.category).toLowerCase().includes(q),
      );
    }

    if (categoryFilter !== "All") {
      list = list.filter((e) => getCategoryKey(e.category) === categoryFilter);
    }

    if (dateFrom) {
      const fromMs = Date.parse(dateFrom);
      list = list.filter((e) => Number(e.date) / 1_000_000 >= fromMs);
    }
    if (dateTo) {
      const toMs = Date.parse(dateTo) + 86400000; // inclusive end of day
      list = list.filter((e) => Number(e.date) / 1_000_000 <= toMs);
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") comparison = Number(a.date) - Number(b.date);
      else if (sortField === "amount") comparison = a.amount - b.amount;
      else if (sortField === "merchant")
        comparison = a.merchant.localeCompare(b.merchant);
      else if (sortField === "category")
        comparison = getCategoryKey(a.category).localeCompare(
          getCategoryKey(b.category),
        );
      return sortDir === "asc" ? comparison : -comparison;
    });

    return list;
  }, [expenses, search, categoryFilter, dateFrom, dateTo, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setCurrentPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((e) => String(e.id))));
    }
  };

  const handleBulkDelete = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await deleteExpense.mutateAsync(id);
        count++;
      } catch (_e) {
        // continue
      }
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast.success(`Deleted ${count} expense${count !== 1 ? "s" : ""}`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <PageTransition>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .history-row {
          transition: background 150ms ease;
          position: relative;
        }
        .history-row:hover {
          background: color-mix(in srgb, var(--primary) 5%, var(--bg-card)) !important;
        }
        .history-row:hover .history-row-actions {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }
        .history-row-actions {
          opacity: 0;
          transform: translateX(8px);
          transition: opacity 150ms ease, transform 150ms ease;
          display: flex;
          gap: 4px;
          align-items: center;
        }
        @media (max-width: 767px) {
          .history-row-actions { display: none !important; }
          .history-mobile-menu { display: block !important; }
        }
        @media (min-width: 768px) {
          .history-mobile-menu { display: none !important; }
        }
        .sort-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0;
        }
        .sort-btn:hover { color: var(--text-body); }
      `}</style>

      <div
        style={{
          background: "var(--bg-page)",
          minHeight: "100vh",
          padding: "2rem 1rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              marginBottom: "1.5rem",
              animation: "fadeUp 0.4s ease-out both",
            }}
          >
            <h1
              style={{
                color: "var(--text-h)",
                fontSize: "1.875rem",
                fontWeight: 700,
                margin: 0,
              }}
              data-ocid="history.page"
            >
              Expense History
            </h1>
            <p
              style={{
                color: "var(--text-muted)",
                marginTop: "0.375rem",
                fontSize: "0.95rem",
              }}
            >
              Full paginated list of all your expenses
            </p>
          </div>

          {/* Filters bar */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "1rem 1.25rem",
              marginBottom: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "flex-end",
              animation: "fadeUp 0.4s ease-out 60ms both",
            }}
          >
            {/* Search */}
            <div style={{ flex: "1 1 200px", minWidth: 160 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                htmlFor="history-search"
              >
                Search
              </label>
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <Input
                  id="history-search"
                  type="text"
                  placeholder="Merchant or category"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  data-ocid="history.search_input"
                  style={{
                    paddingLeft: 28,
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                    color: "var(--text-body)",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* Category filter */}
            <div style={{ flex: "0 0 auto" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                htmlFor="history-category"
              >
                Category
              </label>
              <select
                id="history-category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                data-ocid="history.select"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  borderRadius: 8,
                  padding: "0.5rem 2rem 0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.6rem center",
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div style={{ flex: "0 0 auto" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                htmlFor="history-from"
              >
                From
              </label>
              <Input
                id="history-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                data-ocid="history.input"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  borderRadius: 8,
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Date To */}
            <div style={{ flex: "0 0 auto" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                htmlFor="history-to"
              >
                To
              </label>
              <Input
                id="history-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                data-ocid="history.input"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  borderRadius: 8,
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Clear filters */}
            {(search || categoryFilter !== "All" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setDateFrom("");
                  setDateTo("");
                  setCurrentPage(1);
                }}
                data-ocid="history.secondary_button"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  borderRadius: 8,
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Bulk delete bar */}
          {selectedIds.size > 0 && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                padding: "0.75rem 1.25rem",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                animation: "fadeUp 0.3s ease-out both",
              }}
            >
              <span style={{ color: "var(--text-body)", fontSize: "0.875rem" }}>
                <strong style={{ color: "#EF4444" }}>{selectedIds.size}</strong>{" "}
                expense{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  data-ocid="history.cancel_button"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    borderRadius: 6,
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  data-ocid="history.delete_button"
                  style={{
                    background: "#EF4444",
                    border: "none",
                    color: "#fff",
                    borderRadius: 6,
                    padding: "0.4rem 0.875rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Trash2 size={13} />
                  Delete Selected ({selectedIds.size})
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              animation: "fadeUp 0.4s ease-out 120ms both",
            }}
            data-ocid="history.table"
          >
            {isLoading ? (
              <div
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[...Array(6)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyExpenseState
                title="No expenses found"
                subtitle={
                  search || categoryFilter !== "All" || dateFrom || dateTo
                    ? "No expenses match your current filters. Try adjusting the search or filters."
                    : "Add your first expense using the Add Expense page"
                }
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.875rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {/* Checkbox all */}
                      <th style={{ padding: "0.75rem 1rem", width: 40 }}>
                        <Checkbox
                          checked={
                            paginated.length > 0 &&
                            selectedIds.size === paginated.length
                          }
                          onCheckedChange={toggleSelectAll}
                          data-ocid="history.checkbox"
                          aria-label="Select all"
                        />
                      </th>

                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => handleSort("date")}
                        >
                          Date <SortIcon field="date" />
                        </button>
                      </th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => handleSort("category")}
                        >
                          Category <SortIcon field="category" />
                        </button>
                      </th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => handleSort("merchant")}
                        >
                          Merchant <SortIcon field="merchant" />
                        </button>
                      </th>
                      <th
                        style={{
                          padding: "0.75rem 0.5rem",
                          display: "none",
                        }}
                        className="md:table-cell"
                      >
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          Method
                        </span>
                      </th>
                      <th
                        style={{
                          padding: "0.75rem 0.5rem",
                          textAlign: "right",
                        }}
                      >
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => handleSort("amount")}
                          style={{ marginLeft: "auto" }}
                        >
                          Amount <SortIcon field="amount" />
                        </button>
                      </th>
                      <th
                        style={{
                          padding: "0.75rem 0.75rem",
                          textAlign: "right",
                          color: "var(--text-muted)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((expense, idx) => {
                      const catKey = getCategoryKey(expense.category);
                      const catColor = getCategoryColor(catKey);
                      const isSelected = selectedIds.has(String(expense.id));
                      const rowBg = isSelected
                        ? "color-mix(in srgb, var(--primary) 6%, var(--bg-card))"
                        : idx % 2 === 0
                          ? "var(--bg-card)"
                          : "var(--bg-muted, var(--bg-card))";

                      return (
                        <HistoryRow
                          key={expense.id}
                          expense={expense}
                          idx={idx}
                          catKey={catKey}
                          catColor={catColor}
                          rowBg={rowBg}
                          isSelected={isSelected}
                          onToggle={() => toggleSelect(String(expense.id))}
                          onEdit={() => setEditingExpense(expense)}
                          onDelete={() => setDeletingExpense(expense)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && filtered.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                }}
              >
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} expenses
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  data-ocid="history.pagination_prev"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color:
                      currentPage === 1
                        ? "var(--text-muted)"
                        : "var(--text-body)",
                    borderRadius: 8,
                    padding: "0.4rem 0.75rem",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.8rem",
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span
                  style={{
                    background: "var(--primary)",
                    color: "var(--text-on-primary, #fff)",
                    borderRadius: 8,
                    padding: "0.4rem 0.875rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  data-ocid="history.pagination_next"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color:
                      currentPage === totalPages
                        ? "var(--text-muted)"
                        : "var(--text-body)",
                    borderRadius: 8,
                    padding: "0.4rem 0.75rem",
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.8rem",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Delete single */}
      {deletingExpense && (
        <DeleteConfirmModal
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
        />
      )}

      {/* Bulk delete confirm */}
      {bulkDeleteOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          data-ocid="history.dialog"
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "1.75rem",
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.1)",
                border: "2px solid rgba(239,68,68,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <Trash2 size={22} style={{ color: "#EF4444" }} />
            </div>
            <h3
              style={{
                color: "var(--text-h)",
                fontSize: "1.1rem",
                fontWeight: 700,
                margin: "0 0 0.5rem",
              }}
            >
              Delete {selectedIds.size} expense
              {selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                margin: "0 0 1.25rem",
              }}
            >
              This action cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                data-ocid="history.cancel_button"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  borderRadius: 8,
                  padding: "0.6rem 1rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleteExpense.isPending}
                data-ocid="history.confirm_button"
                style={{
                  background: "#EF4444",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: deleteExpense.isPending ? "not-allowed" : "pointer",
                  opacity: deleteExpense.isPending ? 0.7 : 1,
                }}
              >
                {deleteExpense.isPending ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

// ── History row sub-component to avoid repetition ───────────────────────────────────
function HistoryRow({
  expense,
  idx,
  catKey,
  catColor,
  rowBg,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  idx: number;
  catKey: string;
  catColor: string;
  rowBg: string;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <tr
      className="history-row"
      style={{ background: rowBg }}
      data-ocid={`history.row.${idx + 1}`}
    >
      {/* Checkbox */}
      <td style={{ padding: "0.625rem 1rem" }}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          data-ocid={`history.checkbox.${idx + 1}`}
          aria-label={`Select ${expense.merchant}`}
        />
      </td>

      {/* Date */}
      <td
        style={{
          padding: "0.625rem 0.5rem",
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          fontSize: "0.8rem",
        }}
      >
        {formatDate(expense.date)}
      </td>

      {/* Category */}
      <td style={{ padding: "0.625rem 0.5rem" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 999,
            background: `color-mix(in srgb, ${catColor} 15%, transparent)`,
            color: catColor,
            fontWeight: 600,
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: catColor,
              flexShrink: 0,
            }}
          />
          {catKey}
        </span>
      </td>

      {/* Merchant */}
      <td
        style={{
          padding: "0.625rem 0.5rem",
          color: "var(--text-body)",
          fontWeight: 500,
          fontSize: "0.875rem",
        }}
      >
        {expense.merchant}
      </td>

      {/* Method — hidden on mobile */}
      <td
        style={{
          padding: "0.625rem 0.5rem",
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          display: "none",
        }}
        className="md:table-cell"
      >
        {getMethodKey(expense.paymentMethod)}
      </td>

      {/* Amount */}
      <td
        style={{
          padding: "0.625rem 0.5rem",
          textAlign: "right",
          color: "var(--primary)",
          fontWeight: 700,
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
        }}
      >
        {formatINR(expense.amount)}
      </td>

      {/* Actions */}
      <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
        {/* Desktop */}
        <div className="history-row-actions">
          <button
            type="button"
            aria-label="Edit"
            onClick={onEdit}
            data-ocid={`history.edit_button.${idx + 1}`}
            style={{
              background: "transparent",
              border: "1px solid var(--primary)",
              borderRadius: 6,
              color: "var(--primary)",
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={onDelete}
            data-ocid={`history.delete_button.${idx + 1}`}
            style={{
              background: "transparent",
              border: "1px solid #EF4444",
              borderRadius: 6,
              color: "#EF4444",
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>

        {/* Mobile 3-dot */}
        <div
          className="history-mobile-menu"
          style={{ position: "relative", display: "none" }}
        >
          <button
            type="button"
            aria-label="More"
            data-ocid={`history.dropdown_menu.${idx + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen((o) => !o);
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            <MoreVertical size={14} />
          </button>
          {mobileMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                zIndex: 50,
                minWidth: 110,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEdit();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0.6rem 1rem",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onDelete();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0.6rem 1rem",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "#EF4444",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
