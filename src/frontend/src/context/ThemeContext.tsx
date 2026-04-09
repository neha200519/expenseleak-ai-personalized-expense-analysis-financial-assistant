import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type PaletteKey =
  | "ocean"
  | "forest"
  | "sunset"
  | "purple"
  | "rose"
  | "slate"
  | "custom";

interface ThemeContextType {
  setPrimaryColor: (color: string) => void;
  mode: "light" | "dark";
  palette: PaletteKey;
  customColor: string;
  setMode: (m: "light" | "dark") => void;
  setPalette: (p: PaletteKey) => void;
  setCustomColor: (c: string) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/** Convert a hex color string to "r, g, b" for use in rgba() */
function hexToRgb(hex: string): string {
  const n = hex.replace("#", "");
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function mixWithWhite(hex: string, amount: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const mr = Math.round(r + (255 - r) * amount);
  const mg = Math.round(g + (255 - g) * amount);
  const mb = Math.round(b + (255 - b) * amount);
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
}

function darkenColor(hex: string, amount: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<"light" | "dark">(
    () =>
      (localStorage.getItem("expenseLeak-theme-mode") as "light" | "dark") ||
      "light",
  );
  const [palette, setPaletteState] = useState<PaletteKey>(
    () =>
      (localStorage.getItem("expenseLeak-color-palette") as PaletteKey) ||
      "ocean",
  );
  const [customColor, setCustomColorState] = useState(
    () => localStorage.getItem("expenseLeak-custom-color") || "#0066CC",
  );

  const modeRef = useRef(mode);
  const paletteRef = useRef(palette);
  const customColorRef = useRef(customColor);
  modeRef.current = mode;
  paletteRef.current = palette;
  customColorRef.current = customColor;

  const applyTheme = useCallback(
    (m: "light" | "dark", p: PaletteKey, cc: string) => {
      const root = document.documentElement;
      root.setAttribute("data-theme", m);
      root.setAttribute("data-palette", p);

      if (m === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      if (p === "custom") {
        // Apply custom color with all derived tokens
        const light = mixWithWhite(cc, 0.88);
        const dark = darkenColor(cc, 0.2);
        const accent = mixWithWhite(cc, 0.28);
        root.style.setProperty("--primary", cc);
        localStorage.setItem("el-primary", cc);
        root.style.setProperty("--primary-rgb", hexToRgb(cc));
        root.style.setProperty("--primary-light", light);
        root.style.setProperty("--primary-dark", dark);
        root.style.setProperty("--accent", accent);
        root.style.setProperty("--bg-navbar", cc);
        root.style.setProperty("--bg-sidebar", dark);
        root.style.setProperty("--border-focus", cc);
      } else {
        // Set --primary inline based on palette for reliable variable application
        const paletteColors: Record<string, string> = {
          ocean: "#0EA5E9",
          forest: "#16A34A",
          sunset: "#EA580C",
          purple: "#7C3AED",
          rose: "#E11D48",
          slate: "#475569",
        };
        const paletteHex = paletteColors[p] ?? "#0EA5E9";
        root.style.setProperty("--primary", paletteHex);
        localStorage.setItem("el-primary", paletteHex);
        // Compute text-on-primary based on brightness
        const r = Number.parseInt(paletteHex.slice(1, 3), 16);
        const g = Number.parseInt(paletteHex.slice(3, 5), 16);
        const b = Number.parseInt(paletteHex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textOnPrimary = brightness > 128 ? "#0F172A" : "#FFFFFF";
        root.style.setProperty("--text-on-primary", textOnPrimary);
        // Remove other inline overrides so CSS attribute selectors take over
        root.style.removeProperty("--primary-rgb");
        root.style.removeProperty("--primary-light");
        root.style.removeProperty("--primary-dark");
        root.style.removeProperty("--accent");
        root.style.removeProperty("--bg-navbar");
        root.style.removeProperty("--bg-sidebar");
        root.style.removeProperty("--border-focus");
      }
    },
    [],
  );

  const setMode = (m: "light" | "dark") => {
    setModeState(m);
    localStorage.setItem("expenseLeak-theme-mode", m);
    applyTheme(m, paletteRef.current, customColorRef.current);
  };

  const setPalette = (p: PaletteKey) => {
    setPaletteState(p);
    localStorage.setItem("expenseLeak-color-palette", p);
    applyTheme(modeRef.current, p, customColorRef.current);
  };

  const setCustomColor = (c: string) => {
    setCustomColorState(c);
    localStorage.setItem("expenseLeak-custom-color", c);
    setPaletteState("custom");
    localStorage.setItem("expenseLeak-color-palette", "custom");
    applyTheme(modeRef.current, "custom", c);
  };

  const reset = () => {
    localStorage.removeItem("expenseLeak-theme-mode");
    localStorage.removeItem("expenseLeak-color-palette");
    localStorage.removeItem("expenseLeak-custom-color");
    setModeState("light");
    setPaletteState("ocean");
    setCustomColorState("#0066CC");
    applyTheme("light", "ocean", "#0066CC");
  };

  // Apply theme once on mount
  useEffect(() => {
    applyTheme(modeRef.current, paletteRef.current, customColorRef.current);
    const savedElPrimary = localStorage.getItem("el-primary");
    if (savedElPrimary) {
      document.documentElement.style.setProperty("--primary", savedElPrimary);
    }
  }, [applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        customColor,
        setMode,
        setPalette,
        setCustomColor,
        setPrimaryColor: setCustomColor,
        reset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useThemeContext must be used inside ThemeProvider");
  return ctx;
}
