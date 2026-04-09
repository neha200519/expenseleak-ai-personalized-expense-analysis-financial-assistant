import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Bell,
  CheckCircle,
  ChevronRight,
  MessageCircle,
  Pencil,
  PieChart,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import EditExpenseModal from "../components/EditExpenseModal";
import EmptyExpenseState from "../components/EmptyExpenseState";
import PageTransition from "../components/PageTransition";
import { useCountUp } from "../hooks/useCountUp";
import {
  useGetBudgetStatus,
  useGetCategoryStats,
  useGetExpenseSummary,
  useGetRiskLevel,
  useGetSpendingAlerts,
  useGetSpendingPersonality,
  useListExpenses,
} from "../hooks/useQueries";
import type { Expense } from "../types/backend-types";
import { ExpenseCategory } from "../types/backend-types";

/* ── category icon map ──────────────────────────────────────────────────────── */
const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.Food]: "🍔",
  [ExpenseCategory.Entertainment]: "🎬",
  [ExpenseCategory.Transport]: "🚗",
  [ExpenseCategory.Bills]: "📄",
  [ExpenseCategory.Shopping]: "🛍️",
  [ExpenseCategory.Health]: "🏥",
  [ExpenseCategory.Travel]: "✈️",
  [ExpenseCategory.Other]: "📦",
};

// Note: Chart/badge palette colors — resolved at runtime for Recharts compatibility
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316",
  Entertainment: "#8b5cf6",
  Transport: "#3b82f6",
  Bills: "#6b7280",
  Shopping: "#ec4899",
  Health: "#10b981",
  Travel: "#0ea5e9",
  Other: "#94a3b8",
};

/* ── helper components ──────────────────────────────────────────────────────── */
function AnimatedRupee({
  value,
  loading,
}: { value: number; loading: boolean }) {
  const display = useCountUp(loading ? 0 : value, 1000, 0);
  if (loading)
    return (
      <Skeleton
        className="h-9 w-28"
        style={{ background: "var(--bg-muted)" }}
      />
    );
  return (
    <span
      className="text-3xl font-bold tabular-nums"
      style={{ color: "var(--text-heading)" }}
    >
      ₹{Number(display).toLocaleString("en-IN")}
    </span>
  );
}

function AnimatedCount({
  value,
  loading,
}: { value: number; loading: boolean }) {
  const display = useCountUp(loading ? 0 : value, 800, 0);
  if (loading)
    return (
      <Skeleton
        className="h-9 w-16"
        style={{ background: "var(--bg-muted)" }}
      />
    );
  return (
    <span
      className="text-3xl font-bold tabular-nums"
      style={{ color: "var(--text-heading)" }}
    >
      {display}
    </span>
  );
}

