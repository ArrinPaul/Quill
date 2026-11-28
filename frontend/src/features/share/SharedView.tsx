"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

type Shared =
  | { type: "note"; title: string; content: string }
  | { type: "deck"; title: string; cards: { front: string; back: string }[] };

export function SharedView({ token }: { token: string }) {
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Shared>(`/api/public/${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "This link is not available."));
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground">Shared from Quill · read only</p>
      {error && <p role="alert" className="text-foreground">{error}</p>}
      {!data && !error && <p className="text-muted-foreground">Loading…</p>}
      {data && <h1 className="text-2xl font-bold text-foreground break-words">{data.title}</h1>}
      {data?.type === "note" && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // A remote image would tell its host who opened the link.
              img: ({ alt }) => <span>[image: {alt || "no description"}]</span>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {children}
                </a>
              ),
            }}
          >
            {data.content}
          </ReactMarkdown>
        </div>
      )}
      {data?.type === "deck" && (
        <ul className="space-y-2">
          {data.cards.map((card, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground whitespace-pre-wrap break-words">{card.front}</p>
              <details className="mt-1">
                <summary className="text-xs text-muted-foreground cursor-pointer">Show answer</summary>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">{card.back}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
