import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // If splash was already shown, skip immediately
    if (localStorage.getItem("splashShown") === "true") {
      onComplete();
      return;
    }

    // Start fade-out at 2.0s so animation fully plays for 2.5s total
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // After fade-out animation (0.5s), call onComplete and mark as shown
    const completeTimer = setTimeout(() => {
      localStorage.setItem("splashShown", "true");
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <>
      <style>{`
        @keyframes splashLogoZoomIn {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes splashLogoPulse {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 24px oklch(0.60 0.26 250 / 0.5)); }
          50%       { transform: scale(1.05); filter: drop-shadow(0 0 40px oklch(0.60 0.26 250 / 0.8)); }
        }
        @keyframes splashGlowRing {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
        @keyframes splashTitleIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashTaglineIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .splash-logo-zoom { animation: splashLogoZoomIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .splash-logo-pulse { animation: splashLogoPulse 2s ease-in-out infinite; }
        .splash-glow-ring  { animation: splashGlowRing 2s ease-in-out infinite; }
        .splash-title-in   { animation: splashTitleIn 0.5s ease-out 0.5s both; }
        .splash-tagline-in { animation: splashTaglineIn 0.5s ease-out 1.0s both; }
        .splash-fade-out   { animation: splashFadeOut 0.5s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo-zoom, .splash-logo-pulse, .splash-glow-ring,
          .splash-title-in, .splash-tagline-in, .splash-fade-out { animation: none !important; }
        }
      `}</style>
      <div
        data-ocid="splash.panel"
        className={`fixed inset-0 z-[9999] flex items-center justify-center ${isFadingOut ? "splash-fade-out" : ""}`}
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.18 0.06 250) 0%, oklch(0.08 0 0) 70%)",
        }}
      >
        <div className="flex flex-col items-center gap-6 select-none">
          {/* Glow ring behind logo */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute w-56 h-56 rounded-full splash-glow-ring"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.60 0.26 250 / 0.35) 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            <div
              className="absolute w-48 h-48 rounded-full splash-glow-ring"
              style={{
                border: "1px solid oklch(0.60 0.26 250 / 0.3)",
                animationDelay: "0.3s",
              }}
            />
            {/* Logo — zoom in then pulse */}
            <img
              src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
              alt="ExpenseLeak AI"
              className="relative w-48 h-48 object-contain splash-logo-zoom splash-logo-pulse"
              style={{
                animationDelay: "0s, 0.7s",
              }}
            />
          </div>

          {/* App name — sequential fade-in */}
          <div className="text-center">
            <h1
              className="text-3xl font-bold tracking-widest uppercase splash-title-in"
              style={{ color: "oklch(0.96 0.02 250)", letterSpacing: "0.2em" }}
            >
              ExpenseLeak AI
            </h1>
            <p
              className="mt-2 text-sm tracking-wider splash-tagline-in"
              style={{ color: "oklch(0.65 0.08 250)", letterSpacing: "0.15em" }}
            >
              Personalized Expense Analysis
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
