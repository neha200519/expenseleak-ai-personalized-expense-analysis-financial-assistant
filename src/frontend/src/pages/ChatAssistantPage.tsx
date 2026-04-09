// Speech Recognition type shims
interface SpeechRecognitionResultEntry {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResultEntry[];
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useActor } from "@/hooks/useActor";
import {
  Bot,
  Check,
  Clipboard,
  Mic,
  MicOff,
  Send,
  Settings,
  Trash2,
  User,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

type VoiceGender = "male" | "female";

interface QueryChip {
  icon: string;
  text: string;
  color: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "ashh-chat-history";
const BOT_NAME_KEY = "ashh-bot-name";
const VOICE_GENDER_KEY = "ashh-voice-gender";
const DEFAULT_BOT_NAME = "ASHH";
const SPEECH_RATE_KEY = "ashh-speech-rate";
const SPEECH_VOLUME_KEY = "ashh-speech-volume";
const AUTO_READ_KEY = "ashh-auto-read";
const WELCOMED_KEY = "ashh-welcomed";
const MAX_HISTORY = 50;

const WELCOME_TEXT =
  "Hello! I am ASHH, your personal finance assistant. I can help you track budgets, analyze spending, plan savings, and give you personalized financial advice. What would you like to know today?";

// ── Query Bank ─────────────────────────────────────────────────────────────
const QUERY_BANK: QueryChip[] = [
  { icon: "💰", text: "How can I save more money?", color: "green" },
  { icon: "📊", text: "Analyze my spending habits", color: "blue" },
  { icon: "🎯", text: "Set a monthly budget for me", color: "purple" },
  { icon: "⚠", text: "What is my spending risk?", color: "amber" },
  { icon: "🍕", text: "Tips to reduce food costs", color: "orange" },
  { icon: "💳", text: "How to manage debt?", color: "red" },
  { icon: "📈", text: "Show top spending categories", color: "teal" },
  { icon: "🏦", text: "Financial planning advice", color: "blue" },
  { icon: "📱", text: "Best UPI cashback tips", color: "green" },
  { icon: "🏠", text: "How to save for a goal?", color: "purple" },
  { icon: "⚡", text: "Reduce my monthly bills", color: "amber" },
  { icon: "💡", text: "Investment basics in India", color: "teal" },
];

// ── Expense Context ─────────────────────────────────────────────────────────
function getExpenseContext() {
  const expenses = JSON.parse(
    localStorage.getItem("expenses") || "[]",
  ) as Array<{
    amount: string;
    category: string;
    date: string;
    merchant: string;
  }>;
  const total = expenses.reduce(
    (s, e) => s + (Number.parseFloat(e.amount) || 0),
    0,
  );
  const byCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] =
      (acc[e.category] || 0) + Number.parseFloat(e.amount || "0");
    return acc;
  }, {});
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const now = new Date();
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const monthTotal = thisMonth.reduce(
    (s, e) => s + (Number.parseFloat(e.amount) || 0),
    0,
  );
  return {
    totalExpenses: total,
    totalTransactions: expenses.length,
    topCategory: topCategory ? topCategory[0] : "None",
    topCategoryAmount: topCategory ? topCategory[1] : 0,
    thisMonthTotal: monthTotal,
    thisMonthTransactions: thisMonth.length,
    categoryBreakdown: byCategory,
    recentExpenses: expenses.slice(0, 5).map((e) => ({
      merchant: e.merchant,
      amount: e.amount,
      category: e.category,
      date: e.date,
    })),
  };
}

