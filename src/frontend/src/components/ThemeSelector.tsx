import { Check, Moon, Palette, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useSaveUserTheme } from "../hooks/useQueries";
import {
  AVAILABLE_COLOR_THEMES,
  type ColorThemeName,
  createThemePreferenceInput,
  useThemeStore,
} from "../hooks/useThemeCustomization";

export default function ThemeSelector() {
  const { currentColorTheme, setColorTheme } = useThemeStore();
  const { theme: systemTheme, setTheme } = useTheme();
  const { mutate: saveTheme } = useSaveUserTheme();
  const { identity } = useInternetIdentity();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isDarkMode = systemTheme === "dark";

  const handleColorThemeChange = (themeName: ColorThemeName) => {
    setColorTheme(themeName);
    if (identity) {
      const input = createThemePreferenceInput(themeName, isDarkMode);
      saveTheme(input);
    }
  };

  const handleDarkModeToggle = () => {
    const newMode = isDarkMode ? "light" : "dark";
    setTheme(newMode);
    if (identity) {
      const input = createThemePreferenceInput(
        currentColorTheme,
        newMode === "dark",
      );
      saveTheme(input);
    }
  };

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const currentConfig = AVAILABLE_COLOR_THEMES.find(
    (t) => t.name === currentColorTheme,
  );

  return (
    <div className="relative">
      {/* Trigger button — palette icon only */}
      <button
        ref={triggerRef}
        data-ocid="theme_selector.open_modal_button"
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        title="Choose theme"
        aria-label="Open theme selector"
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Floating panel */}
      {isOpen && (
        <div
          ref={panelRef}
          data-ocid="theme_selector.panel"
          className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Color Theme
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentConfig?.label}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Dark / Light toggle */}
              <button
                data-ocid="theme_selector.toggle"
                type="button"
                onClick={handleDarkModeToggle}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                title={
                  isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {isDarkMode ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                {isDarkMode ? "Light" : "Dark"}
              </button>
              <button
                data-ocid="theme_selector.close_button"
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Theme grid */}
          <div className="p-3 grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
            {AVAILABLE_COLOR_THEMES.map((theme) => {
              const sw = isDarkMode ? theme.swatchesDark : theme.swatches;
              const isActive = currentColorTheme === theme.name;
              return (
                <button
                  key={theme.name}
                  data-ocid={`theme_selector.${theme.name}.button`}
                  type="button"
                  onClick={() => handleColorThemeChange(theme.name)}
                  className={`group relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all text-center hover:scale-105 active:scale-95 ${
                    isActive
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/50 hover:bg-accent/50"
                  }`}
                  title={theme.description}
                >
                  {/* Swatch row */}
                  <div className="flex gap-1">
                    {sw.map((color, idx) => (
                      <span
                        key={color}
                        className={`block rounded-full ring-1 ring-border ${
                          idx === 0 ? "w-5 h-5" : "w-3.5 h-3.5 mt-0.5"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {/* Label */}
                  <span
                    className={`text-[10px] font-medium leading-tight ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {theme.label}
                  </span>
                  {/* Active checkmark */}
                  {isActive && (
                    <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border bg-muted/40">
            <p className="text-[10px] text-muted-foreground text-center">
              Theme is saved to your profile
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
