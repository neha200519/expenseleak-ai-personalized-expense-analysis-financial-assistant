import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Sparkles } from "lucide-react";
import { useGetSpendingPersonality } from "../hooks/useQueries";

/* ── Personality metadata ─────────────────────────────────────────────────── */
const PERSONALITY_PROFILES = [
  {
    match: (s: string) => s.toLowerCase().includes("budget"),
    icon: "🎯",
    label: "Budget-Conscious",
    color: "var(--success)",
    desc: "You make thoughtful financial decisions and maintain excellent spending control.",
    traits: [
      "Consistent saving habits",
      "Low impulse spending",
      "Goal-oriented finances",
    ],
    tips: [
      "Consider increasing SIP investments to maximize returns.",
      "Explore FD rates — your disciplined approach suits long-term deposits.",
      "Share your budgeting approach; community accountability amplifies results.",
    ],
  },
  {
    match: (s: string) =>
      s.toLowerCase().includes("impulsive") ||
      s.toLowerCase().includes("impulse"),
    icon: "⚡",
    label: "Impulsive Spender",
    color: "var(--warning)",
    desc: "You enjoy spontaneous purchases and variety — but there is room to optimize.",
    traits: [
      "Frequent unplanned purchases",
      "High variety in spending",
      "Emotional purchasing patterns",
    ],
    tips: [
      "Apply a 24-hour rule before any purchase above ₹500.",
      "Set a weekly discretionary budget and stick to it.",
      "Use a wishlist — items that survive 2 weeks are worth buying.",
    ],
  },
  {
    match: (s: string) => s.toLowerCase().includes("subscription"),
    icon: "📱",
    label: "Subscription-Heavy",
    color: "var(--primary)",
    desc: "You prefer convenience through subscriptions, but audits can unlock big savings.",
    traits: [
      "Multiple recurring payments",
      "High digital service usage",
      "Automated spending patterns",
    ],
    tips: [
      "Audit all subscriptions quarterly — cancel any unused in 30 days.",
      "Look for annual plans; they typically save 20–40% vs monthly.",
      "Bundle OTT and utility services for discounted combined rates.",
    ],
  },
];

const FALLBACK = {
  icon: "👤",
  label: "Emerging Profile",
  color: "var(--text-muted)",
  desc: "Add more expenses to reveal your personalized spending profile.",
  traits: ["Profile building in progress"],
  tips: ["Track 10+ expenses to unlock your spending personality."],
};

function getProfile(personality: string) {
  return PERSONALITY_PROFILES.find((p) => p.match(personality)) ?? FALLBACK;
}

export default function PersonalityTagCard() {
  const { data: personality, isLoading } = useGetSpendingPersonality();
  const profile = personality ? getProfile(personality) : FALLBACK;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        boxShadow: "var(--shadow-card)",
      }}
      data-ocid="insights.personality_card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-2xl">🧠</span>
        <div>
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--text-heading)" }}
          >
            Spending Personality
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Your financial behavior profile
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
            className="h-4 w-full"
            style={{ background: "var(--bg-muted)" }}
          />
          <Skeleton
            className="h-4 w-3/4"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      ) : (
        <div className="space-y-5 animate-fade-up">
          {/* Identity badge */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: `color-mix(in srgb, ${profile.color} 10%, var(--bg-card))`,
              border: `1px solid color-mix(in srgb, ${profile.color} 30%, transparent)`,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{profile.icon}</span>
              <div>
                <span
                  className="inline-block px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    background: `color-mix(in srgb, ${profile.color} 20%, var(--bg-card))`,
                    color: profile.color,
                    border: `1px solid color-mix(in srgb, ${profile.color} 40%, transparent)`,
                  }}
                >
                  {profile.label}
                </span>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--text-body)" }}>
              {profile.desc}
            </p>
          </div>

          {/* Traits */}
          <div>
            <h4
              className="text-xs font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              <Sparkles className="h-3 w-3" /> Key Traits
            </h4>
            <ul className="space-y-1">
              {profile.traits.map((trait) => (
                <li
                  key={trait}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "var(--text-body)" }}
                >
                  <span
                    className="mt-1 flex-shrink-0"
                    style={{ color: profile.color }}
                  >
                    •
                  </span>
                  {trait}
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div>
            <h4
              className="text-xs font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              <Lightbulb className="h-3 w-3" /> Personalized Tips
            </h4>
            <ul className="space-y-1.5">
              {profile.tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "var(--text-body)" }}
                >
                  <span
                    className="mt-1 flex-shrink-0"
                    style={{ color: "var(--success)" }}
                  >
                    ✓
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
