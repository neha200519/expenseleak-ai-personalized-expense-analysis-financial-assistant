import { Mic, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

type OrbState = "idle" | "listening" | "processing" | "speaking";

interface TranscriptMessage {
  id: number;
  role: "user" | "ai";
  text: string;
}

export interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onAddExpense: (data: {
    amount?: number;
    merchant?: string;
    category?: string;
  }) => void;
  expenseSummary?: any;
  categoryStats?: any;
}

const SUGGESTIONS = [
  "What did I spend this week?",
  "Add \u20b9300 for lunch at Zomato",
  "Show my top spending category",
  "How's my budget looking?",
  "What's my risk level?",
  "Take me to Analytics",
];

function parseNLP(
  text: string,
  expenseSummary: any,
  _categoryStats: any,
): { action: string; response: string; data?: any } {
  const lower = text.toLowerCase();

  if (
    lower.includes("spend") ||
    lower.includes("spent") ||
    lower.includes("expense") ||
    lower.includes("budget") ||
    lower.includes("how much")
  ) {
    if (lower.includes("week") || lower.includes("last week")) {
      const total = expenseSummary?.totalSpent || 0;
      return {
        action: "analytics",
        response: `Based on your recent data, you've spent \u20b9${total.toLocaleString("en-IN")} in total. Your weekly average is around \u20b9${Math.round(total / 4).toLocaleString("en-IN")}. Want me to show you the full analytics?`,
      };
    }
    if (lower.includes("month") || lower.includes("this month")) {
      const total = expenseSummary?.totalSpent || 0;
      return {
        action: "analytics",
        response: `This month you've spent \u20b9${total.toLocaleString("en-IN")} total. ${total > 10000 ? "That's on the higher side — consider reviewing discretionary spending." : "You're doing well!"}`,
      };
    }
    const total = expenseSummary?.totalSpent || 0;
    return {
      action: "none",
      response: `Your total recorded spending is \u20b9${total.toLocaleString("en-IN")}. Ask me about specific categories or time periods for more detail.`,
    };
  }

  const addMatch = lower.match(
    /(?:add|spent|paid|pay)\s+(?:rs\.?|inr|\u20b9)?\s*(\d+(?:\.\d+)?)(?:\s+(?:for|on)\s+([\w\s]+?))?(?:\s+(?:at|from|in)\s+([\w\s]+?))?(?:\s+(?:using|via|with|by)\s+([\w\s]+?))?(?:\.|$)/i,
  );
  if (addMatch) {
    const amount = Number.parseFloat(addMatch[1]);
    const item = addMatch[2]?.trim();
    const merchant = addMatch[3]?.trim();
    let category = "Food";
    const keywords = `${item || ""} ${merchant || ""} ${lower}`;
    if (
      /zomato|swiggy|food|lunch|dinner|breakfast|restaurant|cafe/i.test(
        keywords,
      )
    )
      category = "Food";
    else if (/uber|ola|bus|auto|taxi|metro|cab|transport/i.test(keywords))
      category = "Transport";
    else if (/amazon|flipkart|shopping|mall|shop|store/i.test(keywords))
      category = "Shopping";
    else if (/netflix|spotify|movie|game|entertainment/i.test(keywords))
      category = "Entertainment";
    else if (/doctor|hospital|medicine|health|pharmacy/i.test(keywords))
      category = "Healthcare";
    else if (/bill|electricity|water|gas|internet|utility/i.test(keywords))
      category = "Bills";
    return {
      action: "addExpense",
      response: `Got it! Adding \u20b9${amount} expense${merchant ? ` at ${merchant}` : ""}${item ? ` for ${item}` : ""}. Opening the expense form with pre-filled details.`,
      data: { amount, merchant, category },
    };
  }

  if (
    lower.includes("top category") ||
    lower.includes("insights") ||
    lower.includes("top spending")
  ) {
    return {
      action: "navigate",
      response:
        "Taking you to the Insights page where you can see your top spending categories and patterns.",
      data: { page: "insights" },
    };
  }
  if (
    lower.includes("analytics") ||
    lower.includes("charts") ||
    lower.includes("graph")
  ) {
    return {
      action: "navigate",
      response:
        "Opening Analytics for you. You'll see your spending charts and trends.",
      data: { page: "analytics" },
    };
  }
  if (lower.includes("dashboard") || lower.includes("home")) {
    return {
      action: "navigate",
      response: "Going to your dashboard now.",
      data: { page: "home" },
    };
  }
  if (lower.includes("risk")) {
    return {
      action: "none",
      response:
        "Your spending risk is calculated based on frequency and amounts. Check the Insights page for your current risk level and personalized recommendations.",
    };
  }

  const tips = [
    "Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
    "Tracking small daily expenses can reveal surprising money leaks.",
    "Setting category budgets is a great way to stay on track.",
    "Review your top spending category weekly for better control.",
  ];
  return {
    action: "none",
    response: tips[Math.floor(Math.random() * tips.length)],
  };
}

