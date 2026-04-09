import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ColorTheme, ThemePreference } from "../types/backend-types";

export type ColorThemeName =
  | "arcticMist"
  | "goldenDusk"
  | "mochaRose"
  | "sapphireTide"
  | "jadeHorizon"
  | "crimsonEmber"
  | "violetStorm"
  | "oceanDepth"
  | "slateSteel";

export interface ColorThemeConfig {
  name: ColorThemeName;
  label: string;
  description: string;
  /** Representative swatch colors [primary, accent, background] */
  swatches: [string, string, string];
  swatchesDark: [string, string, string];
}

export const AVAILABLE_COLOR_THEMES: ColorThemeConfig[] = [
  {
    name: "arcticMist",
    label: "Arctic Mist",
    description: "Icy blue with cool silver tones",
    swatches: ["#4a90d9", "#a8c8f0", "#f5f8fd"],
    swatchesDark: ["#6aaee8", "#3a5a80", "#141d2e"],
  },
  {
    name: "goldenDusk",
    label: "Golden Dusk",
    description: "Warm amber honey with rich gold",
    swatches: ["#c8882a", "#e8c070", "#faf5ed"],
    swatchesDark: ["#e8a840", "#7a5018", "#241808"],
  },
  {
    name: "mochaRose",
    label: "Mocha Rose",
    description: "Espresso brown with blush rose",
    swatches: ["#7a4a30", "#e8889a", "#faf4f2"],
    swatchesDark: ["#c07858", "#c87888", "#1e1008"],
  },
  {
    name: "sapphireTide",
    label: "Sapphire Tide",
    description: "Deep cobalt blue with electric cyan",
    swatches: ["#2a5cd8", "#4ab8d8", "#f2f5fc"],
    swatchesDark: ["#5888e8", "#3080b0", "#0c1228"],
  },
  {
    name: "jadeHorizon",
    label: "Jade Horizon",
    description: "Deep emerald with fresh mint",
    swatches: ["#2a9870", "#70d8a8", "#f2faf7"],
    swatchesDark: ["#50c890", "#286850", "#0c1e18"],
  },
  {
    name: "crimsonEmber",
    label: "Crimson Ember",
    description: "Deep red with warm coral fire",
    swatches: ["#c83828", "#e88048", "#faf4f2"],
    swatchesDark: ["#e05848", "#a04828", "#1e0c08"],
  },
  {
    name: "violetStorm",
    label: "Violet Storm",
    description: "Deep indigo with electric violet",
    swatches: ["#6028c8", "#c060e0", "#f7f2fc"],
    swatchesDark: ["#9060e0", "#602898", "#140c22"],
  },
  {
    name: "oceanDepth",
    label: "Ocean Depth",
    description: "Teal with deep sea green",
    swatches: ["#2898b8", "#60c898", "#f2f8fa"],
    swatchesDark: ["#50b8d0", "#287858", "#0c1a1e"],
  },
  {
    name: "slateSteel",
    label: "Slate Steel",
    description: "Professional grey-blue, refined minimal",
    swatches: ["#5060a0", "#8898c8", "#f4f5f8"],
    swatchesDark: ["#7888c0", "#384068", "#10121e"],
  },
];

interface ThemeStore {
  currentColorTheme: ColorThemeName;
  setColorTheme: (theme: ColorThemeName) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      currentColorTheme: "arcticMist",
      setColorTheme: (theme: ColorThemeName) => {
        document.documentElement.setAttribute("data-color-theme", theme);
        set({ currentColorTheme: theme });
      },
    }),
    {
      name: "expense-leak-theme",
      onRehydrateStorage: () => (state) => {
        if (state?.currentColorTheme) {
          document.documentElement.setAttribute(
            "data-color-theme",
            state.currentColorTheme,
          );
        }
      },
    },
  ),
);

// Convert ColorThemeName to backend ColorTheme object
export function colorThemeNameToBackend(themeName: ColorThemeName): ColorTheme {
  const config = AVAILABLE_COLOR_THEMES.find((t) => t.name === themeName);
  return {
    name: themeName,
    primary: config?.swatches[0] ?? "#4a90d9",
    secondary: config?.swatches[1] ?? "#a8c8f0",
    accent: config?.swatches[1] ?? "#a8c8f0",
    background: config?.swatches[2] ?? "#f5f8fd",
    isDark: false,
  };
}

// Convert backend ColorTheme object to ColorThemeName
export function backendColorThemeToName(theme: ColorTheme): ColorThemeName {
  return (theme.name as ColorThemeName) || "arcticMist";
}

// Create ThemePreference for backend
export function createThemePreferenceInput(
  colorTheme: ColorThemeName,
  isDarkMode: boolean,
): ThemePreference {
  return {
    mode: isDarkMode ? "dark" : "light",
    palette: colorTheme,
    customColor: undefined,
  };
}
