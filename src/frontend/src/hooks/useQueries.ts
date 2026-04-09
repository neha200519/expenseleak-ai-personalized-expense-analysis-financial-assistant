import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { backendInterface } from "../backend.d";
import type {
  BudgetStatus,
  ChatEntry,
  ChatEntryInput,
  ChatRequest,
  DocumentMeta,
  DocumentMetaInput,
  Expense,
  ExpenseInput,
  ExpenseUpdateInput,
  SpendingAlert,
  SpendingMonitorSettingsView,
  ThemeOption,
  ThemePreference,
  UserProfile,
} from "../types/backend-types";
import { useActor as useActorCore } from "./useActor";

function useActor() {
  const result = useActorCore();
  return {
    actor: result.actor as unknown as backendInterface | null,
    isFetching: result.isFetching,
  };
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEYS = [
  "expenses",
  "expenseData",
  "userExpenses",
  "el-expenses",
  "expensesList",
];

function saveExpenseToStorage(expense: Record<string, unknown>): void {
  for (const key of LS_KEYS) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(list)) {
        list.unshift(expense);
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (_e) {
      // ignore
    }
  }
}

function updateExpenseInStorage(
  id: string,
  updates: Record<string, unknown>,
): void {
  for (const key of LS_KEYS) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(list)) continue;
      const idx = list.findIndex(
        (e: Record<string, unknown>) => String(e.id) === String(id),
      );
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (_e) {
      // ignore
    }
  }
}

function deleteExpenseFromStorage(id: string): void {
  for (const key of LS_KEYS) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(list)) continue;
      const filtered = list.filter(
        (e: Record<string, unknown>) => String(e.id) !== String(id),
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (_e) {
      // ignore
    }
  }
}

// ── Invalidate all expense-related queries ────────────────────────────────────
const EXPENSE_QUERY_KEYS = [
  "expenses",
  "expenseSummary",
  "categoryStats",
  "insights",
  "budgetStatus",
  "riskLevel",
  "spendingPersonality",
  "spendingAlerts",
  "spendingMonitorSettings",
];

// ── User Profile ──────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile({
        name: profile.name,
        email: profile.email,
        currency: profile.currency,
        monthlyBudget: profile.monthlyBudget,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export function useGetUserTheme() {
  const { actor, isFetching } = useActor();

  return useQuery<ThemePreference | null>({
    queryKey: ["userTheme"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getUserTheme();
    },
    enabled: !!actor && !isFetching,
    retry: false,
  });
}

export function useSaveUserTheme() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (theme: ThemePreference) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveUserTheme(theme);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userTheme"] });
    },
  });
}

