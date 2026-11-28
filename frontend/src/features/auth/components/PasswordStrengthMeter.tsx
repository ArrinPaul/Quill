"use client";

import { evaluatePasswordStrength } from "@/features/auth/lib/passwordStrength";

interface PasswordStrengthMeterProps {
  password: string;
}

const BAR_CLASSES = [
  "bg-muted",
  "bg-destructive",
  "bg-amber-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
] as const;

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, meetsMinimum } = evaluatePasswordStrength(password);
  const activeBarClass = BAR_CLASSES[score] || BAR_CLASSES[1];

  return (
    <div className="mt-1.5 space-y-1" aria-live="polite">
      <div className="flex gap-1" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={5} aria-label="Password strength">
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors ${
              segment <= score ? activeBarClass : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs ${
          !meetsMinimum
            ? "text-destructive"
            : score >= 4
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
    </div>
  );
}