function StatCard({
  label,
  icon,
  iconBg,
  delay,
  children,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  delay: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="stat-glass-card animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
      data-ocid={`home.stat_card.${label.toLowerCase().replace(/\s+/g, "_")}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
      </div>
      <div className="mb-1">{children}</div>
      {footer && (
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/* ── circular progress ring for budget ─────────────────────────────────────── */
function BudgetRing({ percentage }: { percentage: number }) {
  const clamped = Math.min(percentage, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = clamped;
    const dur = 1000;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - (1 - p) ** 3;
      setAnimated(e * target);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [clamped]);

  const strokeColor =
    clamped >= 100
      ? "var(--danger)"
      : clamped >= 80
        ? "var(--warning)"
        : "var(--success)";

  const dashOffset = circ - (animated / 100) * circ;

  return (
    <svg
      width="88"
      height="88"
      className="flex-shrink-0"
      aria-hidden="true"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="8"
      />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        style={{
          transition: "stroke-dashoffset 16ms linear",
          filter: `drop-shadow(0 0 4px ${strokeColor})`,
        }}
      />
    </svg>
  );
}

/* ── typewriter hook ────────────────────────────────────────────────────────── */
function useTypewriter(text: string, speed = 55) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string | bigint) {
  try {
    const d =
      typeof dateStr === "bigint"
        ? new Date(Number(dateStr) / 1_000_000)
        : new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

/* ── risk helpers ───────────────────────────────────────────────────────────── */
const RISK_COLORS: Record<string, string> = {
  Low: "var(--success)",
  Medium: "var(--warning)",
  High: "var(--danger)",
};
const RISK_SCORES: Record<string, number> = { Low: 18, Medium: 52, High: 82 };
const RISK_ICONS: Record<string, React.ReactNode> = {
  Low: <CheckCircle className="h-5 w-5" />,
  Medium: <AlertCircle className="h-5 w-5" />,
  High: <AlertTriangle className="h-5 w-5" />,
};

const PERSONALITY_META: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  BudgetConscious: {
    icon: "🎯",
    label: "Budget-Conscious",
    color: "var(--success)",
  },
  ImpulsiveSpender: {
    icon: "⚡",
    label: "Impulsive Spender",
    color: "var(--warning)",
  },
  SubscriptionHeavy: {
    icon: "📱",
    label: "Subscription-Heavy",
    color: "var(--primary)",
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const navigate = useNavigate();

  const { data: expenses, isLoading: expensesLoading } = useListExpenses();
  const { data: summary, isLoading: summaryLoading } = useGetExpenseSummary();
  const { data: categoryStats, isLoading: statsLoading } =
    useGetCategoryStats();
  const { data: budget, isLoading: budgetLoading } = useGetBudgetStatus();
  const { data: riskLevel, isLoading: riskLoading } = useGetRiskLevel();
  const { data: personality, isLoading: personalityLoading } =
    useGetSpendingPersonality();
  const { data: alertsData, isLoading: alertsLoading } = useGetSpendingAlerts();

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      return new Set(
        JSON.parse(localStorage.getItem("dismissed-alerts") || "[]"),
      );
    } catch {
      return new Set();
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);

  const greetingText = `${getGreeting()}, Neha 👋`;
  const greetingDisplayed = useTypewriter(greetingText);

  const recentExpenses = (expenses ?? []).slice(0, 10);
  const totalExpenses = expenses?.length ?? 0;
  const riskKey = (riskLevel ?? "Low") as string;
  const riskScore = RISK_SCORES[riskKey] ?? 18;
  const [animatedRisk, setAnimatedRisk] = useState(0);
  const riskRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!riskLevel) return;
    const target = riskScore;
    const dur = 900;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setAnimatedRisk((1 - (1 - p) ** 3) * target);
      if (p < 1) riskRafRef.current = requestAnimationFrame(step);
    };
    riskRafRef.current = requestAnimationFrame(step);
    return () => {
      if (riskRafRef.current) cancelAnimationFrame(riskRafRef.current);
    };
  }, [riskLevel, riskScore]);

  const activeAlerts = (alertsData ?? []).filter(
    (a) => a.status === "Active" && !dismissedAlerts.has(a.category),
  );

  const handleDismissAlert = (category: string) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(category);
      localStorage.setItem("dismissed-alerts", JSON.stringify([...next]));
      return next;
    });
  };

  const pct = budget?.percentage ?? 0;
  const personalityMeta = PERSONALITY_META[personality ?? ""] ??
    Object.values(PERSONALITY_META).find((m) =>
      personality?.toLowerCase().includes(m.label.toLowerCase().split("-")[0]),
    ) ?? {
      icon: "👤",
      label: personality ?? "N/A",
      color: "var(--text-muted)",
    };

  /* ── This month spend ─────────────────────────────────────────────────────── */
  const thisMonth = (() => {
    const now = new Date();
    return (expenses ?? []).reduce((sum, e) => {
      const d =
        typeof e.date === "bigint"
          ? new Date(Number(e.date) / 1_000_000)
          : new Date(e.date);
      if (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        return (
          sum +
          (typeof e.amount === "number" ? e.amount : Number(e.amount) || 0)
        );
      }
      return sum;
    }, 0);
  })();

  return (
    <PageTransition>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes mesh-drift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(var(--primary-rgb), 0); }
        }
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(0.97); }
        }
        @keyframes logo-glow-ring {
          0%, 100% { box-shadow: 0 0 12px 2px rgba(var(--primary-rgb), 0.4); }
          50%       { box-shadow: 0 0 28px 6px rgba(var(--primary-rgb), 0.65); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .stat-glass-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: var(--shadow-card);
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .stat-glass-card:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 20px rgba(var(--primary-rgb), 0.15);
          transform: translateY(-3px);
        }
        .expense-row {
          position: relative;
          transition: background 150ms ease;
          border-radius: 12px;
        }
        .expense-row:hover {
          background: color-mix(in srgb, var(--primary) 5%, var(--bg-card));
        }
        .expense-row-actions {
          position: absolute;
          top: 50%; right: 1rem;
          transform: translateY(-50%);
          display: flex; gap: 6px;
          opacity: 0; pointer-events: none;
          transition: opacity 150ms ease;
        }
        .expense-row:hover .expense-row-actions {
          opacity: 1; pointer-events: auto;
        }
        .risk-bar-fill {
          transition: width 16ms linear;
        }
        .pulsing-dot {
          animation: badge-pulse 2s ease-in-out infinite;
        }
        .logo-glow-ring {
          animation: logo-glow-ring 2.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-glass-card { transition: none; }
          .pulsing-dot, .logo-glow-ring { animation: none; }
          .risk-bar-fill { transition: none; }
        }
      `}</style>

      {/* ── Animated gradient mesh background ── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(135deg, var(--bg-page) 0%, color-mix(in srgb, var(--primary) 4%, var(--bg-page)) 40%, color-mix(in srgb, var(--accent) 3%, var(--bg-page)) 70%, var(--bg-page) 100%)",
          backgroundSize: "400% 400%",
          animation: "mesh-drift 18s ease infinite",
          pointerEvents: "none",
        }}
      />

      <div className="container max-w-6xl py-6 md:py-8 space-y-8">
        {/* ── Active alert banners ── */}
        {!alertsLoading &&
          activeAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.category}
              className="flex items-start gap-3 px-4 py-3 rounded-xl animate-fade-up"
              style={{
                background:
                  "color-mix(in srgb, var(--warning) 12%, var(--bg-card))",
                border:
                  "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
                color: "var(--text-body)",
              }}
              data-ocid={`home.alert_banner.${alert.category}`}
            >
              <AlertTriangle
                className="h-4 w-4 flex-shrink-0 mt-0.5"
                style={{ color: "var(--warning)" }}
              />
              <span className="flex-1 text-sm">
                <strong>{alert.category}</strong> — Spending limit reached (₹
                {alert.spent.toFixed(0)} / ₹{alert.threshold.toFixed(0)})
              </span>
              <button
                type="button"
                aria-label="Dismiss alert"
                onClick={() => handleDismissAlert(alert.category)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

        {/* ── Hero ── */}
        <div className="text-center pt-8 pb-4">
          <div className="flex justify-center mb-5">
            <div
              className="logo-glow-ring"
              style={{
                borderRadius: "50%",
                padding: 8,
                border: "2px solid var(--primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
                alt="ExpenseLeak AI logo"
                className="w-24 h-auto object-contain"
              />
            </div>
          </div>
          <p
            className="text-base mb-2 animate-hero-sub"
            style={{ color: "var(--text-muted)", minHeight: "1.5rem" }}
          >
            {greetingDisplayed}
          </p>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold font-bricolage animate-hero-title px-4 mb-3"
            style={{ color: "var(--primary)" }}
          >
            Welcome to ExpenseLeak AI
          </h1>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto px-4 mb-7 animate-hero-sub"
            style={{ color: "var(--text-muted)" }}
          >
            AI-powered budget advisor, risk analysis, spending monitor &amp;
            personality insights — all in Indian Rupees.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center px-4 animate-hero-cta">
            <Button
              size="lg"
              onClick={() => navigate({ to: "/add-expense" })}
              className="w-full sm:w-auto"
              style={{
                background: "var(--primary)",
                border: "none",
                color: "white",
              }}
              data-ocid="home.primary_button"
            >
              + Add Expense
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate({ to: "/chat" })}
              className="w-full sm:w-auto"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-body)",
              }}
              data-ocid="home.secondary_button"
            >
              Chat with ASHH
            </Button>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Expenses"
            icon={
              <TrendingUp
                className="h-4 w-4"
                style={{ color: "var(--primary)" }}
              />
            }
            iconBg="color-mix(in srgb, var(--primary) 15%, var(--bg-card))"
            delay={0}
            footer="All-time spending"
          >
            <AnimatedRupee
              value={summary?.total ?? 0}
              loading={summaryLoading}
            />
          </StatCard>

          <StatCard
            label="This Month"
            icon={
              <PieChart
                className="h-4 w-4"
                style={{ color: "var(--success)" }}
              />
            }
            iconBg="color-mix(in srgb, var(--success) 15%, var(--bg-card))"
            delay={80}
            footer={
              expensesLoading
                ? ""
                : `${
                    (expenses ?? []).filter((e) => {
                      const d =
                        typeof e.date === "bigint"
                          ? new Date(Number(e.date) / 1_000_000)
                          : new Date(e.date);
                      const now = new Date();
                      return (
                        d.getMonth() === now.getMonth() &&
                        d.getFullYear() === now.getFullYear()
                      );
                    }).length
                  } transactions`
            }
          >
            <AnimatedRupee value={thisMonth} loading={expensesLoading} />
          </StatCard>

          <StatCard
            label="Total Transactions"
            icon={
              <BarChart2
                className="h-4 w-4"
                style={{ color: "var(--accent)" }}
              />
            }
            iconBg="color-mix(in srgb, var(--accent) 15%, var(--bg-card))"
            delay={160}
            footer="All recorded"
          >
            <AnimatedCount value={totalExpenses} loading={expensesLoading} />
          </StatCard>

          <StatCard
            label="Top Category"
            icon={
              <Sparkles
                className="h-4 w-4"
                style={{ color: "var(--warning)" }}
              />
            }
            iconBg="color-mix(in srgb, var(--warning) 15%, var(--bg-card))"
            delay={240}
            footer={
              categoryStats?.[0]
                ? formatCurrency(categoryStats[0][1])
                : "No data"
            }
          >
            {statsLoading ? (
              <Skeleton
                className="h-9 w-24"
                style={{ background: "var(--bg-muted)" }}
              />
            ) : (
              <span
                className="text-2xl font-bold flex items-center gap-2"
                style={{ color: "var(--text-heading)" }}
              >
                <span style={{ fontSize: "1.5rem" }}>
                  {CATEGORY_ICONS[
                    (categoryStats?.[0]?.[0] ?? "Other") as ExpenseCategory
                  ] ?? "📦"}
                </span>
                <span className="text-xl">
                  {categoryStats?.[0]?.[0] ?? "N/A"}
                </span>
              </span>
            )}
          </StatCard>
        </div>

        {/* ── Risk + Personality + Budget row ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Risk Meter */}
          <div
            className="stat-glass-card animate-fade-up"
            style={{ animationDelay: "0ms" }}
            data-ocid="home.risk_meter_card"
          >
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Spending Risk
              </p>
              <img
                src="/assets/generated/risk-meter-icon-transparent.dim_64x64.png"
                alt="risk"
                className="h-6 w-6 opacity-80"
              />
            </div>
            {riskLoading ? (
              <Skeleton
                className="h-20 w-full"
                style={{ background: "var(--bg-muted)" }}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="pulsing-dot"
                    style={{ color: RISK_COLORS[riskKey] }}
                  >
                    {RISK_ICONS[riskKey]}
                  </div>
                  <div>
                    <span
                      className="text-2xl font-bold"
                      style={{ color: RISK_COLORS[riskKey] }}
                    >
                      {riskKey} Risk
                    </span>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Score: {Math.round(animatedRisk)}/100
                    </p>
                  </div>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full risk-bar-fill"
                    style={{
                      width: `${animatedRisk}%`,
                      background: RISK_COLORS[riskKey],
                      boxShadow: `0 0 6px ${RISK_COLORS[riskKey]}`,
                    }}
                  />
                </div>
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>
            )}
          </div>

          {/* Spending Personality */}
          <div
            className="stat-glass-card animate-fade-up"
            style={{ animationDelay: "80ms" }}
            data-ocid="home.personality_card"
          >
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Spending Personality
              </p>
              <img
                src="/assets/generated/personality-tag-icon-transparent.dim_64x64.png"
                alt="personality"
                className="h-6 w-6 opacity-80"
              />
            </div>
            {personalityLoading ? (
              <Skeleton
                className="h-20 w-full"
                style={{ background: "var(--bg-muted)" }}
              />
            ) : (
              <div className="space-y-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${personalityMeta.color} 12%, var(--bg-card))`,
                    border: `1px solid color-mix(in srgb, ${personalityMeta.color} 30%, transparent)`,
                  }}
                >
                  <span className="text-2xl">{personalityMeta.icon}</span>
                  <span
                    className="font-bold text-base"
                    style={{ color: personalityMeta.color }}
                  >
                    {personalityMeta.label}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Your financial behavior profile
                </p>
              </div>
            )}
          </div>

          {/* Budget Status */}
          <div
            className="stat-glass-card animate-fade-up"
            style={{ animationDelay: "160ms" }}
            data-ocid="home.budget_card"
          >
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Budget Status
              </p>
              <img
                src="/assets/generated/budget-advisor-icon-transparent.dim_64x64.png"
                alt="budget"
                className="h-6 w-6 opacity-80"
              />
            </div>
            {budgetLoading ? (
              <Skeleton
                className="h-20 w-full"
                style={{ background: "var(--bg-muted)" }}
              />
            ) : !budget || budget.budget === 0 ? (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Set a monthly budget in your profile to track progress.
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="relative flex-shrink-0"
                  style={{ width: 88, height: 88 }}
                >
                  <BudgetRing percentage={pct} />
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ transform: "rotate(0deg)" }}
                  >
                    <span
                      className="text-base font-bold"
                      style={{
                        color:
                          pct >= 100
                            ? "var(--danger)"
                            : pct >= 80
                              ? "var(--warning)"
                              : "var(--success)",
                      }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-heading)" }}
                  >
                    {formatCurrency(budget.spent)} spent
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    of {formatCurrency(budget.budget)} budget
                  </p>
                  <p
                    className="text-xs mt-1 font-medium"
                    style={{
                      color:
                        pct >= 100
                          ? "var(--danger)"
                          : pct >= 80
                            ? "var(--warning)"
                            : "var(--success)",
                    }}
                  >
                    {pct >= 100
                      ? `₹${(budget.spent - budget.budget).toLocaleString("en-IN")} over`
                      : `₹${budget.remaining.toLocaleString("en-IN")} remaining`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Alert summary quick card ── */}
        {!alertsLoading && (alertsData?.length ?? 0) > 0 && (
          <div
            className="stat-glass-card animate-fade-up flex items-center justify-between gap-4"
            data-ocid="home.alerts_summary"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    "color-mix(in srgb, var(--warning) 15%, var(--bg-card))",
                }}
              >
                <Bell className="h-4 w-4" style={{ color: "var(--warning)" }} />
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  {activeAlerts.length > 0
                    ? `${activeAlerts.length} Active Alert${activeAlerts.length > 1 ? "s" : ""}`
                    : "All Clear"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {activeAlerts.length > 0
                    ? "Category spending alerts"
                    : "Within spending limits"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/insights" })}
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-body)",
                background: "var(--bg-card)",
              }}
            >
              Configure <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Recent Expenses ── */}
        <div
          className="animate-fade-up stagger-1"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-semibold font-bricolage"
                style={{ color: "var(--text-heading)" }}
              >
                Recent Expenses
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Your latest transactions — hover to edit or delete
              </p>
            </div>
            {recentExpenses.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/history" })}
                data-ocid="expenses.view_all_button"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  background: "var(--bg-card)",
                  fontSize: "0.75rem",
                }}
              >
                View All
              </Button>
            )}
          </div>

          <div className="px-6 pb-5">
            {expensesLoading ? (
              <div className="space-y-3 pt-3">
                {(["sk1", "sk2", "sk3", "sk4"] as const).map((k) => (
                  <Skeleton
                    key={k}
                    className="h-14 w-full"
                    style={{ background: "var(--bg-muted)", borderRadius: 10 }}
                  />
                ))}
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="pt-4">
                <EmptyExpenseState />
              </div>
            ) : (
              <div className="space-y-2 pt-3">
                {recentExpenses.map((expense, idx) => {
                  const catColor =
                    CATEGORY_COLORS[expense.category] ?? "var(--primary)";
                  const isMenuOpen = mobileMenuOpen === String(expense.id);
                  return (
                    <div
                      key={expense.id}
                      className="expense-row"
                      data-ocid={`expenses.item.${idx + 1}`}
                      style={{
                        padding: "0.75rem 9rem 0.75rem 0.75rem",
                        border: "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                          style={{
                            background: `color-mix(in srgb, ${catColor} 15%, var(--bg-card))`,
                          }}
                        >
                          {CATEGORY_ICONS[
                            expense.category as ExpenseCategory
                          ] ?? "📦"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="font-medium truncate"
                            style={{ color: "var(--text-heading)" }}
                          >
                            {expense.merchant}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: `color-mix(in srgb, ${catColor} 15%, var(--bg-card))`,
                                color: catColor,
                              }}
                            >
                              {expense.category}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {formatDate(expense.date)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 mr-2">
                          <p
                            className="font-semibold"
                            style={{ color: "var(--primary)" }}
                          >
                            {formatCurrency(
                              typeof expense.amount === "number"
                                ? expense.amount
                                : Number(expense.amount) || 0,
                            )}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {expense.paymentMethod}
                          </p>
                        </div>
                      </div>

                      {/* Desktop hover actions */}
                      <div className="expense-row-actions">
                        <button
                          type="button"
                          aria-label="Edit expense"
                          data-ocid={`expenses.edit_button.${idx + 1}`}
                          onClick={() => setEditingExpense(expense)}
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--primary)",
                            borderRadius: 6,
                            color: "var(--primary)",
                            cursor: "pointer",
                            padding: "4px 10px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          aria-label="Delete expense"
                          data-ocid={`expenses.delete_button.${idx + 1}`}
                          onClick={() => setDeletingExpense(expense)}
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--danger)",
                            borderRadius: 6,
                            color: "var(--danger)",
                            cursor: "pointer",
                            padding: "4px 10px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>

                      {/* Mobile 3-dot menu */}
                      <div className="expense-mobile-menu md:hidden absolute top-2 right-2">
                        <button
                          type="button"
                          aria-label="More options"
                          onClick={() =>
                            setMobileMenuOpen(
                              isMenuOpen ? null : String(expense.id),
                            )
                          }
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px 8px",
                            fontSize: "1rem",
                          }}
                        >
                          ⋮
                        </button>
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden"
                            style={{
                              background: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              boxShadow: "var(--shadow-lg)",
                              minWidth: 120,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpense(expense);
                                setMobileMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                              style={{ color: "var(--primary)" }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingExpense(expense);
                                setMobileMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                              style={{ color: "var(--danger)" }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {recentExpenses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/history" })}
                  data-ocid="expenses.secondary_button"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-body)",
                  }}
                >
                  View All Expenses
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/analytics" })}
                  data-ocid="home.analytics.card"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-body)",
                  }}
                >
                  Analytics
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Action Cards ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              to: "/insights",
              icon: (
                <Sparkles
                  className="h-5 w-5"
                  style={{ color: "var(--primary)" }}
                />
              ),
              iconBg: "color-mix(in srgb, var(--primary) 15%, var(--bg-card))",
              title: "AI Insights",
              desc: "Budget advisor, risk meter, spending monitor & personality",
              arrowColor: "var(--primary)",
              ocid: "home.insights.card",
              delay: 0,
            },
            {
              to: "/analytics",
              icon: (
                <BarChart2
                  className="h-5 w-5"
                  style={{ color: "var(--success)" }}
                />
              ),
              iconBg: "color-mix(in srgb, var(--success) 15%, var(--bg-card))",
              title: "Analytics",
              desc: "Visualize your spending patterns with interactive charts",
              arrowColor: "var(--success)",
              ocid: "home.analytics_card",
              delay: 100,
            },
            {
              to: "/chat",
              icon: (
                <MessageCircle
                  className="h-5 w-5"
                  style={{ color: "#a855f7" }}
                />
              ),
              iconBg: "color-mix(in srgb, #a855f7 15%, var(--bg-card))",
              title: "AI Assistant (ASHH)",
              desc: "Chat about budgets, risks, alerts & personalized finance",
              arrowColor: "#a855f7",
              ocid: "home.chat.card",
              delay: 200,
            },
          ].map((card) => (
            <button
              type="button"
              key={card.to}
              className="stat-glass-card text-left cursor-pointer group animate-fade-up"
              onClick={() => navigate({ to: card.to as "/" })}
              style={{ animationDelay: `${card.delay}ms` }}
              data-ocid={card.ocid}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: card.iconBg }}
              >
                {card.icon}
              </div>
              <h3
                className="font-semibold mb-1"
                style={{ color: "var(--text-heading)" }}
              >
                {card.title}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {card.desc}
              </p>
              <div className="flex justify-end mt-3">
                <ChevronRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: card.arrowColor }}
                />
              </div>
            </button>
          ))}
        </div>

        {/* ── Category breakdown mini strip ── */}
        {(categoryStats?.length ?? 0) > 0 && (
          <div
            className="stat-glass-card animate-fade-up"
            data-ocid="home.category_breakdown"
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                Category Breakdown
              </h3>
              <TrendingDown
                className="h-4 w-4"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
            <div className="space-y-2">
              {(categoryStats ?? []).slice(0, 5).map(([cat, amt]) => {
                const total = (categoryStats ?? []).reduce(
                  (s, [, a]) => s + a,
                  0,
                );
                const pctVal = total > 0 ? (amt / total) * 100 : 0;
                const color = CATEGORY_COLORS[cat] ?? "var(--primary)";
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span
                        className="flex items-center gap-1.5"
                        style={{ color: "var(--text-body)" }}
                      >
                        <span>
                          {CATEGORY_ICONS[cat as ExpenseCategory] ?? "📦"}
                        </span>
                        {cat}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatCurrency(amt)} · {pctVal.toFixed(0)}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pctVal}%`,
                          background: color,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer
          className="text-center text-xs pt-4 pb-2"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border)",
          }}
        >
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary)" }}
          >
            Built with ❤️ using caffeine.ai
          </a>
        </footer>
      </div>

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {deletingExpense && (
        <DeleteConfirmModal
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </PageTransition>
  );
}
