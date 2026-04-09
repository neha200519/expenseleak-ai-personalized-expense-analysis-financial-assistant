import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a page with a smooth fade-up entrance animation.
 * Uses pure CSS — no external animation library required.
 */
export default function PageTransition({
  children,
  className = "",
}: PageTransitionProps) {
  return <div className={`animate-page-enter ${className}`}>{children}</div>;
}
