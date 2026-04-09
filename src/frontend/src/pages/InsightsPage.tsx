import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Bell,
  Brain,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import BudgetAdvisorCard from "../components/BudgetAdvisorCard";
import EmptyExpenseState from "../components/EmptyExpenseState";
import NotificationSetup from "../components/NotificationSetup";
import PageTransition from "../components/PageTransition";
import PersonalityTagCard from "../components/PersonalityTagCard";
import RiskMeterCard from "../components/RiskMeterCard";
import SpendingMonitorCard from "../components/SpendingMonitorCard";
import { useGenerateInsights, useGetSpendingAlerts } from "../hooks/useQueries";

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔",
  Entertainment: "🎬",
  Transport: "🚗",
  Bills: "📄",
  Shopping: "🛍️",
  Health: "🏥",
  Travel: "✈️",
  Other: "📦",
};

export default function InsightsPage() {
  const { data: insights, isLoading: insightsLoading } = useGenerateInsights();
  const { data: alerts, isLoading: alertsLoading } = useGetSpendingAlerts();

  const activeAlerts = alerts?.filter((a) => a.status === "Active") ?? [];

  return (
    <PageTransition>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressReveal {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .insight-section {
          animation: fadeUp 0.4s ease-out both;
        }
        .insight-section:nth-child(1) { animation-delay: 0ms; }
        .insight-section:nth-child(2) { animation-delay: 80ms; }
        .insight-section:nth-child(3) { animation-delay: 160ms; }
        .insight-section:nth-child(4) { animation-delay: 240ms; }
        .insight-section:nth-child(5) { animation-delay: 320ms; }
        .insight-section:nth-child(6) { animation-delay: 400ms; }
        .insight-section:nth-child(7) { animation-delay: 480ms; }
        .insight-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .insight-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-hover);
        }
        .alert-progress {
          transform-origin: left;
          animation: progressReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .insight-section, .alert-progress, .insight-card {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div
        style={{
          background: "var(--bg-page)",
          minHeight: "100vh",
          padding: "2rem 1rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Hero header */}
          <div
            className="insight-section"
            style={{
              textAlign: "center",
              marginBottom: "2rem",
              padding: "2rem",
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background:
                  "color-mix(in srgb, var(--primary) 12%, var(--bg-card))",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <Brain size={32} style={{ color: "var(--primary)" }} />
            </div>
            <h1
              style={{
                color: "var(--text-h)",
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 800,
                margin: "0 0 0.5rem",
              }}
            >
              AI-Powered Insights
            </h1>
            <p
              style={{
                color: "var(--text-muted)",
                margin: 0,
                fontSize: "0.95rem",
              }}
            >
              Personalized analysis and recommendations based on your spending
              patterns
            </p>
          </div>

          {/* Budget Advisor + Risk Meter — side by side on large screens */}
          <div
            className="insight-section"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.25rem",
            }}
          >
            <BudgetAdvisorCard />
            <RiskMeterCard />
          </div>

          {/* Spending Personality */}
          <div className="insight-section" style={{ marginBottom: "1.25rem" }}>
            <PersonalityTagCard />
          </div>

          {/* Active Alerts section */}
          {(alertsLoading || activeAlerts.length > 0) && (
            <div
              className="insight-section"
              style={{ marginBottom: "1.25rem" }}
            >
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    background:
                      "color-mix(in srgb, #EF4444 6%, var(--bg-card))",
                    borderBottom: "1px solid rgba(239,68,68,0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                  }}
                >
                  <AlertTriangle size={20} style={{ color: "#EF4444" }} />
                  <h2
                    style={{
                      color: "var(--text-h)",
                      fontSize: "1.0625rem",
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    Active Spending Alerts
                  </h2>
                  {activeAlerts.length > 0 && (
                    <span
                      style={{
                        marginLeft: "auto",
                        background: "#EF4444",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "2px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {activeAlerts.length}
                    </span>
                  )}
                </div>
                <div style={{ padding: "1rem 1.25rem" }}>
                  {alertsLoading ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      {activeAlerts.map((alert) => {
                        const pct =
                          alert.threshold > 0
                            ? Math.min(
                                (alert.spent / alert.threshold) * 100,
                                100,
                              )
                            : 0;
                        const isOver = alert.spent >= alert.threshold;
                        const barColor = isOver ? "#EF4444" : "#F59E0B";
                        return (
                          <div
                            key={alert.category}
                            className="insight-card"
                            style={{
                              background: "var(--bg-secondary)",
                              border: `1px solid ${isOver ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                              borderRadius: 10,
                              padding: "0.875rem 1rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span style={{ fontSize: "1.25rem" }}>
                                  {CATEGORY_ICONS[alert.category] ?? "📦"}
                                </span>
                                <span
                                  style={{
                                    color: "var(--text-body)",
                                    fontWeight: 600,
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {alert.category}
                                </span>
                              </div>
                              <span
                                style={{
                                  background: isOver
                                    ? "rgba(239,68,68,0.15)"
                                    : "rgba(245,158,11,0.15)",
                                  color: barColor,
                                  borderRadius: 999,
                                  padding: "2px 10px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                }}
                              >
                                {isOver ? "Over Budget" : "Near Limit"}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.375rem",
                              }}
                            >
                              <span>
                                ₹{alert.spent.toLocaleString("en-IN")}
                              </span>
                              <span>
                                ₹{alert.threshold.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div
                              style={{
                                height: 6,
                                background: "var(--bg-muted)",
                                borderRadius: 999,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                className="alert-progress"
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  background: barColor,
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notification Setup */}
          <div className="insight-section" style={{ marginBottom: "1.25rem" }}>
            <NotificationSetup />
          </div>

          {/* Spending Monitor */}
          <div className="insight-section" style={{ marginBottom: "1.25rem" }}>
            <SpendingMonitorCard />
          </div>

          {/* AI Insights list */}
          <div className="insight-section" style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "1rem",
              }}
            >
              <Lightbulb size={22} style={{ color: "var(--primary)" }} />
              <h2
                style={{
                  color: "var(--text-h)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                General Insights
              </h2>
            </div>

            {insightsLoading ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-1" />
                  </div>
                ))}
              </div>
            ) : insights && insights.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {insights.map((insight, index) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
                    key={index}
                    className="insight-card"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderLeft: "4px solid var(--primary)",
                      borderRadius: 12,
                      padding: "1rem 1.25rem",
                      display: "flex",
                      gap: "0.875rem",
                      alignItems: "flex-start",
                    }}
                    data-ocid={`insights.insight_card.${index + 1}`}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background:
                          "color-mix(in srgb, var(--primary) 12%, var(--bg-card))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Lightbulb
                        size={16}
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          margin: "0 0 0.25rem",
                        }}
                      >
                        Insight {index + 1}
                      </p>
                      <p
                        style={{
                          color: "var(--text-body)",
                          fontSize: "0.875rem",
                          margin: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        {insight}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyExpenseState
                Icon={Lightbulb}
                title="No insights yet"
                subtitle="Add more expenses to unlock AI-powered insights"
                ctaLabel="Add Expense"
                ctaTo="/add-expense"
              />
            )}
          </div>

          {/* How it works */}
          <div className="insight-section">
            <div
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 5%, var(--bg-card))",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                borderRadius: 12,
                padding: "1.25rem 1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  marginBottom: "0.875rem",
                }}
              >
                <Sparkles size={18} style={{ color: "var(--primary)" }} />
                <h3
                  style={{
                    color: "var(--text-h)",
                    fontSize: "1rem",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  How AI Insights Work
                </h3>
              </div>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.875rem",
                  margin: "0 0 0.75rem",
                }}
              >
                Our AI analyzes your spending patterns to provide comprehensive
                financial guidance through multiple intelligent modules:
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {[
                  {
                    icon: <TrendingUp size={14} />,
                    title: "Smart Budget Advisor",
                    desc: "Calculates personalized budgets and monitors spending deviations",
                  },
                  {
                    icon: <ShieldCheck size={14} />,
                    title: "Expense Risk Meter",
                    desc: "Assesses spending risk using frequency, totals, and behavioral patterns",
                  },
                  {
                    icon: <Brain size={14} />,
                    title: "Spending Personality",
                    desc: "Identifies your financial behavior type for tailored recommendations",
                  },
                  {
                    icon: <Bell size={14} />,
                    title: "Spending Monitor",
                    desc: "Permission-based alerts when spending approaches category limits",
                  },
                ].map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    style={{
                      display: "flex",
                      gap: "0.625rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--primary)",
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <p
                        style={{
                          color: "var(--text-body)",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          margin: "0 0 2px",
                        }}
                      >
                        {title}
                      </p>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.78rem",
                          margin: 0,
                        }}
                      >
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
