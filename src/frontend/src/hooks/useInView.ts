import { useEffect, useRef, useState } from "react";

/**
 * Returns [ref, hasBeenVisible].
 * Once the element enters the viewport it stays "visible" (no re-trigger).
 */
export function useInView<T extends Element>(
  threshold = 0.15,
): [React.MutableRefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}
