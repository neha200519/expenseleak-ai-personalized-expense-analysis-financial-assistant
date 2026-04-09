import { useEffect, useRef, useState } from "react";
import { type PaletteKey, useThemeContext } from "../context/ThemeContext";

const PALETTES: { key: PaletteKey; color: string; label: string }[] = [
  { key: "ocean", color: "#0EA5E9", label: "Ocean" },
  { key: "forest", color: "#059669", label: "Forest" },
  { key: "sunset", color: "#EA580C", label: "Sunset" },
  { key: "purple", color: "#7C3AED", label: "Lavender" },
  { key: "rose", color: "#E11D48", label: "Rose" },
  { key: "slate", color: "#475569", label: "Slate" },
];

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

interface ThemeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ThemeDrawer({ open, onOpenChange }: ThemeDrawerProps) {
  const {
    mode,
    palette,
    customColor,
    setMode,
    setPalette,
    setCustomColor,
    reset,
  } = useThemeContext();
  const [hexInput, setHexInput] = useState(customColor || "#0066CC");
  // Preview chip colors — read from DOM after theme changes
  const [previewPrimary, setPreviewPrimary] = useState(() =>
    readCssVar("--primary"),
  );
  const [previewAccent, setPreviewAccent] = useState(() =>
    readCssVar("--accent"),
  );
  const backdropRef = useRef<HTMLDivElement>(null);

  // Re-read CSS vars whenever palette/mode/customColor changes
  const themeKey = `${palette}-${mode}-${customColor}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: themeKey captures all relevant deps
  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewPrimary(readCssVar("--primary"));
      setPreviewAccent(readCssVar("--accent"));
      setHexInput(readCssVar("--primary") || customColor || "#0066CC");
    }, 50);
    return () => clearTimeout(t);
  }, [themeKey]);

  const closeDrawer = () => onOpenChange(false);

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Enter") closeDrawer();
  };

  const handleHexInput = (value: string) => {
    setHexInput(value);
    // Apply only if it looks like a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setCustomColor(value);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          ref={backdropRef}
          role="button"
          tabIndex={0}
          onClick={closeDrawer}
          onKeyDown={handleBackdropKeyDown}
          data-ocid="theme_drawer.modal"
          aria-label="Close appearance settings"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 9998,
            animation: "backdropFadeIn 0.3s ease forwards",
          }}
        />
      )}

      {/* Drawer */}
      <div
        data-ocid="theme_drawer.panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "320px",
          height: "100vh",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)",
          zIndex: 9999,
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: open
            ? "transform 0.35s cubic-bezier(0.4,0,0.2,1)"
            : "transform 0.3s ease-in",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            Appearance
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            data-ocid="theme_drawer.close_button"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Section A: Mode */}
        <div>
          <p
            style={{
              margin: "0 0 12px",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Mode
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {(["light", "dark"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                data-ocid={`theme_drawer.${m}_mode.button`}
                style={{
                  padding: "14px 10px",
                  borderRadius: "12px",
                  border:
                    mode === m
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                  background:
                    mode === m ? "var(--primary-light)" : "var(--bg-input)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  color:
                    mode === m ? "var(--primary)" : "var(--text-secondary)",
                  fontWeight: mode === m ? 700 : 400,
                  fontSize: "13px",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: "22px" }}>
                  {m === "light" ? "☀️" : "🌙"}
                </span>
                {m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>

        {/* Section B: Brand Color */}
        <div>
          <p
            style={{
              margin: "0 0 12px",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Brand Color
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            {PALETTES.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => setPalette(p.key)}
                title={p.label}
                data-ocid={`theme_drawer.${p.key}_palette.button`}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: p.color,
                  border:
                    palette === p.key
                      ? "3px solid white"
                      : "2px solid transparent",
                  cursor: "pointer",
                  transform: palette === p.key ? "scale(1.2)" : "scale(1)",
                  transition: "all 0.2s ease",
                  outline: palette === p.key ? `2px solid ${p.color}` : "none",
                  outlineOffset: "2px",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {palette === p.key ? "✓" : ""}
              </button>
            ))}
          </div>

          {/* Custom Color Row */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              type="color"
              value={customColor || "#0066CC"}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setHexInput(e.target.value);
              }}
              data-ocid="theme_drawer.custom_color.input"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "2px solid var(--border)",
                cursor: "pointer",
                padding: "2px",
                background: "none",
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInput(e.target.value)}
              placeholder="#0066CC"
              maxLength={7}
              data-ocid="theme_drawer.hex_color.input"
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontFamily: "monospace",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "12px",
                whiteSpace: "nowrap",
              }}
            >
              Custom
            </span>
          </div>
        </div>

        {/* Section C: Preview Strip */}
        <div>
          <p
            style={{
              margin: "0 0 10px",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Preview
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { label: "Primary", bg: previewPrimary || "var(--primary)" },
              { label: "Accent", bg: previewAccent || "var(--accent)" },
              { label: "Success", bg: "#10B981" },
            ].map((chip) => (
              <div
                key={chip.label}
                style={{
                  flex: 1,
                  height: "36px",
                  borderRadius: "8px",
                  background: chip.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: "white",
                  fontWeight: 600,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  boxShadow: `0 2px 8px ${chip.bg}40`,
                }}
              >
                {chip.label}
              </div>
            ))}
          </div>
        </div>

        {/* Section D: Reset */}
        <div
          style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}
        >
          <button
            type="button"
            onClick={() => {
              reset();
              setHexInput("#0066CC");
              closeDrawer();
            }}
            data-ocid="theme_drawer.reset.button"
            style={{
              background: "none",
              border: "none",
              color: "var(--danger)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Reset to Default
          </button>
        </div>
      </div>

      <style>{`
        @keyframes backdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
