"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { api } from "@/lib/api";
import { toggleTheme } from "@/lib/theme";

export const PALETTE_EVENT = "quill-open-palette";

export interface SearchResult {
  type: "task" | "notice" | "note" | "deck" | "board" | "quiz";
  id: string;
  title: string;
  snippet: string;
  href: string;
}

const PAGES = [
  ["Dashboard", "/dashboard"],
  ["AI Assistant", "/dashboard/ai"],
  ["Tasks", "/dashboard/tasks"],
  ["Task board", "/dashboard/tasks?view=board"],
  ["Calendar", "/dashboard/calendar"],
  ["Notes", "/dashboard/notes"],
  ["Notices", "/dashboard/notices"],
  ["Attendance", "/dashboard/attendance"],
  ["Flashcards", "/dashboard/flashcards"],
  ["Quiz", "/dashboard/quiz"],
  ["Smart Tools", "/dashboard/tools"],
  ["Whiteboard", "/dashboard/whiteboard"],
  ["Settings", "/dashboard/settings"],
] as const;

const ITEM =
  "flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm text-foreground cursor-pointer data-[selected=true]:bg-primary/10";
const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results are kept with the text that produced them, so older answers are never shown.
  const [found, setFound] = useState<{ q: string; results: SearchResult[]; error: string } | null>(null);

  const term = query.trim();
  const searching = term.length >= 2 && term.length <= 100;
  const current = searching && found?.q === term ? found : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    // Capture phase: some browser extensions stop key events before they bubble to window.
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || !searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        .then((res) => setFound({ q: term, results: res.results, error: "" }))
        .catch((err) => {
          if (controller.signal.aborted) return;
          setFound({ q: term, results: [], error: err instanceof Error ? err.message : "Search failed." });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, searching, term]);

  const run = (action: () => void) => {
    setOpen(false);
    setQuery("");
    action();
  };
  const go = (href: string) => run(() => router.push(href));

  const matches = (label: string) => label.toLowerCase().includes(term.toLowerCase());
  const actions = [
    { label: "New task", run: () => go("/dashboard/tasks?new=1") },
    { label: "New note", run: () => go("/dashboard/notes?new=1") },
    { label: "Switch light or dark mode", run: () => run(toggleTheme) },
  ].filter((a) => matches(a.label));
  const pages = PAGES.filter(([label]) => matches(label));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        maxLength={100}
        placeholder="Search or jump to…"
        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        {searching && !current && <Command.Loading className="px-3 py-2 text-sm text-muted-foreground">Searching…</Command.Loading>}
        {current?.error && <p role="alert" className="px-3 py-2 text-sm text-destructive">{current.error}</p>}
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {searching && !current ? "" : "Nothing found."}
        </Command.Empty>

        {current && current.results.length > 0 && (
          <Command.Group heading="Your items" className={GROUP}>
            {current.results.map((r) => (
              <Command.Item key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)} className={ITEM}>
                <span className="truncate">
                  {r.title} <span className="text-xs text-muted-foreground">· {r.type}</span>
                </span>
                {r.snippet && <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {actions.length > 0 && (
          <Command.Group heading="Actions" className={GROUP}>
            {actions.map((a) => (
              <Command.Item key={a.label} value={a.label} onSelect={a.run} className={ITEM}>
                {a.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {pages.length > 0 && (
          <Command.Group heading="Pages" className={GROUP}>
            {pages.map(([label, href]) => (
              <Command.Item key={href} value={href} onSelect={() => go(href)} className={ITEM}>
                {label}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
