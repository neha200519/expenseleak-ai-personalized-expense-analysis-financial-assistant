import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
            alt="ExpenseLeak AI"
            className="h-6 w-6 object-contain"
          />
          <span className="text-sm font-medium text-foreground">
            ExpenseLeak AI
          </span>
        </div>
        <p className="text-sm text-muted-foreground text-center md:text-right">
          © 2025. Built with{" "}
          <Heart className="inline h-4 w-4 text-destructive fill-destructive" />{" "}
          using{" "}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}
