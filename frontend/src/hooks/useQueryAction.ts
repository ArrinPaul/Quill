import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Run `handle` once for a `?name=value` in the address (from the command palette or a
 * search result), then remove it so a refresh does not repeat the action.
 * Pass `ready: false` while the page is still loading the data the action needs.
 */
export function useQueryAction(name: string, ready: boolean, handle: (value: string) => void) {
  const pathname = usePathname();
  const value = useSearchParams().get(name);
  const handleRef = useRef(handle);

  useEffect(() => {
    handleRef.current = handle;
  });

  useEffect(() => {
    if (!ready || value === null) return;
    // Not from `params`: another action may have changed the address in this same pass.
    const rest = new URLSearchParams(window.location.search);
    rest.delete(name);
    const query = rest.toString();
    // Next keeps useSearchParams in step with native history updates.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    handleRef.current(value);
  }, [ready, value, name, pathname]);
}
