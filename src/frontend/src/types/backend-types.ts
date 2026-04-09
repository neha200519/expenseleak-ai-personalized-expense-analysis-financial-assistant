/**
 * Local TypeScript definitions aligned with the generated backend.d.ts interface.
 * These mirror the Motoko backend types for use across the frontend.
 */

// ── Enums (must match backend.d.ts exactly) ───────────────────────────────────

export enum ExpenseCategory {
  Food = "Food",
  Health = "Health",
  Bills = "Bills",
  Travel = "Travel",
  Entertainment = "Entertainment",
  Shopping = "Shopping",
  Other = "Other",
  Transport = "Transport",
}

export enum PaymentMethod {
  UPI = "UPI",
  Card = "Card",
  Cash = "Cash",
  Other = "Other",
  NetBanking = "NetBanking",
}

export enum AlertStatus {
  Active = "Active",
  Dismissed = "Dismissed",
}

export enum RiskLevel {
  Low = "Low",
  High = "High",
  Medium = "Medium",
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface ThemePreference {
  mode: string;
  palette: string;
  customColor?: string;
}

export interface ThemeOption {
  id: string;
  name: string;
  description: string;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  currency: string;
  monthlyBudget: number;
}

export interface UserProfileInput {
  name: string;
  email: string;
  currency: string;
  monthlyBudget: number;
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseInput {
  paymentMethod: PaymentMethod | string;
  source: string;
  date: string;
  note: string;
  merchant: string;
  category: ExpenseCategory | string;
  amount: number;
}

export interface ExpenseUpdateInput {
  paymentMethod?: PaymentMethod | string;
  date?: string;
  note?: string;
  merchant?: string;
  category?: ExpenseCategory | string;
  amount?: number;
}

export interface Expense {
  id: bigint;
  paymentMethod: PaymentMethod | string;
  source: string;
  date: string;
  note: string;
  createdAt: bigint;
  updatedAt?: bigint;
  merchant: string;
  category: ExpenseCategory | string;
  amount: number;
}

export interface ExpenseSummary {
  avgExpense: number;
  total: number;
  count: bigint;
  thisMonthTotal: number;
  thisMonthCount: bigint;
  topCategory: string;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface DocumentMeta {
  id: bigint;
  name: string;
  size: bigint;
  fileType: string;
  uploadedAt: bigint;
}

export interface DocumentMetaInput {
  name: string;
  size: bigint;
  fileType: string;
}

/** Alias for document uploads */
export type DocumentUploadInput = DocumentMetaInput;

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  context: string;
  message: string;
}

export interface ChatResponse {
  response: string;
  timestamp: bigint;
}

export interface ChatEntryInput {
  content: string;
  role: string;
}

export interface ChatEntry {
  id: bigint;
  content: string;
  role: string;
  timestamp: bigint;
}

/** Alias for chat history queries */
export type ChatEntryQuery = ChatEntry;

// ── Budget & Risk ─────────────────────────────────────────────────────────────

export interface BudgetStatus {
  spent: number;
  remaining: number;
  budget: number;
  percentage: number;
}

// ── Spending Monitor ──────────────────────────────────────────────────────────

export interface SpendingAlert {
  status: AlertStatus;
  threshold: number;
  spent: number;
  category: string;
}

export interface SpendingMonitorSettingsView {
  monitoredCategories: string[];
  consentGiven: boolean;
  thresholds: Array<[string, number]>;
}

// ── Insight ───────────────────────────────────────────────────────────────────

/** Backend generateInsights returns string[] */
export type Insight = string;

// ── Color / Theme (UI only) ───────────────────────────────────────────────────

export interface ColorTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  isDark: boolean;
}
