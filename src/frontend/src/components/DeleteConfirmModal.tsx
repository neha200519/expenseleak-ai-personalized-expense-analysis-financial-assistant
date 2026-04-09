import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDeleteExpense } from "../hooks/useQueries";
import type { Expense } from "../types/backend-types";

function formatDateStr(date: string | bigint): string {
  try {
    if (typeof date === "bigint") {
      return new Date(Number(date) / 1_000_000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (_e) {
    return String(date);
  }
}

function formatINR(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

interface DeleteConfirmModalProps {
  expense: Expense | null;
  onClose: () => void;
}

export default function DeleteConfirmModal({
  expense,
  onClose,
}: DeleteConfirmModalProps) {
  const deleteExpense = useDeleteExpense();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (expense) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [expense]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!expense) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "Enter") handleConfirm();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expense]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) handleClose();
  };

  const handleConfirm = async () => {
    if (!expense) return;
    const snapshot = { ...expense };

    try {
      await deleteExpense.mutateAsync(expense.id);
      handleClose();
      toast("Expense deleted", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            // Re-save to localStorage only (backend undo not supported)
            const LS_KEYS = [
              "expenses",
              "expenseData",
              "userExpenses",
              "el-expenses",
              "expensesList",
            ];
            const entry = {
              id: String(snapshot.id),
              amount: snapshot.amount,
              merchant: snapshot.merchant,
              category: snapshot.category,
              paymentMethod: snapshot.paymentMethod,
              date: snapshot.date,
              note: snapshot.note,
              source: snapshot.source,
            };
            for (const key of LS_KEYS) {
              try {
                const list = JSON.parse(localStorage.getItem(key) || "[]");
                if (Array.isArray(list)) {
                  list.unshift(entry);
                  localStorage.setItem(key, JSON.stringify(list));
                }
              } catch (_e) {
                // ignore
              }
            }
            window.dispatchEvent(
              new CustomEvent("expenseAdded", { detail: entry }),
            );
            toast.success("Expense restored", { duration: 2000 });
          },
        },
      });
    } catch (_err) {
      toast.error("Failed to delete expense");
    }
  };

  if (!expense) return null;

  return (
    <>
      <style>{`
        @keyframes deleteBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes deleteBackdropOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes deleteCardIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes deleteCardOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(12px) scale(0.97); } }
        .delete-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9998; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .delete-backdrop.entering { animation: deleteBackdropIn 200ms ease forwards; }
        .delete-backdrop.exiting { animation: deleteBackdropOut 200ms ease forwards; }
        .delete-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; max-width: 420px; width: 100%; padding: 1.75rem; text-align: center; }
        .delete-card.entering { animation: deleteCardIn 200ms ease forwards; }
        .delete-card.exiting { animation: deleteCardOut 200ms ease forwards; }
      `}</style>

      <div
        ref={backdropRef}
        className={`delete-backdrop ${visible ? "entering" : "exiting"}`}
        onClick={handleBackdropClick}
        onKeyDown={(e) => e.key === "Escape" && handleClose()}
        role="presentation"
        data-ocid="delete_expense.dialog"
      >
        <div className={`delete-card ${visible ? "entering" : "exiting"}`}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
              border:
                "2px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}
          >
            <Trash2 size={24} style={{ color: "var(--danger)" }} />
          </div>

          <h3
            style={{
              color: "var(--text-h)",
              fontSize: "1.125rem",
              fontWeight: 700,
              margin: "0 0 0.5rem",
            }}
          >
            Delete this expense?
          </h3>

          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              margin: "0 0 1.5rem",
            }}
          >
            This will permanently remove{" "}
            <strong style={{ color: "var(--text-body)" }}>
              {formatINR(expense.amount)}
            </strong>{" "}
            at{" "}
            <strong style={{ color: "var(--text-body)" }}>
              {expense.merchant}
            </strong>{" "}
            on{" "}
            <strong style={{ color: "var(--text-body)" }}>
              {formatDateStr(expense.date)}
            </strong>
            . This cannot be undone.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              data-ocid="delete_expense.cancel_button"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border)",
                color: "var(--text-body)",
                borderRadius: 8,
                padding: "0.6rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s",
                minWidth: 90,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-muted)";
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleteExpense.isPending}
              data-ocid="delete_expense.delete_button"
              style={{
                background: "var(--danger)",
                border: "none",
                color: "var(--text-on-primary)",
                borderRadius: 8,
                padding: "0.6rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: deleteExpense.isPending ? "not-allowed" : "pointer",
                transition: "background 0.15s, opacity 0.15s",
                opacity: deleteExpense.isPending ? 0.7 : 1,
                minWidth: 90,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
              onMouseEnter={(e) => {
                if (!deleteExpense.isPending)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "color-mix(in srgb, var(--danger) 80%, black)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--danger)";
              }}
            >
              {deleteExpense.isPending ? (
                <>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      border: "2px solid var(--text-on-primary)",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} /> Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
