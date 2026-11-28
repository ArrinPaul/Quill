"use client";

import { useEffect, useState } from "react";
import { Moon01 as Moon, Sun } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { THEME_EVENT, toggleTheme } from "@/lib/theme";

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const label = dark ? "Light mode" : "Dark mode";
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn("flex items-center gap-3 rounded-[10px] p-2 text-sm font-medium cursor-pointer", className)}
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
