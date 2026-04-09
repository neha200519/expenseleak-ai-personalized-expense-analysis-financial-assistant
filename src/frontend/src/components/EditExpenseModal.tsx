import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateExpense } from "../hooks/useQueries";
import type { Expense } from "../types/backend-types";

const CATEGORIES = [
  "Food",
  "Entertainment",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Travel",
  "Other",
];
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "NetBanking", "Other"];

function getCategoryStr(category: Expense["category"]): string {
  if (typeof category === "string") return category;
  return Object.keys(category)[0] || "Other";
}

function getPaymentStr(pm: Expense["paymentMethod"]): string {
  if (typeof pm === "string") return pm;
  return Object.keys(pm)[0] || "Cash";
}

function parseDateToInputValue(date: string | bigint): string {
  try {
    if (typeof date === "bigint") {
      const d = new Date(Number(date) / 1_000_000);
      return d.toISOString().split("T")[0];
    }
    // Already a date string like "2024-08-20"
    const d = new Date(date);
    if (Number.isNaN(d.getTime()))
      return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch (_e) {
    return new Date().toISOString().split("T")[0];
  }
}

interface EditExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
}

export default function EditExpenseModal({
  expense,
  onClose,
}: EditExpenseModalProps) {
  const updateExpense = useUpdateExpense();
  const backdropRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setMerchant(expense.merchant);
      setDate(parseDateToInputValue(expense.date));
      setCategory(getCategoryStr(expense.category));
      setPaymentMethod(getPaymentStr(expense.paymentMethod));
      setNote(expense.note || "");
      requestAnimationFrame(() => setVisible(true));
      setTimeout(() => firstInputRef.current?.focus(), 200);
    } else {
      setVisible(false);
    }
  }, [expense]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!expense) return;
      if (e.key === "Escape") handleClose();
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

  const hasChanges = () => {
    if (!expense) return false;
    return (
      Number(amount) !== expense.amount ||
      merchant !== expense.merchant ||
      date !== parseDateToInputValue(expense.date) ||
      category !== getCategoryStr(expense.category) ||
      paymentMethod !== getPaymentStr(expense.paymentMethod) ||
      note !== (expense.note || "")
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!expense || !hasChanges()) return;

    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await updateExpense.mutateAsync({
        id: expense.id,
        updates: {
          amount: parsedAmount,
          merchant: merchant.trim() || "Unknown Merchant",
          date,
          category,
          paymentMethod,
          note: note.trim(),
        },
      });
      toast.success("Expense updated successfully", { duration: 2000 });
      handleClose();
    } catch (_err) {
      toast.error("Failed to update expense");
    }
  };

  if (!expense) return null;

  return (
    <>
      <style>{`
        @keyframes backdropFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes backdropFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalSlideDown { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal-backdrop.entering { animation: backdropFadeIn 200ms ease forwards; }
        .modal-backdrop.exiting { animation: backdropFadeOut 200ms ease forwards; }
        .modal-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; z-index: 9999; }
        .modal-card.entering { animation: modalSlideUp 200ms ease forwards; }
        .modal-card.exiting { animation: modalSlideDown 200ms ease forwards; }
        .modal-input { background: var(--bg-muted) !important; border: 1px solid var(--border) !important; color: var(--text-body) !important; border-radius: 8px; transition: border-color 0.15s ease; }
        .modal-input:focus { border-color: var(--primary) !important; outline: none !important; box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent) !important; }
        .modal-select { background: var(--bg-muted); border: 1px solid var(--border); color: var(--text-body); border-radius: 8px; padding: 0.5rem 0.75rem; width: 100%; font-size: 0.875rem; transition: border-color 0.15s ease; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2rem; }
        .modal-select:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent); }
        .modal-label { color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; display: block; }
      `}</style>

      <div
        ref={backdropRef}
        className={`modal-backdrop ${visible ? "entering" : "exiting"}`}
        onClick={handleBackdropClick}
        onKeyDown={(e) => e.key === "Escape" && handleClose()}
        role="presentation"
        data-ocid="edit_expense.modal"
      >
        <div className={`modal-card ${visible ? "entering" : "exiting"}`}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.25rem 1.5rem 1rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <h2
                style={{
                  color: "var(--text-h)",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Edit Expense
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  margin: "0.25rem 0 0",
                }}
              >
                {expense.merchant}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close modal"
              data-ocid="edit_expense.close_button"
              onClick={handleClose}
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
                transition: "background 0.15s, color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-body)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-muted)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-muted)";
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ padding: "1.25rem 1.5rem 1.5rem" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              {/* Amount */}
              <div style={{ gridColumn: "1 / 2" }}>
                <label className="modal-label" htmlFor="edit-amount">
                  Amount (₹)
                </label>
                <Input
                  id="edit-amount"
                  ref={firstInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="modal-input"
                  placeholder="0.00"
                  data-ocid="edit_expense.input"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  required
                />
              </div>

              {/* Date */}
              <div style={{ gridColumn: "2 / 3" }}>
                <label className="modal-label" htmlFor="edit-date">
                  Date
                </label>
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="modal-input"
                  data-ocid="edit_expense.input"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>

              {/* Merchant */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="modal-label" htmlFor="edit-merchant">
                  Merchant
                </label>
                <Input
                  id="edit-merchant"
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="modal-input"
                  placeholder="e.g. Swiggy, Amazon"
                  data-ocid="edit_expense.input"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>

              {/* Category */}
              <div>
                <label className="modal-label" htmlFor="edit-category">
                  Category
                </label>
                <select
                  id="edit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="modal-select"
                  data-ocid="edit_expense.select"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="modal-label" htmlFor="edit-payment">
                  Payment Method
                </label>
                <select
                  id="edit-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="modal-select"
                  data-ocid="edit_expense.select"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="modal-label" htmlFor="edit-note">
                  Note
                </label>
                <Textarea
                  id="edit-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="modal-input"
                  placeholder="Optional note..."
                  rows={3}
                  data-ocid="edit_expense.textarea"
                  style={{ resize: "none" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "1.25rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                data-ocid="edit_expense.cancel_button"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-body)",
                  borderRadius: 8,
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.15s",
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
                type="submit"
                disabled={!hasChanges() || updateExpense.isPending}
                data-ocid="edit_expense.save_button"
                style={{
                  background: hasChanges()
                    ? "var(--primary)"
                    : "var(--bg-muted)",
                  border: "none",
                  color: hasChanges()
                    ? "var(--text-on-primary, #fff)"
                    : "var(--text-muted)",
                  borderRadius: 8,
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: hasChanges() ? "pointer" : "not-allowed",
                  transition: "background 0.15s, opacity 0.15s",
                  opacity: updateExpense.isPending ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {updateExpense.isPending ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid currentColor",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.6s linear infinite",
                      }}
                    />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
