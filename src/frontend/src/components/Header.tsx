import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart2,
  Calculator,
  Clock,
  FileText,
  Home,
  Lightbulb,
  Map as MapIcon,
  Menu,
  MessageCircle,
  Moon,
  Palette,
  PlusCircle,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { useThemeContext } from "../context/ThemeContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "../hooks/useQueries";
import ThemeDrawer from "./ThemeDrawer";

export default function Header() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { mode, setMode } = useThemeContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeSpinning, setThemeSpinning] = useState(false);
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
  const { data: userProfile } = useGetCallerUserProfile();

  const isAuthenticated = !!identity;
  const currentPath = routerState.location.pathname;

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
    setMobileMenuOpen(false);
  };

  const handleThemeToggle = () => {
    setThemeSpinning(true);
    setMode(mode === "dark" ? "light" : "dark");
    setTimeout(() => setThemeSpinning(false), 500);
  };

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/add-expense", label: "Add Expense", icon: PlusCircle },
    { path: "/insights", label: "Insights", icon: Lightbulb },
    { path: "/analytics", label: "Analytics", icon: BarChart2 },
    { path: "/history", label: "History", icon: Clock },
    { path: "/chat", label: "AI Assistant", icon: MessageCircle },
    { path: "/calculator", label: "Calculator", icon: Calculator },
    { path: "/documents", label: "Documents", icon: FileText },
    { path: "/maps", label: "Maps", icon: MapIcon },
  ];

  // Get initials from user name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Truncate greeting name to 10 characters
  const truncateName = (name: string): string => {
    if (name.length <= 10) return name;
    return `${name.slice(0, 10)}...`;
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b shadow-sm"
        style={{
          background:
            "color-mix(in srgb, var(--bg-card, #fff) 80%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
        }}
      >
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
              alt="ExpenseLeak AI"
              className="h-8 w-8 object-contain transition-transform duration-200 hover:scale-110"
            />
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              data-ocid="nav.link"
              className="logo-shimmer text-lg font-bold font-bricolage bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              ExpenseLeak AI
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  data-ocid="nav.link"
                  onClick={() => navigate({ to: item.path })}
                  title={item.label}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`
                    nav-link-animated inline-flex items-center px-2.5 py-2 text-sm font-medium
                    rounded-md transition-all duration-200 animate-fade-up
                    ${
                      isActive
                        ? "text-primary active rounded-none border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }
                  `}
                >
                  <Icon
                    className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 lg:mr-1.5 ${
                      isActive ? "scale-110" : ""
                    }`}
                  />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            {userProfile && (
              <span
                className="animate-fade-up stagger-1"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--primary)",
                  borderRadius: 999,
                  padding: "4px 12px 4px 4px",
                  fontSize: 13,
                  color: "var(--text-on-primary)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  maxWidth: 180,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    color: "var(--text-on-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(userProfile.name)}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Hello, {truncateName(userProfile.name)}
                </span>
              </span>
            )}
            {/* Palette / Theme Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThemeDrawerOpen(true)}
              data-ocid="nav.theme_palette_button"
              title="Appearance Settings"
              aria-label="Open appearance settings"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
              }}
            >
              <Palette className="h-4 w-4" />
            </Button>
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleThemeToggle}
              data-ocid="nav.toggle"
              className="relative"
              style={{ transition: "transform 0.3s ease" }}
            >
              <span
                className={themeSpinning ? "animate-spin-once" : ""}
                style={{ display: "inline-flex" }}
              >
                {mode === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </span>
            </Button>
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-ocid="nav.button"
                className="btn-interactive"
              >
                Logout
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThemeDrawerOpen(true)}
              aria-label="Open appearance settings"
              style={{ width: 36, height: 36, borderRadius: "50%" }}
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleThemeToggle}
              className="relative"
            >
              <span
                className={themeSpinning ? "animate-spin-once" : ""}
                style={{ display: "inline-flex" }}
              >
                {mode === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-ocid="nav.button"
              className="transition-transform duration-200 hover:scale-110"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 transition-transform duration-200 rotate-0" />
              ) : (
                <Menu className="h-5 w-5 transition-transform duration-200" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu — slide-down */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background shadow-lg animate-page-enter">
            <nav className="container py-3 flex flex-col gap-1">
              {userProfile && (
                <div
                  className="px-3 py-2 mb-2 border-b flex items-center gap-2"
                  style={{ fontSize: 13, color: "var(--text-secondary)" }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--primary, #0066cc)",
                      color: "var(--text-on-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(userProfile.name)}
                  </span>
                  Hello, {userProfile.name}
                </div>
              )}
              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    data-ocid="nav.link"
                    style={{ animationDelay: `${idx * 35}ms` }}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium
                      transition-all duration-200 text-left animate-fade-up
                      ${
                        isActive
                          ? "text-primary bg-primary/8 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }
                    `}
                    onClick={() => {
                      navigate({ to: item.path });
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="mt-2 w-full btn-interactive"
                  data-ocid="nav.button"
                >
                  Logout
                </Button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Theme Drawer — controlled from navbar palette button */}
      <ThemeDrawer open={themeDrawerOpen} onOpenChange={setThemeDrawerOpen} />
    </>
  );
}