// ── Clean text for TTS ──────────────────────────────────────────────────────
function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/[\u2600-\u27FF]/g, "")
    .replace(/[✓✔✅❌⚠💡🔔📊💰🎯➤→←★☆•·]/gu, "")
    .replace(/[*_~`#>[\]]/g, "")
    .replace(/\b(Rs\.?|INR|₹)\s*/g, "rupees ")
    .replace(/(\d+),(\d+)/g, "$1$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Finance Response Fallback ──────────────────────────────────────────────
const FINANCE_KEYWORDS = [
  "budget",
  "spend",
  "spent",
  "expense",
  "saving",
  "save",
  "risk",
  "alert",
  "categor",
  "food",
  "transport",
  "shopping",
  "salary",
  "income",
  "debt",
  "invest",
  "money",
  "financial",
  "finance",
  "cash",
  "pay",
  "bill",
  "emi",
  "loan",
  "credit",
  "debit",
  "wallet",
  "bank",
  "insurance",
  "tax",
  "profit",
  "loss",
  "balance",
  "transaction",
  "rupee",
  "cost",
  "price",
  "afford",
  "track",
  "monitor",
  "goal",
  "target",
  "limit",
  "overspend",
  "underspend",
  "insight",
  "analytics",
  "chart",
  "report",
  "month",
  "week",
  "daily",
  "how much",
  "how to",
  "tip",
  "advice",
  "suggest",
  "recommend",
  "plan",
  "planning",
  "manage",
  "habit",
  "analyz",
  "top",
  "set",
];

function isFinanceQuestion(query: string): boolean {
  const q = query.toLowerCase();
  return FINANCE_KEYWORDS.some((kw) => q.includes(kw));
}

function generateFinanceResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("budget") || q.includes("set a monthly"))
    return "The 50/30/20 rule is a solid framework: 50% needs, 30% wants, 20% savings. Aim to keep monthly expenses under 80% of income to build a healthy financial buffer. Would you like help setting category-specific limits?";
  if (q.includes("food") || q.includes("zomato") || q.includes("swiggy"))
    return "Food delivery apps can silently drain your wallet. Try the Rs.500 weekly challenge: cook at home Mon-Thu and allow Rs.500 for dining on weekends. This can save Rs.1,500 to Rs.2,000 per month. Check if you are paying for subscriptions like Zomato Gold that you do not fully use.";
  if (q.includes("transport") || q.includes("uber") || q.includes("fuel"))
    return "Cab rides can add up to Rs.3,000 to Rs.6,000 per month. Consider metro or bus for routine commutes, which are 80% cheaper. Set a monthly transport budget and monitor weekly using the category tracking in this app.";
  if (q.includes("shopping") || q.includes("amazon") || q.includes("flipkart"))
    return "Impulse purchases during sales account for 40% of overspending. Try the 48-hour rule: add items to cart and wait before buying. You will find you do not need 60% of them. Track all purchases in ExpenseLeak to see your true monthly shopping total.";
  if (q.includes("save") || q.includes("saving"))
    return "Automate your savings on salary day. Even Rs.3,000 per month in a SIP at 12% annual return grows to around Rs.7 lakhs over 10 years. Start with a 3 to 6 month emergency fund first, then move to index fund SIPs for long-term wealth.";
  if (q.includes("risk"))
    return "High spending risk indicators include: more than 40% of monthly income in a single category, more than 3x your average weekly spend in one week, or consecutive months of budget overruns. Check your Insights page for the real-time risk meter and set category alerts to catch overspending early.";
  if (q.includes("debt") || q.includes("loan") || q.includes("emi"))
    return "Use the avalanche method: pay minimums on all debts, then put extra money on the highest-interest debt first. Credit card interest at 36 to 48% per year should always be your priority. Check if prepayment is allowed without penalty on your personal loans.";
  if (q.includes("invest") || q.includes("mutual fund"))
    return "For beginners, start with Nifty 50 index fund SIPs. They are low-cost, diversified, and deliver 12 to 15% annual returns over long periods. Invest only what you will not need for at least 3 years and use platforms like Zerodha or Groww for easy setup.";
  if (q.includes("plan") || q.includes("planning"))
    return "A solid financial plan has 5 pillars: emergency fund of 3 to 6 months expenses, health and term life insurance, debt clearance starting from high-interest, SIP investments for long-term goals, and early retirement corpus building. Which pillar would you like to focus on first?";
  if (q.includes("habit") || q.includes("analyz"))
    return "Common spending pattern findings: subscription creep adding Rs.2,000 or more per month invisibly, weekend splurges that undo weekday discipline, and a convenience tax from last-minute purchases. Track expenses for 30 days and the patterns become unmistakable.";
  return "As your finance assistant, I analyze spending patterns, budget health, and financial risks. Aim to save at least 20% of income, keep your debt-to-income ratio below 30%, and always maintain an emergency fund. What specific aspect would you like to explore?";
}

// ── TTS Helper ─────────────────────────────────────────────────────────────
function speakText(
  text: string,
  gender: VoiceGender,
  rate = 1.0,
  volume = 1.0,
  onEnd?: () => void,
): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  const utterance = new SpeechSynthesisUtterance(clean);

  const applyVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    if (gender === "female") {
      const femaleVoice =
        voices.find(
          (v) =>
            v.name.includes("Female") ||
            v.name.includes("Zira") ||
            v.name.includes("Samantha") ||
            v.name.includes("Google UK English Female") ||
            v.name.includes("Microsoft Zira") ||
            (v.lang === "en-IN" && v.name.toLowerCase().includes("female")),
        ) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.1;
      utterance.rate = rate !== 1.0 ? rate : 0.95;
      utterance.volume = volume;
    } else {
      const maleVoice =
        voices.find(
          (v) =>
            v.name.includes("Male") ||
            v.name.includes("David") ||
            v.name.includes("Alex") ||
            v.name.includes("Google UK English Male") ||
            v.name.includes("Microsoft David") ||
            v.name.toLowerCase().includes("male"),
        ) ||
        voices[1] ||
        voices[0];
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.85;
      utterance.rate = rate !== 1.0 ? rate : 0.9;
      utterance.volume = volume;
    }
  };

  applyVoice();
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

// ── Timestamp ─────────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(date);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Typing Indicator ─────────────────────────────────────────────────────
function TypingIndicator({ botName }: { botName: string }) {
  return (
    <div className="flex items-end gap-2 mb-4" data-ocid="chat.loading_state">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "var(--primary)",
          color: "var(--text-on-primary)",
        }}
      >
        <Bot size={16} />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
        style={{
          background: "var(--bg-input)",
          color: "var(--text-body)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {botName} is thinking
          </span>
          <span className="typing-dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Speaking Wave Bars (next to ASHH avatar) ───────────────────────────────
function SpeakingBars() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="speaking-bar"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────
function MessageBubble({
  message,
  botName: _botName,
  voiceGender: _voiceGender,
  speechRate: _speechRate,
  speechVolume: _speechVolume,
  onSpeak,
}: {
  message: Message;
  botName: string;
  voiceGender: VoiceGender;
  speechRate: number;
  speechVolume: number;
  onSpeak: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleRead = () => {
    onSpeak(message.text);
  };

  return (
    <div
      className={`flex items-end gap-2 mb-4 chat-bubble-in ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-ocid={`chat.item.${isUser ? "user" : "bot"}`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{
          background: isUser ? "var(--bg-input)" : "var(--primary)",
          color: isUser ? "var(--text-body)" : "var(--text-on-primary)",
          border: "1px solid var(--border)",
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={16} />}
      </div>

      {/* Bubble + actions */}
      <div
        className={`group flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className="px-4 py-3 text-sm leading-relaxed"
          style={{
            background: isUser ? "var(--primary)" : "var(--bg-input)",
            color: isUser ? "var(--text-on-primary)" : "var(--text-body)",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            border: isUser ? "none" : "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {message.text}
        </div>

        {/* Timestamp + action buttons */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formatTime(message.timestamp)}
          </span>
          {!isUser && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                type="button"
                onClick={handleRead}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--primary)",
                }}
                title="Read aloud"
                data-ocid="chat.secondary_button"
              >
                <Volume2 size={11} />
                <span>Read</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: copied ? "var(--success)" : "var(--text-muted)",
                }}
                title="Copy message"
                data-ocid="chat.secondary_button"
              >
                {copied ? <Check size={11} /> : <Clipboard size={11} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date Separator ────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

// ── Waveform (while recording) ─────────────────────────────────────────────
function WaveformBar() {
  return (
    <div
      className="mx-4 mb-2 px-4 py-2 rounded-xl flex items-center gap-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <Mic size={14} style={{ color: "var(--danger)" }} />
      <div className="flex items-center gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="waveform-bar"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Listening...
      </span>
    </div>
  );
}

// ── Suggestion Chips ──────────────────────────────────────────────────────
function SuggestionGrid({
  chips,
  onSelect,
  visible,
}: {
  chips: QueryChip[];
  onSelect: (text: string) => void;
  visible: boolean;
}) {
  return (
    <div
      className="px-4 pb-4 transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <p
        className="text-xs font-semibold mb-3 uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        Quick Questions
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
      >
        {chips.map((s, i) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSelect(s.text)}
            className="suggestion-chip text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 12%, var(--bg-card))",
              border: "1px solid var(--border)",
              color: "var(--text-body)",
              animationDelay: `${i * 50}ms`,
            }}
            data-ocid={`chat.item.${i + 1}`}
          >
            <span className="text-base shrink-0">{s.icon}</span>
            <span className="text-xs leading-snug">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SuggestionRow({
  chips,
  onSelect,
  visible,
}: {
  chips: QueryChip[];
  onSelect: (text: string) => void;
  visible: boolean;
}) {
  return (
    <div
      className="shrink-0 px-4 py-2 border-t transition-opacity duration-400"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="flex gap-2 overflow-x-auto hide-scrollbar"
        style={{ scrollbarWidth: "none" }}
      >
        {chips.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSelect(s.text)}
            className="suggestion-chip shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 12%, var(--bg-card))",
              border: "1px solid var(--border)",
              color: "var(--text-body)",
            }}
          >
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Clear Chat Confirmation Modal ─────────────────────────────────────────
function ClearConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-ocid="chat.modal"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onCancel}
      />
      <div
        className="relative rounded-2xl p-6 w-80 shadow-xl z-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(239,68,68,0.12)" }}
          >
            <Trash2 size={18} style={{ color: "#EF4444" }} />
          </div>
          <h3
            className="font-semibold"
            style={{ color: "var(--text-heading)" }}
          >
            Clear chat history?
          </h3>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
          Clear all chat history? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              color: "var(--text-body)",
            }}
            data-ocid="chat.close_button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#EF4444", color: "#fff" }}
            data-ocid="chat.delete_button"
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────
function SettingsModal({
  botName,
  speechRate,
  speechVolume,
  autoRead,
  onSave,
  onSaveVoice,
  onClose,
}: {
  botName: string;
  speechRate: number;
  speechVolume: number;
  autoRead: boolean;
  onSave: (name: string) => void;
  onSaveVoice: (rate: number, volume: number, autoRead: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(botName);
  const [draftRate, setDraftRate] = useState(speechRate);
  const [draftVolume, setDraftVolume] = useState(speechVolume);
  const [draftAutoRead, setDraftAutoRead] = useState(autoRead);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-ocid="chat.modal"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <div
        className="relative rounded-2xl p-6 w-96 shadow-xl z-10 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="font-semibold text-base"
            style={{ color: "var(--text-heading)" }}
          >
            Chatbot Settings
          </h3>
          <button type="button" onClick={onClose} data-ocid="chat.close_button">
            <X size={18} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <label
          className="block text-sm font-medium mb-1"
          style={{ color: "var(--text-body)" }}
          htmlFor="bot-name-input"
        >
          Assistant Name
        </label>
        <Input
          id="bot-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. ASHH, Budget Bot"
          className="mb-5"
          data-ocid="chat.input"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            color: "var(--text-body)",
          }}
        />

        <div
          className="my-4 border-t"
          style={{ borderColor: "var(--border)" }}
        />
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          Voice Settings
        </p>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Label
              htmlFor="speech-rate"
              className="text-sm"
              style={{ color: "var(--text-body)" }}
            >
              Speech Rate
            </Label>
            <span
              className="text-xs font-mono"
              style={{ color: "var(--primary)" }}
            >
              {draftRate.toFixed(1)}x
            </span>
          </div>
          <Slider
            id="speech-rate"
            min={0.5}
            max={2.0}
            step={0.1}
            value={[draftRate]}
            onValueChange={(v) => setDraftRate(v[0])}
            data-ocid="chat.primary_button"
          />
          <div
            className="flex justify-between text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Label
              htmlFor="speech-volume"
              className="text-sm"
              style={{ color: "var(--text-body)" }}
            >
              Volume
            </Label>
            <span
              className="text-xs font-mono"
              style={{ color: "var(--primary)" }}
            >
              {Math.round(draftVolume * 100)}%
            </span>
          </div>
          <Slider
            id="speech-volume"
            min={0}
            max={1}
            step={0.1}
            value={[draftVolume]}
            onValueChange={(v) => setDraftVolume(v[0])}
            data-ocid="chat.secondary_button"
          />
          <div
            className="flex justify-between text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Mute</span>
            <span>Max</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <Label
            htmlFor="auto-read"
            className="text-sm"
            style={{ color: "var(--text-body)" }}
          >
            Auto-read AI responses
          </Label>
          <Switch
            id="auto-read"
            checked={draftAutoRead}
            onCheckedChange={setDraftAutoRead}
            data-ocid="chat.switch"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => {
            onSave(draft.trim() || DEFAULT_BOT_NAME);
            onSaveVoice(draftRate, draftVolume, draftAutoRead);
            onClose();
          }}
          style={{
            background: "var(--primary)",
            color: "var(--text-on-primary)",
          }}
          data-ocid="chat.save_button"
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function ChatAssistantPage() {
  const { actor } = useActor();

  const [botName, setBotName] = useState<string>(
    () => localStorage.getItem(BOT_NAME_KEY) || DEFAULT_BOT_NAME,
  );
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const s = localStorage.getItem(SPEECH_RATE_KEY);
    return s ? Number.parseFloat(s) : 1.0;
  });
  const [speechVolume, setSpeechVolume] = useState<number>(() => {
    const s = localStorage.getItem(SPEECH_VOLUME_KEY);
    return s ? Number.parseFloat(s) : 1.0;
  });
  const [autoRead, setAutoRead] = useState<boolean>(() => {
    const s = localStorage.getItem(AUTO_READ_KEY);
    return s === null ? true : s === "true";
  });
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(() => {
    const saved = localStorage.getItem(VOICE_GENDER_KEY);
    return (saved as VoiceGender) || "female";
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {
      // ignore
    }
    return [
      {
        id: "welcome",
        role: "assistant" as const,
        text: WELCOME_TEXT,
        timestamp: new Date(),
      },
    ];
  });

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Rotating chip offset: 0, 4, 8 — shows 8 chips at a time from 12
  const [chipOffset, setChipOffset] = useState(0);
  const [chipsVisible, setChipsVisible] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const showSuggestionsGrid =
    messages.length === 1 && messages[0].role === "assistant";
  const showSuggestionsRow = !showSuggestionsGrid;

  // Compute the 8 chips to show (wrap-around)
  const visibleChips = Array.from({ length: 8 }, (_, i) => {
    return QUERY_BANK[(chipOffset + i) % QUERY_BANK.length];
  });

  // Rotate chips every 10s with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setChipsVisible(false);
      setTimeout(() => {
        setChipOffset((prev) => (prev + 4) % QUERY_BANK.length);
        setChipsVisible(true);
      }, 400);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Persist messages (max 50)
  useEffect(() => {
    const toSave = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [messages]);

  // Auto-scroll
  const lastMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length !== lastMsgCount.current || isTyping) {
      lastMsgCount.current = messages.length;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  });

  // Init TTS voices
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  // Auto-speak welcome on first visit
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount
  useEffect(() => {
    if (!localStorage.getItem(WELCOMED_KEY)) {
      const currentGender = voiceGender;
      const currentRate = speechRate;
      const currentVolume = speechVolume;
      const timer = setTimeout(() => {
        setIsSpeaking(true);
        speakText(
          WELCOME_TEXT,
          currentGender,
          currentRate,
          currentVolume,
          () => {
            setIsSpeaking(false);
          },
        );
        localStorage.setItem(WELCOMED_KEY, "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist voice gender preference
  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setVoiceGender(gender);
    localStorage.setItem(VOICE_GENDER_KEY, gender);
  };

  const handleSpeak = useCallback(
    (text: string) => {
      setIsSpeaking(true);
      speakText(text, voiceGender, speechRate, speechVolume, () =>
        setIsSpeaking(false),
      );
    },
    [voiceGender, speechRate, speechVolume],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Deduplicate: skip if last message is identical
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "user" && last.text === trimmed) return prev;
        return [...prev, userMsg];
      });
      setInputText("");
      setIsTyping(true);

      try {
        let responseText: string;

        if (actor) {
          // Build chat history for context (last 6 msgs)
          const recentHistory = messages.slice(-6).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          }));

          const expenseContext = getExpenseContext();
          const result = await actor.getAIResponse(
            trimmed,
            JSON.stringify({ ...expenseContext, recentHistory }),
          );
          responseText = result || generateFinanceResponse(trimmed);
        } else {
          // Fallback: small delay for UX
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
          if (!isFinanceQuestion(trimmed)) {
            responseText = `I am ${botName}, your finance assistant. I can only help with budgets, spending, savings and financial planning.`;
          } else {
            responseText = generateFinanceResponse(trimmed);
          }
        }

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: responseText,
          timestamp: new Date(),
        };

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.text === responseText)
            return prev;
          return [...prev, aiMsg];
        });
        setIsTyping(false);

        if (autoRead) {
          setIsSpeaking(true);
          speakText(responseText, voiceGender, speechRate, speechVolume, () =>
            setIsSpeaking(false),
          );
        }
      } catch {
        const fallbackText = isFinanceQuestion(trimmed)
          ? generateFinanceResponse(trimmed)
          : `I am ${botName}, your finance assistant. I can only help with budgets, spending, savings and financial planning.`;

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: fallbackText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);

        if (autoRead) {
          setIsSpeaking(true);
          speakText(fallbackText, voiceGender, speechRate, speechVolume, () =>
            setIsSpeaking(false),
          );
        }
      }
    },
    [actor, botName, voiceGender, autoRead, speechRate, speechVolume, messages],
  );

  const handleSend = () => sendMessage(inputText);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionAPI =
      win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
  };

  const confirmClearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WELCOMED_KEY);
    setMessages([
      {
        id: "welcome",
        role: "assistant" as const,
        text: WELCOME_TEXT,
        timestamp: new Date(),
      },
    ]);
    setShowClearConfirm(false);
  };

  const saveBotName = (name: string) => {
    setBotName(name);
    localStorage.setItem(BOT_NAME_KEY, name);
  };

  const saveVoiceSettings = (rate: number, volume: number, ar: boolean) => {
    setSpeechRate(rate);
    setSpeechVolume(volume);
    setAutoRead(ar);
    localStorage.setItem(SPEECH_RATE_KEY, String(rate));
    localStorage.setItem(SPEECH_VOLUME_KEY, String(volume));
    localStorage.setItem(AUTO_READ_KEY, String(ar));
  };

  // Build message list with date separators
  const messagesWithSeparators: Array<
    | { kind: "separator"; label: string; key: string }
    | { kind: "message"; msg: Message }
  > = [];
  let lastDateStr = "";
  for (const msg of messages) {
    const dateStr = new Date(msg.timestamp).toDateString();
    if (dateStr !== lastDateStr) {
      messagesWithSeparators.push({
        kind: "separator",
        label: formatDateLabel(msg.timestamp),
        key: `sep-${dateStr}`,
      });
      lastDateStr = dateStr;
    }
    messagesWithSeparators.push({ kind: "message", msg });
  }

  const voiceName = voiceGender === "female" ? "Aria" : "Ashwin";

  return (
    <>
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        .typing-dots span {
          display: inline-block;
          width: 5px;
          height: 5px;
          margin: 0 1px;
          border-radius: 50%;
          background: var(--text-muted);
          animation: dot-bounce 1.2s infinite;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes waveform {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        .waveform-bar {
          width: 3px;
          border-radius: 3px;
          background: var(--primary);
          animation: waveform 0.8s ease-in-out infinite;
          height: 8px;
        }

        @keyframes speakWave {
          0%, 100% { height: 4px; }
          25% { height: 12px; }
          50% { height: 16px; }
          75% { height: 8px; }
        }
        .speaking-bar {
          width: 3px;
          border-radius: 3px;
          background: var(--primary);
          animation: speakWave 0.7s ease-in-out infinite;
          height: 4px;
        }
        .speaking-bar:nth-child(2) { animation-delay: 0.1s; }
        .speaking-bar:nth-child(3) { animation-delay: 0.2s; }
        .speaking-bar:nth-child(4) { animation-delay: 0.3s; }

        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-bubble-in {
          animation: bubbleIn 0.25s ease-out;
        }

        @keyframes chipFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .suggestion-chip {
          animation: chipFadeUp 0.35s ease-out both;
        }
        .suggestion-chip:hover {
          background: color-mix(in srgb, var(--primary) 20%, var(--bg-card)) !important;
          border-color: var(--primary) !important;
          transform: translateY(-1px);
        }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { scrollbar-width: none; }

        #chat-input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        .voice-pill-active {
          background: var(--primary) !important;
          color: var(--text-on-primary) !important;
        }
        .voice-pill-inactive {
          background: var(--bg-muted) !important;
          color: var(--text-muted) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .typing-dots span,
          .waveform-bar,
          .speaking-bar,
          .chat-bubble-in,
          .suggestion-chip {
            animation: none;
          }
        }
      `}</style>

      <div
        className="flex flex-col page-wrapper"
        style={{
          height: "100dvh",
          background: "var(--bg-page)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <header
          className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Left: avatar + name + speaking bars */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center relative"
              style={{
                background: "var(--primary)",
                color: "var(--text-on-primary)",
              }}
            >
              <Bot size={20} />
              {isSpeaking && (
                <div className="absolute -bottom-1 -right-1">
                  <SpeakingBars />
                </div>
              )}
            </div>
            <div>
              <div
                className="font-bold text-base leading-tight"
                style={{ color: "var(--text-heading)" }}
              >
                {botName}
              </div>
              <div
                className="text-xs flex items-center gap-1"
                style={{ color: "var(--success)" }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
                Finance Assistant
              </div>
            </div>
          </div>

          {/* Right: voice toggle pills + settings + clear */}
          <div className="flex items-center gap-2">
            {/* Voice gender pills */}
            <div
              className="flex rounded-full overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={() => handleVoiceGenderChange("female")}
                className={`text-xs px-3 py-1.5 font-medium transition-all ${voiceGender === "female" ? "voice-pill-active" : "voice-pill-inactive"}`}
                title="Aria — female voice"
                data-ocid="chat.toggle"
              >
                ♀ Aria
              </button>
              <button
                type="button"
                onClick={() => handleVoiceGenderChange("male")}
                className={`text-xs px-3 py-1.5 font-medium transition-all ${voiceGender === "male" ? "voice-pill-active" : "voice-pill-inactive"}`}
                title="Ashwin — male voice"
                data-ocid="chat.toggle"
              >
                ♂ Ashwin
              </button>
            </div>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
              title="Settings"
              data-ocid="chat.open_modal_button"
            >
              <Settings size={16} />
            </button>

            {/* Clear history */}
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
              title="Clear history"
              data-ocid="chat.delete_button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        {/* ── Message Area ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ minHeight: 0 }}
        >
          {messagesWithSeparators.map((item) =>
            item.kind === "separator" ? (
              <DateSeparator key={item.key} label={item.label} />
            ) : (
              <MessageBubble
                key={item.msg.id}
                message={item.msg}
                botName={botName}
                voiceGender={voiceGender}
                speechRate={speechRate}
                speechVolume={speechVolume}
                onSpeak={handleSpeak}
              />
            ),
          )}
          {isTyping && <TypingIndicator botName={botName} />}

          {/* Suggestions grid — welcome screen only */}
          {showSuggestionsGrid && (
            <SuggestionGrid
              chips={visibleChips}
              onSelect={sendMessage}
              visible={chipsVisible}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Waveform (while recording) ── */}
        {isRecording && <WaveformBar />}

        {/* ── Suggestion Row — shown after first message ── */}
        {showSuggestionsRow && (
          <SuggestionRow
            chips={visibleChips}
            onSelect={sendMessage}
            visible={chipsVisible}
          />
        )}

        {/* ── Speaking indicator below input ── */}
        {isSpeaking && (
          <div
            className="shrink-0 text-center pb-1"
            style={{ color: "var(--text-muted)", fontSize: "11px" }}
          >
            {voiceName} is speaking...
          </div>
        )}

        {/* ── Input Bar ── */}
        <div
          className="shrink-0 px-4 py-3 border-t flex items-center gap-2"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={toggleVoiceInput}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={{
              background: isRecording ? "var(--danger)" : "var(--bg-input)",
              color: isRecording ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border)",
              boxShadow: isRecording ? "0 0 0 3px rgba(239,68,68,0.2)" : "none",
            }}
            title={isRecording ? "Stop recording" : "Start voice input"}
            data-ocid="chat.primary_button"
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about budgets, spending, savings..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: "var(--bg-input)",
              border: "1.5px solid var(--border)",
              color: "var(--text-body)",
            }}
            data-ocid="chat.input"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              background: "var(--primary)",
              color: "var(--text-on-primary)",
            }}
            title="Send"
            data-ocid="chat.submit_button"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {showClearConfirm && (
        <ClearConfirmModal
          onConfirm={confirmClearHistory}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          botName={botName}
          speechRate={speechRate}
          speechVolume={speechVolume}
          autoRead={autoRead}
          onSave={saveBotName}
          onSaveVoice={saveVoiceSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
