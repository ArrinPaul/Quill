"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface EmailPreferences {
  reminders: boolean;
  digest: boolean;
  /** False when the server has no email provider set up. */
  available: boolean;
}

const OPTIONS = [
  ["reminders", "Deadline reminders", "An email at a task's reminder time."],
  ["digest", "Weekly summary", "Overdue and upcoming tasks, once a week."],
] as const;

export function EmailSettingsCard() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<EmailPreferences>("/api/email-preferences")
      .then(setPrefs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load email settings."));
  }, []);

  const change = async (key: "reminders" | "digest", value: boolean) => {
    setSaving(true);
    setError("");
    try {
      setPrefs(await api.put<EmailPreferences>("/api/email-preferences", { [key]: value }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-[10px] p-6 shadow-sm space-y-4">
      <h3 className="font-semibold text-foreground text-base border-b border-border pb-3">Email</h3>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!prefs && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
      {prefs && (
        <>
          {!prefs.available && (
            <p className="text-sm text-muted-foreground">
              Email is not set up on this server yet. Your choices are saved and apply once it is.
            </p>
          )}
          {OPTIONS.map(([key, label, help]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[key]}
                disabled={saving}
                onChange={(e) => void change(key, e.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{help}</span>
              </span>
            </label>
          ))}
        </>
      )}
    </div>
  );
}
