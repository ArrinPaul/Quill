"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_EVENT = "quill-priority-sort-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

/** Persists the "Sort by priority" toggle in localStorage without SSR hydration mismatch. */
export function usePrioritySort(storageKey: string) {
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }, [storageKey]);

  const sortByPriority = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggleSortByPriority = useCallback(() => {
    const next = !getSnapshot();
    try {
      window.localStorage.setItem(storageKey, String(next));
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [getSnapshot, storageKey]);

  return { sortByPriority, toggleSortByPriority };
}
