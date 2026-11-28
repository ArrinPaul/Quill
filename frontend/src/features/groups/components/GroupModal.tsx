"use client";

import type { ReactNode } from "react";
import { XClose as X } from "@untitledui/icons";
import { useEscape } from "@/hooks/useEscape";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface GroupModalProps {
  open: boolean;
  title: string;
  titleId: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}

function GroupModalInner({
  title,
  titleId,
  busy = false,
  onClose,
  children,
}: Omit<GroupModalProps, "open">) {
  useEscape(!busy, onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[10px] border border-border bg-card p-5 sm:p-6 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-standard disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GroupModal({ open, ...props }: GroupModalProps) {
  if (!open) return null;
  return <GroupModalInner {...props} />;
}
