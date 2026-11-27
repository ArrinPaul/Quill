"use client";

import { useEffect, useState } from "react";
import { Moon01 as Moon, Sun } from "@untitledui/icons";
import { cn } from "@/lib/utils";

const THEME_EVENT = "quill-theme-change";

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("Quill_theme", next ? "dark" : "light");
    } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const label = dark ? "Light mode" : "Dark mode";
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn("flex items-center gap-3 rounded-[10px] p-2 text-sm font-medium cursor-pointer", className)}
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
