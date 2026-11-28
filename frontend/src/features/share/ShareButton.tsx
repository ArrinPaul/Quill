"use client";

import { useEffect, useState } from "react";
import { Share07 as Share, XClose as X } from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useEscape } from "@/hooks/useEscape";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ShareProps {
  type: "note" | "deck";
  id: string;
}

type LinkState = { id: string; url?: string } | null;

const BUTTON = "px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-accent cursor-pointer disabled:opacity-50";

function ShareDialog({ type, id, onClose }: ShareProps & { onClose: () => void }) {
  // undefined while checking whether the item is already shared
  const [link, setLink] = useState<LinkState | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useFocusTrap<HTMLDivElement>();
  useEscape(true, onClose);

  useEffect(() => {
    api
      .get<{ link: { id: string } | null }>(`/api/share-links?resource_type=${type}&resource_id=${id}`)
      .then((res) => setLink(res.link))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not check sharing."));
  }, [type, id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const res = await api.post<{ link: { id: string }; token: string }>("/api/share-links", {
        resource_type: type,
        resource_id: id,
      });
      setLink({ id: res.link.id, url: `${window.location.origin}/share/${res.token}` });
    });

  const revoke = (linkId: string) =>
    run(async () => {
      await api.delete(`/api/share-links/${linkId}`);
      setLink(null);
      toast.success("Link turned off.");
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. Select the link and copy it yourself.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Share this ${type}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Share this {type}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="p-1 rounded-md hover:bg-accent text-muted-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Anyone with the link can read the title and {type === "note" ? "text" : "cards"}. They cannot change anything.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {link === undefined && !error && <p className="text-sm text-muted-foreground">Checking…</p>}

        {link === null && (
          <button type="button" onClick={create} disabled={busy} className={BUTTON}>
            Create link
          </button>
        )}

        {link && (
          <>
            {link.url ? (
              <>
                <input
                  readOnly
                  value={link.url}
                  aria-label="Share link"
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
                />
                <p className="text-xs text-muted-foreground">Copy it now. It is shown only once.</p>
              </>
            ) : (
              <p className="text-sm text-foreground">This {type} has an active link. A new link replaces it.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {link.url && (
                <button type="button" onClick={() => void copy(link.url!)} className={BUTTON}>
                  Copy link
                </button>
              )}
              {!link.url && (
                <button type="button" onClick={create} disabled={busy} className={BUTTON}>
                  New link
                </button>
              )}
              <button type="button" onClick={() => revoke(link.id)} disabled={busy} className={`${BUTTON} text-destructive`}>
                Turn off link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ShareButton({ type, id, className }: ShareProps & { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-medium cursor-pointer"}
      >
        <Share className="w-3.5 h-3.5" />
        Share
      </button>
      {open && <ShareDialog key={id} type={type} id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
