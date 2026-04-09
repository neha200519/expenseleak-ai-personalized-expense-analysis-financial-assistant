import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface BudgetStatus {
    spent: number;
    remaining: number;
    budget: number;
    percentage: number;
}
export interface SpendingMonitorSettingsView {
    monitoredCategories: Array<string>;
    consentGiven: boolean;
    thresholds: Array<[string, number]>;
}
export interface ChatEntryInput {
    content: string;
    role: string;
}
export interface SpendingAlert {
    status: AlertStatus;
    threshold: number;
    spent: number;
    category: string;
}
export interface ChatRequest {
    context: string;
    message: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface ExpenseInput {
    paymentMethod: PaymentMethod;
    source: string;
    date: string;
    note: string;
    merchant: string;
    category: ExpenseCategory;
    amount: number;
}
export interface ThemeOption {
    id: string;
    name: string;
    description: string;
}
export interface ChatEntry {
    id: bigint;
    content: string;
    role: string;
    callerId: Principal;
    timestamp: bigint;
}
export interface ExpenseUpdateInput {
    paymentMethod?: PaymentMethod;
    date?: string;
    note?: string;
    merchant?: string;
    category?: ExpenseCategory;
    amount?: number;
}
export interface Expense {
    id: bigint;
    paymentMethod: PaymentMethod;
    source: string;
    date: string;
    note: string;
    createdAt: bigint;
    callerId: Principal;
    updatedAt?: bigint;
    merchant: string;
    category: ExpenseCategory;
    amount: number;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface DocumentMeta {
    id: bigint;
    name: string;
    size: bigint;
    fileType: string;
    callerId: Principal;
    uploadedAt: bigint;
}
export interface ThemePreference {
    mode: string;
    palette: string;
    customColor?: string;
}
export interface ChatResponse {
    response: string;
    timestamp: bigint;
}
export interface DocumentMetaInput {
    name: string;
    size: bigint;
    fileType: string;
}
export interface UserProfileInput {
    monthlyBudget: number;
    name: string;
    email: string;
    currency: string;
}
export interface UserProfile {
    monthlyBudget: number;
    name: string;
    email: string;
    currency: string;
}
export interface ExpenseSummary {
    avgExpense: number;
    total: number;
    count: bigint;
    thisMonthTotal: number;
    thisMonthCount: bigint;
    topCategory: string;
}
export enum AlertStatus {
    Active = "Active",
    Dismissed = "Dismissed"
}
export enum ExpenseCategory {
    Food = "Food",
    Health = "Health",
    Bills = "Bills",
    Travel = "Travel",
    Entertainment = "Entertainment",
    Shopping = "Shopping",
    Other = "Other",
    Transport = "Transport"
}
export enum PaymentMethod {
    UPI = "UPI",
    Card = "Card",
    Cash = "Cash",
    Other = "Other",
    NetBanking = "NetBanking"
}
export enum RiskLevel {
    Low = "Low",
    High = "High",
    Medium = "Medium"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addChatMessage(input: ChatEntryInput): Promise<void>;
    addExpense(input: ExpenseInput): Promise<Expense>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    chatAssistant(request: ChatRequest): Promise<ChatResponse>;
    checkCategorySpending(): Promise<Array<SpendingAlert>>;
    clearChatHistory(): Promise<void>;
    deleteDocument(id: bigint): Promise<boolean>;
    deleteExpense(id: bigint): Promise<boolean>;
    generateInsights(): Promise<Array<string>>;
    getAIResponse(userMessage: string, expenseContext: string): Promise<string>;
    getAllThemeOptions(): Promise<Array<ThemeOption>>;
    getBudgetStatus(): Promise<BudgetStatus>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCategoryStats(): Promise<Array<[string, number]>>;
    getChatHistory(): Promise<Array<ChatEntry>>;
    getDocumentMeta(id: bigint): Promise<DocumentMeta | null>;
    getExpenseSummary(): Promise<ExpenseSummary>;
    getRiskLevel(): Promise<RiskLevel>;
    getSpendingAlerts(): Promise<Array<SpendingAlert>>;
    getSpendingMonitorSettings(): Promise<SpendingMonitorSettingsView>;
    getSpendingPersonality(): Promise<string>;
    getUserTheme(): Promise<ThemePreference | null>;
    isCallerAdmin(): Promise<boolean>;
    listDocuments(): Promise<Array<DocumentMeta>>;
    listExpenses(): Promise<Array<Expense>>;
    registerSpendingMonitorConsent(consent: boolean): Promise<void>;
    saveCallerUserProfile(profile: UserProfileInput): Promise<void>;
    saveUserTheme(theme: ThemePreference): Promise<void>;
    setAnthropicApiKey(key: string): Promise<void>;
    setCategoryThreshold(category: string, threshold: number): Promise<void>;
    setMonitoredCategories(categories: Array<string>): Promise<void>;
    transformHttpResponse(input: TransformationInput): Promise<TransformationOutput>;
    updateExpense(id: bigint, input: ExpenseUpdateInput): Promise<boolean>;
    uploadDocument(meta: DocumentMetaInput): Promise<DocumentMeta>;
}
