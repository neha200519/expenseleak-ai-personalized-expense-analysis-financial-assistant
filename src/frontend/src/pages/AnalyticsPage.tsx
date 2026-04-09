import {
  BarChart2,
  Calendar,
  MoreVertical,
  Pencil,
  Receipt,
  Tag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import EditExpenseModal from "../components/EditExpenseModal";
import EmptyExpenseState from "../components/EmptyExpenseState";
import PageTransition from "../components/PageTransition";
import { useGetCategoryStats, useListExpenses } from "../hooks/useQueries";
import { formatCompact, formatCurrency } from "../lib/currency";
import type { Expense } from "../types/backend-types";

// ── Category config ───────────────────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  Food: "🍕",
  Shopping: "🛍️",
  Transport: "🚗",
  Bills: "⚡",
  Entertainment: "🎬",
  Health: "💊",
  Travel: "✈️",
  Other: "📦",
};

const CAT_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

type DateRange = "week" | "month" | "year" | "all";

function getDateCutoff(range: DateRange): Date | null {
  const now = new Date();
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  return null;
}

function parseExpenseDate(date: string | bigint): Date {
  try {
    if (typeof date === "bigint") return new Date(Number(date) / 1_000_000);
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function formatDateDisplay(date: string | bigint): string {
  try {
    return parseExpenseDate(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
}

function getCategoryStr(cat: Expense["category"]): string {
  if (typeof cat === "string") return cat;
  return Object.keys(cat)[0] || "Other";
}

function getPaymentStr(pm: Expense["paymentMethod"]): string {
  if (typeof pm === "string") return pm;
  return Object.keys(pm)[0] || "Cash";
}

function formatINR(v: number): string {
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; label?: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
      }}
    >
      <p
        style={{
          color: "var(--text-h)",
          fontWeight: 600,
          margin: 0,
          fontSize: "0.85rem",
        }}
      >
        {item.payload.label ?? item.payload.name}
      </p>
      <p
        style={{
          color: "var(--primary)",
          fontWeight: 700,
          margin: "2px 0 0",
          fontSize: "0.9rem",
        }}
      >
        {formatINR(item.value)}
      </p>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delay: number;
}
function StatCard({ icon, label, value, sub, delay }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1rem 1.125rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "var(--shadow-card)",
        animation: `statFadeIn 0.45s ease-out ${delay}ms both`,
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "color-mix(in srgb, var(--primary) 12%, var(--bg-card))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--primary)",
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            color: "var(--text-h)",
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: "0.1rem 0 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </p>
        {sub && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              margin: "0.1rem 0 0",
            }}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Row Action Buttons ────────────────────────────────────────────────────────
interface RowActionsProps {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
}
function RowActions({ expense, onEdit, onDelete }: RowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <td
      style={{
        padding: "0.5rem 0.75rem",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {/* Desktop inline buttons (visible on row hover via CSS) */}
      <div
        className="desktop-row-actions"
        style={{
          display: "flex",
          gap: 4,
          justifyContent: "flex-end",
          opacity: 0,
          transform: "translateX(8px)",
          transition: "opacity 150ms ease, transform 150ms ease",
        }}
      >
        <button
          type="button"
          aria-label={`Edit ${expense.merchant}`}
          onClick={onEdit}
          data-ocid="analytics.edit_button"
          style={{
            background: "transparent",
            border: "1px solid var(--primary)",
            borderRadius: 6,
            color: "var(--primary)",
            cursor: "pointer",
            padding: "3px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.75rem",
            fontWeight: 500,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "color-mix(in srgb, var(--primary) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
        >
          <Pencil size={11} /> Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${expense.merchant}`}
          onClick={onDelete}
          data-ocid="analytics.delete_button"
          style={{
            background: "transparent",
            border: "1px solid var(--danger, #ef4444)",
            borderRadius: 6,
            color: "var(--danger, #ef4444)",
            cursor: "pointer",
            padding: "3px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.75rem",
            fontWeight: 500,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239,68,68,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>

      {/* Mobile 3-dot menu */}
      <div className="mobile-row-actions" style={{ position: "relative" }}>
        <button
          type="button"
          aria-label="More options"
          aria-expanded={menuOpen}
          data-ocid="analytics.row_menu"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <MoreVertical size={14} />
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              zIndex: 80,
              minWidth: 120,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0.625rem 1rem",
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "color-mix(in srgb, var(--primary) 8%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0.625rem 1rem",
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--danger, #ef4444)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(239,68,68,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </td>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { data: expenses = [], isLoading } = useListExpenses();
  const { data: categoryStats = [] } = useGetCategoryStats();

  const [range, setRange] = useState<DateRange>("month");
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Filter expenses by date range
  const filtered = useMemo(() => {
    const cutoff = getDateCutoff(range);
    if (!cutoff) return expenses;
    return expenses.filter((e) => parseExpenseDate(e.date) >= cutoff);
  }, [expenses, range]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
    const avg = filtered.length > 0 ? total / filtered.length : 0;
    const now = new Date();
    const thisMonthTotal = filtered
      .filter((e) => {
        const d = parseExpenseDate(e.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, e) => s + Number(e.amount), 0);

    const catMap: Record<string, number> = {};
    for (const e of filtered) {
      const cat = getCategoryStr(e.category);
      catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
    }
    const topCat =
      Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return { total, avg, thisMonthTotal, topCat };
  }, [filtered]);

  // Build category chart data
  const chartItems = useMemo(() => {
    let catMap: Record<string, number>;

    if (range === "all" && categoryStats.length > 0) {
      catMap = Object.fromEntries(
        categoryStats.map(([k, v]) => [k, Number(v)]),
      );
    } else {
      catMap = {};
      for (const e of filtered) {
        const cat = getCategoryStr(e.category);
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
      }
    }

    const sorted = Object.entries(catMap)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length <= 8) {
      return sorted.map(([k, v], i) => ({
        name: `${CAT_EMOJI[k] ?? "📦"} ${k}`,
        label: k,
        value: v,
        color: CAT_COLORS[i % CAT_COLORS.length],
      }));
    }

    const top7 = sorted.slice(0, 7);
    const rest = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
    return [
      ...top7.map(([k, v], i) => ({
        name: `${CAT_EMOJI[k] ?? "📦"} ${k}`,
        label: k,
        value: v,
        color: CAT_COLORS[i % CAT_COLORS.length],
      })),
      { name: "📦 Other", label: "Other", value: rest, color: CAT_COLORS[7] },
    ];
  }, [filtered, categoryStats, range]);

  const totalForChart = chartItems.reduce((s, d) => s + d.value, 0);

  // Recent 10, newest first
  const recentExpenses = useMemo(
    () =>
      [...filtered]
        .sort(
          (a, b) =>
            parseExpenseDate(b.date).getTime() -
            parseExpenseDate(a.date).getTime(),
        )
        .slice(0, 10),
    [filtered],
  );

  const handleDeleteWithAnim = useCallback(async (expense: Expense) => {
    const row = rowRefs.current.get(String(expense.id));
    if (row) {
      row.style.transition = "transform 250ms ease, opacity 250ms ease";
      row.style.transform = "translateX(-100%)";
      row.style.opacity = "0";
      await new Promise((r) => setTimeout(r, 250));
      const h = row.getBoundingClientRect().height;
      row.style.transition = "height 200ms ease, padding 200ms ease";
      row.style.height = `${h}px`;
      row.style.overflow = "hidden";
      requestAnimationFrame(() => {
        row.style.height = "0";
        row.style.padding = "0";
      });
      await new Promise((r) => setTimeout(r, 200));
    }
    setDeleteExpense(expense);
  }, []);

  const rangeOptions: { id: DateRange; label: string }[] = [
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" },
    { id: "all", label: "All Time" },
  ];

  const yTickFormatter = (v: number) => formatCompact(v);

  return (
    <PageTransition>
      <style>{`
        @keyframes statFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chartFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .tx-row { transition: background 150ms ease; }
        .tx-row:hover {
          background: color-mix(in srgb, var(--primary) 5%, var(--bg-card)) !important;
        }
        .tx-row:hover .desktop-row-actions {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }

        .range-pill {
          background: var(--bg-muted);
          border: 1px solid var(--border);
          color: var(--text-muted);
          border-radius: var(--radius-full);
          padding: 0.35rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .range-pill:hover { border-color: var(--primary); color: var(--primary); }
        .range-pill.active {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--text-on-primary, #fff);
        }

        .cat-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-full);
          font-size: 0.72rem; font-weight: 600;
          white-space: nowrap;
        }

        @media (max-width: 767px) {
          .desktop-row-actions { display: none !important; }
          .mobile-row-actions { display: block !important; }
          .charts-grid { flex-direction: column !important; }
          .stats-row { flex-wrap: wrap !important; }
        }
        @media (min-width: 768px) {
          .desktop-row-actions { display: flex !important; }
          .mobile-row-actions { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tx-row, .desktop-row-actions { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div
        style={{
          background: "var(--bg-page)",
          minHeight: "100vh",
          padding: "1.75rem 1rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Page header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.875rem",
              marginBottom: "1.5rem",
              animation: "statFadeIn 0.4s ease-out both",
            }}
          >
            <div>
              <h1
                style={{
                  color: "var(--text-h)",
                  fontSize: "1.625rem",
                  fontWeight: 700,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
                data-ocid="analytics.page"
              >
                <BarChart2
                  size={22}
                  style={{ color: "var(--primary)" }}
                  aria-hidden="true"
                />
                Analytics
              </h1>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                  margin: "0.25rem 0 0",
                }}
              >
                Visualise your spending patterns and trends (₹)
              </p>
            </div>

            {/* Date range pills */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {rangeOptions.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`range-pill${range === id ? " active" : ""}`}
                  onClick={() => setRange(id)}
                  data-ocid={`analytics.date_filter_${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div
            className="stats-row"
            style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}
          >
            <StatCard
              icon={<Receipt size={17} />}
              label="Total Spent"
              value={formatCompact(stats.total)}
              sub={`${filtered.length} transactions`}
              delay={0}
            />
            <StatCard
              icon={<Calendar size={17} />}
              label="This Month"
              value={formatCompact(stats.thisMonthTotal)}
              delay={60}
            />
            <StatCard
              icon={<Tag size={17} />}
              label="Top Category"
              value={`${CAT_EMOJI[stats.topCat] ?? "📦"} ${stats.topCat}`}
              delay={120}
            />
            <StatCard
              icon={<TrendingUp size={17} />}
              label="Avg per Txn"
              value={formatCompact(stats.avg)}
              delay={180}
            />
          </div>

          {/* Charts row */}
          {!isLoading && chartItems.length > 0 && (
            <div
              className="charts-grid"
              style={{
                display: "flex",
                gap: "1rem",
                marginBottom: "1.25rem",
                animation: "chartFadeIn 0.5s ease-out 0.2s both",
              }}
            >
              {/* Bar chart */}
              <div
                style={{
                  flex: "1.35",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-card)",
                  minWidth: 0,
                }}
                data-ocid="analytics.bar_chart"
              >
                <h2
                  style={{
                    color: "var(--text-h)",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    margin: "0 0 1rem",
                  }}
                >
                  Spending by Category
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={chartItems}
                    margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={chartItems.length > 5 ? -25 : 0}
                      textAnchor={chartItems.length > 5 ? "end" : "middle"}
                      height={chartItems.length > 5 ? 60 : 30}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={yTickFormatter}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={700}
                      animationEasing="ease-out"
                      minPointSize={4}
                    >
                      {chartItems.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={entry.color}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Donut chart */}
              <div
                style={{
                  flex: "1",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-card)",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
                data-ocid="analytics.donut_chart"
              >
                <h2
                  style={{
                    color: "var(--text-h)",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    margin: "0 0 0.5rem",
                  }}
                >
                  Category Breakdown
                </h2>
                <div style={{ flex: 1, position: "relative" }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={chartItems}
                        cx="50%"
                        cy="46%"
                        innerRadius={68}
                        outerRadius={105}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                        isAnimationActive
                        animationBegin={100}
                        animationDuration={900}
                        animationEasing="ease-out"
                      >
                        {chartItems.map((entry) => (
                          <Cell key={entry.label} fill={entry.color} />
                        ))}
                      </Pie>
                      <text
                        x="50%"
                        y="44%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fill: "var(--text-h)",
                          fontSize: 16,
                          fontWeight: 700,
                        }}
                      >
                        {formatINR(totalForChart)}
                      </text>
                      <text
                        x="50%"
                        y="54%"
                        textAnchor="middle"
                        style={{ fill: "var(--text-muted)", fontSize: 11 }}
                      >
                        total
                      </text>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem 0.875rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {chartItems.map((entry) => {
                    const pct =
                      totalForChart > 0
                        ? ((entry.value / totalForChart) * 100).toFixed(1)
                        : "0";
                    return (
                      <div
                        key={entry.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: "0.72rem",
                        }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: entry.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "var(--text-body)" }}>
                          {entry.label}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {pct}%
                        </span>
                        <span
                          style={{
                            color: "var(--primary)",
                            fontWeight: 600,
                          }}
                        >
                          {formatINR(entry.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Transactions table */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
              animation: "chartFadeIn 0.5s ease-out 0.3s both",
            }}
            data-ocid="analytics.table"
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <h2
                style={{
                  color: "var(--text-h)",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Recent Transactions
              </h2>
              <span style={{ color: "var(--text-muted)", fontSize: "0.77rem" }}>
                {recentExpenses.length} of {filtered.length}
              </span>
            </div>

            {isLoading ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    border: "3px solid var(--primary)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              </div>
            ) : recentExpenses.length === 0 ? (
              <EmptyExpenseState
                Icon={BarChart2}
                title="No spending data yet"
                subtitle="Add expenses to see your analytics and transaction history"
                ctaLabel="Add Expense"
                ctaTo="/add-expense"
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.855rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--bg-muted)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {[
                        { label: "Date", align: "left" as const },
                        { label: "Merchant", align: "left" as const },
                        { label: "Category", align: "left" as const },
                        { label: "Amount", align: "right" as const },
                        { label: "Payment", align: "left" as const },
                        { label: "", align: "right" as const },
                      ].map(({ label, align }, i) => (
                        <th
                          key={label || `th-${i}`}
                          style={{
                            padding: "0.6rem 1rem",
                            textAlign: align,
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((expense, idx) => {
                      const cat = getCategoryStr(expense.category);
                      const payment = getPaymentStr(expense.paymentMethod);
                      const isAlt = idx % 2 === 1;
                      const rowId = String(expense.id);
                      const catColorIdx = Object.keys(CAT_EMOJI).indexOf(cat);
                      const catColor =
                        catColorIdx >= 0
                          ? CAT_COLORS[catColorIdx % CAT_COLORS.length]
                          : CAT_COLORS[0];

                      return (
                        <tr
                          key={rowId}
                          ref={(el) => {
                            if (el) rowRefs.current.set(rowId, el);
                            else rowRefs.current.delete(rowId);
                          }}
                          className="tx-row"
                          style={{
                            background: isAlt
                              ? "color-mix(in srgb, var(--bg-muted) 45%, var(--bg-card))"
                              : "var(--bg-card)",
                            borderBottom: "1px solid var(--border)",
                          }}
                          data-ocid={`analytics.row.${idx + 1}`}
                        >
                          {/* Date */}
                          <td
                            style={{
                              padding: "0.625rem 1rem",
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                              fontSize: "0.82rem",
                            }}
                          >
                            {formatDateDisplay(expense.date)}
                          </td>

                          {/* Merchant */}
                          <td
                            style={{
                              padding: "0.625rem 1rem",
                              color: "var(--text-body)",
                              fontWeight: 500,
                              maxWidth: 150,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {expense.merchant || "Unknown"}
                          </td>

                          {/* Category badge */}
                          <td style={{ padding: "0.625rem 1rem" }}>
                            <span
                              className="cat-badge"
                              style={{
                                background: `${catColor}20`,
                                color: catColor,
                                border: `1px solid ${catColor}40`,
                              }}
                            >
                              {CAT_EMOJI[cat] ?? "📦"} {cat}
                            </span>
                          </td>

                          {/* Amount */}
                          <td
                            style={{
                              padding: "0.625rem 1rem",
                              color: "var(--text-h)",
                              fontWeight: 700,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatCurrency(Number(expense.amount))}
                          </td>

                          {/* Payment */}
                          <td
                            style={{
                              padding: "0.625rem 1rem",
                              color: "var(--text-muted)",
                              fontSize: "0.78rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {payment}
                          </td>

                          {/* Actions */}
                          <RowActions
                            expense={expense}
                            onEdit={() => setEditExpense(expense)}
                            onDelete={() => handleDeleteWithAnim(expense)}
                          />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditExpenseModal
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
      <DeleteConfirmModal
        expense={deleteExpense}
        onClose={() => setDeleteExpense(null)}
      />
    </PageTransition>
  );
}