export default function VoiceModeOverlay({
  isOpen,
  onClose,
  onNavigate,
  onAddExpense,
  expenseSummary,
  categoryStats,
}: VoiceModeOverlayProps) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [interimText, setInterimText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [carouselOffset, setCarouselOffset] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showTypingDots, setShowTypingDots] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);
  const isListeningRef = useRef(false);
  // Store callbacks in refs to avoid stale closures in processCommand
  const onCloseRef = useRef(onClose);
  const onNavigateRef = useRef(onNavigate);
  const onAddExpenseRef = useRef(onAddExpense);
  const expenseSummaryRef = useRef(expenseSummary);
  const categoryStatsRef = useRef(categoryStats);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);
  useEffect(() => {
    onAddExpenseRef.current = onAddExpense;
  }, [onAddExpense]);
  useEffect(() => {
    expenseSummaryRef.current = expenseSummary;
  }, [expenseSummary]);
  useEffect(() => {
    categoryStatsRef.current = categoryStats;
  }, [categoryStats]);

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger
  useEffect(() => {
    scrollToBottom();
  }, [transcript, showTypingDots, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      setCarouselOffset((p) => (p + 3) % SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isOpen]);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setOrbState("speaking");
    utterance.onend = () => setOrbState("idle");
    utterance.onerror = () => setOrbState("idle");
    synthRef.current.speak(utterance);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (synthRef.current) synthRef.current.cancel();
    setOrbState("idle");
    setTimeout(() => {
      setClosing(false);
      setIsVisible(false);
      setTranscript([]);
      setInterimText("");
      onCloseRef.current();
    }, 320);
  }, []);

  const processCommand = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const userMsgId = ++msgIdRef.current;
      setTranscript((prev) => [
        ...prev,
        { id: userMsgId, role: "user", text: text.trim() },
      ]);
      setInterimText("");
      setOrbState("processing");

      setTimeout(() => {
        const result = parseNLP(
          text,
          expenseSummaryRef.current,
          categoryStatsRef.current,
        );
        setShowTypingDots(true);
        setTimeout(() => {
          setShowTypingDots(false);
          const aiMsgId = ++msgIdRef.current;
          setTranscript((prev) => [
            ...prev,
            { id: aiMsgId, role: "ai", text: result.response },
          ]);
          speakText(result.response);
          if (result.action === "addExpense" && result.data) {
            setTimeout(() => {
              onAddExpenseRef.current(result.data);
            }, 2000);
          } else if (result.action === "navigate" && result.data) {
            setTimeout(() => {
              onNavigateRef.current(result.data.page);
              handleClose();
            }, 2500);
          }
        }, 1500);
      }, 400);
    },
    [speakText, handleClose],
  );

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    if (isListeningRef.current) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onstart = () => {
      isListeningRef.current = true;
      setOrbState("listening");
    };
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText("");
        processCommand(final);
      }
    };
    recognition.onend = () => {
      isListeningRef.current = false;
      setOrbState((prev) => (prev === "listening" ? "idle" : prev));
    };
    recognition.onerror = (e: any) => {
      isListeningRef.current = false;
      if (e.error === "not-allowed") setSpeechSupported(false);
      setOrbState("idle");
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [processCommand]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTranscript([]);
      synthRef.current = window.speechSynthesis || null;
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
      setTimeout(() => {
        const greetId = ++msgIdRef.current;
        setTranscript([
          {
            id: greetId,
            role: "ai",
            text: "Hi! I'm ready to help with your finances. Ask about spending, add expenses, or navigate anywhere. Tap the orb to start speaking!",
          },
        ]);
      }, 400);
    }
  }, [isOpen]);

  const visibleSuggestions = [
    SUGGESTIONS[carouselOffset % SUGGESTIONS.length],
    SUGGESTIONS[(carouselOffset + 1) % SUGGESTIONS.length],
    SUGGESTIONS[(carouselOffset + 2) % SUGGESTIONS.length],
  ];

  if (!isOpen && !isVisible) return null;

  const overlayStyle: React.CSSProperties = {
    opacity: isVisible && !closing ? 1 : 0,
    transform: isVisible && !closing ? "scale(1)" : "scale(0.95)",
    transition: "opacity 0.32s ease, transform 0.32s ease",
  };

  const getOrbColor = () => {
    if (orbState === "listening") return "var(--primary)";
    if (orbState === "processing") return "#f59e0b";
    if (orbState === "speaking") return "#10b981";
    return "var(--muted-foreground)";
  };

  const content = (
    <>
      <style>{`
        @keyframes vm-ring-expand {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes vm-orb-idle {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px 4px rgba(20,184,166,0.3); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px 8px rgba(20,184,166,0.2); }
        }
        @keyframes vm-orb-processing {
          0% { transform: scale(0.85) rotate(0deg); }
          100% { transform: scale(0.85) rotate(360deg); }
        }
        @keyframes vm-orb-speaking {
          0%, 100% { transform: scale(1); box-shadow: 0 0 40px 12px rgba(16,185,129,0.5); }
          50% { transform: scale(1.08); box-shadow: 0 0 55px 18px rgba(16,185,129,0.3); }
        }
        @keyframes vm-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes vm-msg-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vm-ring {
          position: absolute;
          border-radius: 9999px;
          border: 2px solid #14b8a6;
          animation: vm-ring-expand 2s ease-out infinite;
        }
        .vm-orb-idle { animation: vm-orb-idle 3s ease-in-out infinite; }
        .vm-orb-processing { animation: vm-orb-processing 1s linear infinite; }
        .vm-orb-speaking { animation: vm-orb-speaking 1.5s ease-in-out infinite; }
        .vm-orb-listening { animation: vm-orb-idle 1s ease-in-out infinite; }
        .vm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background: #9ca3af; }
        .vm-dot-1 { animation: vm-dot-bounce 1.4s ease-in-out infinite; }
        .vm-dot-2 { animation: vm-dot-bounce 1.4s ease-in-out 0.2s infinite; }
        .vm-dot-3 { animation: vm-dot-bounce 1.4s ease-in-out 0.4s infinite; }
        .vm-msg { animation: vm-msg-in 0.3s ease forwards; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "rgba(0,0,0,0.88)",
          backdropFilter: "blur(12px)",
          ...overlayStyle,
        }}
        data-ocid="voice_overlay.modal"
      >
        {/* Header */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} style={{ color: "#14b8a6" }} />
            <span style={{ color: "#14b8a6", fontWeight: 700, fontSize: 18 }}>
              Voice Mode
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-ocid="voice_overlay.close_button"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              transition: "background 0.2s",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Orb */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 180,
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {orbState === "listening" && (
              <>
                <div
                  className="vm-ring"
                  style={{ width: 120, height: 120, animationDelay: "0s" }}
                />
                <div
                  className="vm-ring"
                  style={{ width: 120, height: 120, animationDelay: "0.5s" }}
                />
                <div
                  className="vm-ring"
                  style={{ width: 120, height: 120, animationDelay: "1s" }}
                />
              </>
            )}
            <button
              type="button"
              onClick={
                orbState === "idle" || orbState === "speaking"
                  ? startListening
                  : undefined
              }
              data-ocid="voice_overlay.canvas_target"
              className={`vm-orb-${orbState}`}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background:
                  orbState === "processing"
                    ? "conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b)"
                    : `radial-gradient(circle at 40% 35%, ${getOrbColor()}cc, ${getOrbColor()})`,
                border: "none",
                cursor:
                  orbState === "listening" || orbState === "processing"
                    ? "default"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                transition: "background 0.4s",
                boxShadow: `0 0 30px 8px ${getOrbColor()}44`,
              }}
            >
              <Mic size={36} color="white" />
            </button>
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            marginTop: 12,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {orbState === "idle" && "Tap to speak"}
          {orbState === "listening" && "Listening..."}
          {orbState === "processing" && "Processing..."}
          {orbState === "speaking" && "Speaking..."}
        </div>

        {interimText && (
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              marginTop: 6,
              fontStyle: "italic",
              maxWidth: "80%",
              textAlign: "center",
            }}
          >
            {interimText}
          </div>
        )}

        {!speechSupported && (
          <div
            style={{
              color: "#fbbf24",
              fontSize: 13,
              marginTop: 8,
              maxWidth: "80%",
              textAlign: "center",
            }}
          >
            Speech recognition is not supported in this browser. Try Chrome or
            Edge.
          </div>
        )}

        {/* Transcript */}
        <div
          style={{
            flex: "1 1 auto",
            width: "100%",
            maxWidth: 600,
            overflowY: "auto",
            padding: "12px 20px",
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          data-ocid="voice_overlay.panel"
        >
          {transcript.map((msg) => (
            <div
              key={msg.id}
              className="vm-msg"
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #14b8a6, #0d9488)"
                      : "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: 14,
                  lineHeight: 1.5,
                  border:
                    msg.role === "ai"
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "none",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {showTypingDots && (
            <div
              className="vm-msg"
              style={{ display: "flex", justifyContent: "flex-start" }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                <span className="vm-dot vm-dot-1" />
                <span className="vm-dot vm-dot-2" />
                <span className="vm-dot vm-dot-3" />
              </div>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Suggestions */}
        <div
          style={{
            flexShrink: 0,
            width: "100%",
            maxWidth: 600,
            padding: "8px 20px 24px",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Try saying
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {visibleSuggestions.map((s, i) => (
              <button
                type="button"
                key={s}
                onClick={() => processCommand(s)}
                data-ocid={`voice_overlay.secondary_button.${i + 1}`}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 20,
                  color: "rgba(255,255,255,0.8)",
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "background 0.2s, border-color 0.2s",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(20,184,166,0.2)";
                  e.currentTarget.style.borderColor = "rgba(20,184,166,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
}
