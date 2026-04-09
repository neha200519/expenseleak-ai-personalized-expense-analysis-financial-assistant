import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Receipt } from "lucide-react";

interface EmptyExpenseStateProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCta?: () => void;
  Icon?: LucideIcon;
}

export default function EmptyExpenseState({
  title = "No expenses yet",
  subtitle = "Add your first expense using the Add Expense page",
  ctaLabel = "Add Expense",
  ctaTo = "/add-expense",
  onCta,
  Icon = Receipt,
}: EmptyExpenseStateProps) {
  const navigate = useNavigate();

  const handleCta = () => {
    if (onCta) {
      onCta();
    } else {
      navigate({ to: ctaTo as "/" });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2rem",
        textAlign: "center",
        animation: "emptyFadeIn 0.4s ease-out both",
      }}
      data-ocid="expenses.empty_state"
    >
      <style>{`
        @keyframes emptyFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Icon
        size={48}
        style={{
          color: "var(--text-muted)",
          marginBottom: "1.25rem",
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      <h3
        style={{
          color: "var(--text-h)",
          fontSize: "1.1rem",
          fontWeight: 600,
          margin: "0 0 0.5rem",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          maxWidth: 320,
          lineHeight: 1.6,
          margin: "0 0 1.5rem",
        }}
      >
        {subtitle}
      </p>
      <button
        type="button"
        onClick={handleCta}
        data-ocid="expenses.primary_button"
        style={{
          background: "var(--primary)",
          border: "none",
          color: "var(--text-on-primary, #fff)",
          borderRadius: 8,
          padding: "0.625rem 1.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
