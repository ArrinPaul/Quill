"use client";

import { Share04 as Share2 } from "@untitledui/icons";

export function GroupSharedTab() {
  return (
    <section className="rounded-[10px] border border-border bg-card p-8 text-center shadow-sm space-y-3">
      <div className="mx-auto w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Share2 className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-bold text-foreground">Shared resources</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Shared notes, flashcard decks, whiteboards, and quizzes will appear here once sharing is
        enabled in the next update.
      </p>
    </section>
  );
}
