import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetRiskLevel } from "../hooks/useQueries";

const RISK_CONFIG = {
  Low: {
    color: "var(--success)",
    label: "Low Risk",
    score: 18,
    icon: CheckCircle,
    desc: "Your spending patterns are within healthy limits. Keep it up!",
    tip: "Continue tracking expenses to maintain your positive habits.",
  },
  Medium: {
    color: "var(--warning)",
    label: "Medium Risk",
    score: 52,
    icon: AlertCircle,
    desc: "Some spending categories are elevated. Review recent transactions.",
    tip: "Set category limits in Insights to stay on track.",
  },
  High: {
    color: "var(--danger)",
    label: "High Risk",
    score: 82,
    icon: AlertTriangle,
    desc: "High spending risk detected. Immediate budget review recommended.",
    tip: "Use the ASHH assistant for personalized cost-cutting advice.",
  },
};

export default function RiskMeterCard() {
  const { data: riskLevel, isLoading } = useGetRiskLevel();
  const key = (riskLevel ?? "Low") as keyof typeof RISK_CONFIG;
  const cfg = RISK_CONFIG[key] ?? RISK_CONFIG.Low;

  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!riskLevel) return;
    const target = cfg.score;
    const dur = 900;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setAnimatedScore((1 - (1 - p) ** 3) * target);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [riskLevel, cfg.score]);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        boxShadow: "var(--shadow-card)",
      }}
      data-ocid="insights.risk_meter_card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <img
          src="/assets/generated/risk-meter-icon-transparent.dim_64x64.png"
          alt="Risk Meter"
          className="h-8 w-8"
        />
        <div>
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--text-heading)" }}
          >
            Expense Risk Meter
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Real-time spending risk assessment
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton
            className="h-20 w-full"
            style={{ background: "var(--bg-muted)" }}
          />
          <Skeleton
            className="h-3 w-full"
            style={{ background: "var(--bg-muted)" }}
          />
          <Skeleton
            className="h-4 w-2/3"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      ) : (
        <div className="space-y-4 animate-fade-up">
          {/* Risk level badge */}
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: `color-mix(in srgb, ${cfg.color} 10%, var(--bg-card))`,
              border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
            }}
          >
            <cfg.icon
              className="h-8 w-8 flex-shrink-0"
              style={{
                color: cfg.color,
                filter: `drop-shadow(0 0 4px ${cfg.color})`,
              }}
            />
            <div>
              <p className="text-xl font-bold" style={{ color: cfg.color }}>
                {cfg.label}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Risk Score: {Math.round(animatedScore)}/100
              </p>
            </div>
          </div>

          {/* Animated bar */}
          <div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 10, background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${animatedScore}%`,
                  background: cfg.color,
                  boxShadow: `0 0 8px ${cfg.color}`,
                  transition: "width 16ms linear",
                }}
              />
            </div>
            <div
              className="flex justify-between text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm" style={{ color: "var(--text-body)" }}>
            {cfg.desc}
          </p>

          {/* Tip */}
          <div
            className="text-xs px-3 py-2 rounded-lg"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 8%, var(--bg-card))",
              border:
                "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
              color: "var(--text-body)",
            }}
          >
            💡 {cfg.tip}
          </div>
        </div>
      )}
    </div>
  );
}