export function useGetAllThemeOptions() {
  const { actor, isFetching } = useActor();

  return useQuery<ThemeOption[]>({
    queryKey: ["themeOptions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllThemeOptions();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export function useListExpenses() {
  const { actor, isFetching } = useActor();

  return useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listExpenses();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddExpense() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!actor) throw new Error("Actor not available");
      const expense = await actor.addExpense(
        input as import("../backend.d").ExpenseInput,
      );
      // Mirror to localStorage for any legacy reads
      const lsEntry = {
        id: String(expense.id),
        amount: expense.amount,
        merchant: expense.merchant,
        category: expense.category,
        paymentMethod: expense.paymentMethod,
        date: expense.date,
        note: expense.note,
        source: expense.source,
        createdAt: new Date().toISOString(),
      };
      saveExpenseToStorage(lsEntry);
      window.dispatchEvent(
        new CustomEvent("expenseAdded", { detail: lsEntry }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "expenses" }));
      return expense;
    },
    onSuccess: () => {
      for (const key of EXPENSE_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useUpdateExpense() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: { id: bigint | string; updates: ExpenseUpdateInput }) => {
      const bigId = typeof id === "bigint" ? id : BigInt(id);
      if (actor) {
        try {
          await actor.updateExpense(
            bigId,
            updates as import("../backend.d").ExpenseUpdateInput,
          );
        } catch (_e) {
          // fallback to localStorage only
        }
      }
      updateExpenseInStorage(String(id), updates as Record<string, unknown>);
      window.dispatchEvent(
        new CustomEvent("expenseUpdated", { detail: { id: String(id) } }),
      );
      return true;
    },
    onSuccess: () => {
      for (const key of EXPENSE_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useDeleteExpense() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint | string) => {
      const bigId = typeof id === "bigint" ? id : BigInt(id);
      if (actor) {
        try {
          await actor.deleteExpense(bigId);
        } catch (_e) {
          // fallback
        }
      }
      deleteExpenseFromStorage(String(id));
      window.dispatchEvent(
        new CustomEvent("expenseDeleted", { detail: { id: String(id) } }),
      );
      return true;
    },
    onSuccess: () => {
      for (const key of EXPENSE_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useGetExpenseSummary() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["expenseSummary"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getExpenseSummary();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCategoryStats() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[string, number]>>({
    queryKey: ["categoryStats"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCategoryStats();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── AI & Insights ─────────────────────────────────────────────────────────────

export function useGenerateInsights() {
  const { actor, isFetching } = useActor();

  return useQuery<string[]>({
    queryKey: ["insights"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.generateInsights();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAIResponse() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({
      userMessage,
      expenseContext,
    }: { userMessage: string; expenseContext: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.getAIResponse(userMessage, expenseContext);
    },
  });
}

export function useChatAssistant() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (request: ChatRequest) => {
      if (!actor) throw new Error("Actor not available");
      return actor.chatAssistant(request);
    },
  });
}

export function useGetRiskLevel() {
  const { actor, isFetching } = useActor();

  return useQuery<string>({
    queryKey: ["riskLevel"],
    queryFn: async () => {
      if (!actor) return "Low";
      return actor.getRiskLevel() as unknown as string;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetSpendingPersonality() {
  const { actor, isFetching } = useActor();

  return useQuery<string>({
    queryKey: ["spendingPersonality"],
    queryFn: async () => {
      if (!actor) return "Budget-Conscious";
      return actor.getSpendingPersonality();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetBudgetStatus() {
  const { actor, isFetching } = useActor();

  return useQuery<BudgetStatus>({
    queryKey: ["budgetStatus"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getBudgetStatus();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── Chat History ──────────────────────────────────────────────────────────────

export function useAddChatMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChatEntryInput) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addChatMessage(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatHistory"] });
    },
  });
}

export function useGetChatHistory() {
  const { actor, isFetching } = useActor();

  return useQuery<ChatEntry[]>({
    queryKey: ["chatHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getChatHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useClearChatHistory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.clearChatHistory();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatHistory"] });
    },
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function useUploadDocument() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DocumentMetaInput) => {
      if (!actor) throw new Error("Actor not available");
      return actor.uploadDocument(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useListDocuments() {
  const { actor, isFetching } = useActor();

  return useQuery<DocumentMeta[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listDocuments();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useDeleteDocument() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteDocument(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useGetDocumentMeta() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.getDocumentMeta(id);
    },
  });
}

// ── Spending Monitor ──────────────────────────────────────────────────────────

export function useRegisterSpendingMonitorConsent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consent: boolean) => {
      if (!actor) throw new Error("Actor not available");
      return actor.registerSpendingMonitorConsent(consent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spendingMonitorSettings"] });
      queryClient.invalidateQueries({ queryKey: ["spendingAlerts"] });
    },
  });
}

export function useGetSpendingMonitorSettings() {
  const { actor, isFetching } = useActor();

  return useQuery<SpendingMonitorSettingsView>({
    queryKey: ["spendingMonitorSettings"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getSpendingMonitorSettings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetMonitoredCategories() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categories: string[]) => {
      if (!actor) throw new Error("Actor not available");
      return actor.setMonitoredCategories(categories);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spendingMonitorSettings"] });
      queryClient.invalidateQueries({ queryKey: ["spendingAlerts"] });
    },
  });
}

export function useSetCategoryThreshold() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      threshold,
    }: { category: string; threshold: number }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.setCategoryThreshold(category, threshold);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spendingMonitorSettings"] });
      queryClient.invalidateQueries({ queryKey: ["spendingAlerts"] });
    },
  });
}

export function useCheckCategorySpending() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.checkCategorySpending();
    },
  });
}

export function useGetSpendingAlerts() {
  const { actor, isFetching } = useActor();

  return useQuery<SpendingAlert[]>({
    queryKey: ["spendingAlerts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSpendingAlerts();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── Legacy mock types kept for pages that import them ─────────────────────────

export type BudgetStatusLabel = "OnTrack" | "Warning" | "Exceeded";

export interface BudgetInfo {
  category: string;
  budgetAmount: number;
  currentSpending: number;
  deviation: number;
  status: BudgetStatusLabel;
}

export type RiskLevelLabel = "Low" | "Medium" | "High";

export interface RiskAnalysis {
  level: RiskLevelLabel;
  score: number;
  factors: string[];
  recommendations: string[];
}

export type SpendingPersonalityLabel =
  | "BudgetConscious"
  | "ImpulsiveSpender"
  | "SubscriptionHeavy";

export interface PersonalityInsights {
  personality: SpendingPersonalityLabel;
  traits: string[];
  recommendations: string[];
}

/** Kept for pages that reference useGetRiskAnalysis */
export function useGetRiskAnalysis() {
  const { actor, isFetching } = useActor();
  const riskQuery = useGetRiskLevel();

  return useQuery<RiskAnalysis>({
    queryKey: ["riskAnalysis"],
    queryFn: async () => {
      const level = (riskQuery.data ?? "Low") as RiskLevelLabel;
      return {
        level,
        score: level === "High" ? 75 : level === "Medium" ? 45 : 15,
        factors:
          level === "Low"
            ? ["Spending patterns are within normal range"]
            : ["Elevated spending detected"],
        recommendations:
          level === "Low"
            ? ["Continue maintaining your current spending habits"]
            : ["Review your recent expenses and identify areas to cut back"],
      };
    },
    enabled: !!actor && !isFetching && riskQuery.isSuccess,
  });
}
