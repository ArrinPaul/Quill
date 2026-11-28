"use client";

import { useState } from "react";
import {
  Check,
  Edit01 as Edit2,
  Loading01 as Loader2,
  MessageSquare01 as MessageSquare,
  Plus,
  Trash01 as Trash2,
  XClose as X,
} from "@untitledui/icons";
import type { AiConversation } from "@/features/types";

interface ConversationSidebarProps {
  conversations: AiConversation[];
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCloseDrawer?: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  loading,
  creating,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onCloseDrawer,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (conv: AiConversation) => {
    setEditingId(conv.id);
    setDraftTitle(conv.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const commitEdit = async (id: string) => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    setSavingId(id);
    try {
      await onRename(id, trimmed);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>New chat</span>
        </button>
        {onCloseDrawer && (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close conversations drawer"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading chats...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No saved chats yet. Start a conversation or click New chat.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const isEditing = editingId === conv.id;
            const isBusy = savingId === conv.id || deletingId === conv.id;

            if (isEditing) {
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-1 p-1.5 rounded-xl bg-muted border border-border"
                >
                  <input
                    type="text"
                    aria-label="Rename conversation"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitEdit(conv.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    aria-label="Save title"
                    disabled={isBusy}
                    onClick={() => void commitEdit(conv.id)}
                    className="p-1.5 rounded-lg text-primary hover:bg-background transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel rename"
                    onClick={cancelEdit}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground font-medium border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(conv.id);
                    onCloseDrawer?.();
                  }}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
                  <span className="truncate">{conv.title}</span>
                </button>
                <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Rename ${conv.title}`}
                    disabled={isBusy}
                    onClick={() => startEdit(conv)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${conv.title}`}
                    disabled={isBusy}
                    onClick={() => void handleDelete(conv.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-background transition-colors cursor-pointer"
                  >
                    {deletingId === conv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
