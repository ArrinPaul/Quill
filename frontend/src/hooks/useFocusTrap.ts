import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep Tab inside a modal while it is mounted, then give focus back to where it was. */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // Read during the first render, before autoFocus inside the modal moves it.
  const previousRef = useRef<Element | null>(
    typeof document === "undefined" ? null : document.activeElement
  );

  useEffect(() => {
    const container = ref.current;
    const previous = previousRef.current;
    if (!container) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !container.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return ref;
}
