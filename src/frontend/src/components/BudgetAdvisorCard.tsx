import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetBudgetStatus } from "../hooks/useQueries";

/** Animated SVG circular ring for budget fill. */
function CircularProgress({ percentage }: { percentage: number }) {
  const clamped = Math.min(percentage, 100);
  const r = 44;
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
    <div className="relative" style={{ width: 108, height: 108 }}>
      <svg
        width="108"
        height="108"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="9"
        />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 16ms linear",
            filter: `drop-shadow(0 0 5px ${strokeColor})`,
          }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-live="polite"
      >
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: strokeColor }}
        >
          {Math.round(animated)}%
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          used
        </span>
      </div>
    </div>
  );
}

export default function BudgetAdvisorCard() {
  const { data: budgetStatus, isLoading } = useGetBudgetStatus();

  const percentage = budgetStatus?.percentage ?? 0;
  const status =
    percentage >= 100 ? "Exceeded" : percentage >= 80 ? "Warning" : "OnTrack";

  const statusConfig = {
    OnTrack: { label: "On Track", color: "var(--success)", Icon: TrendingDown },
    Warning: { label: "Warning", color: "var(--warning)", Icon: AlertCircle },
    Exceeded: { label: "Exceeded", color: "var(--danger)", Icon: TrendingUp },
  }[status];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        boxShadow: "var(--shadow-card)",
      }}
      data-ocid="insights.budget_advisor_card"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📊</span>
        <div>
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--text-heading)" }}
          >
            Smart Budget Advisor
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            AI-powered budget monitoring
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton
            className="h-24 w-full"
            style={{ background: "var(--bg-muted)" }}
          />
          <Skeleton
            className="h-4 w-3/4"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      ) : !budgetStatus || budgetStatus.budget === 0 ? (
        <div className="text-center py-6 space-y-2">
          <AlertCircle
            className="h-10 w-10 mx-auto"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Set a monthly budget in your profile to enable tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Ring + stats */}
          <div className="flex items-center gap-5">
            <CircularProgress percentage={percentage} />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <statusConfig.Icon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: statusConfig.color }}
                />
                <span
                  className="font-bold text-base"
                  style={{ color: statusConfig.color }}
                >
                  {statusConfig.label}
                </span>
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-heading)" }}
              >
                {formatCurrency(budgetStatus.spent)}
                <span
                  className="font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  {" "}
                  of {formatCurrency(budgetStatus.budget)}
                </span>
              </p>
              <p className="text-xs" style={{ color: statusConfig.color }}>
                {status === "Exceeded"
                  ? `${formatCurrency(budgetStatus.spent - budgetStatus.budget)} over budget`
                  : `${formatCurrency(budgetStatus.remaining)} remaining`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div
              className="flex items-center justify-between text-xs mb-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              <span>₹0</span>
              <span>{formatCurrency(budgetStatus.budget)}</span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 8, background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(percentage, 100)}%`,
                  background: statusConfig.color,
                  boxShadow: `0 0 6px ${statusConfig.color}`,
                  transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
