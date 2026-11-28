"use client";

import { useState, type FormEvent } from "react";
import { Loading01 as Loader2 } from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { StudyGroup } from "@/features/types";
import { GroupModal } from "./GroupModal";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (group: StudyGroup) => void;
}

export function CreateGroupModal({ open, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (submitting) return;
    setName("");
    setDescription("");
    setError("");
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    if (trimmedName.length < 3 || trimmedName.length > 60) {
      setError("Group name must be between 3 and 60 characters.");
      return;
    }
    if (trimmedDesc.length > 500) {
      setError("Description must be at most 500 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await api.post<{ group: StudyGroup }>("/api/groups", {
        name: trimmedName,
        description: trimmedDesc || null,
      });
      toast.success(`Created "${res.group.name}"`);
      setName("");
      setDescription("");
      onCreated(res.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create study group.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GroupModal
      open={open}
      title="Create study group"
      titleId="create-group-modal-title"
      busy={submitting}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="create-group-name" className="block text-sm font-medium text-foreground mb-1">
            Group name <span className="text-destructive">*</span>
          </label>
          <input
            id="create-group-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CS301 Algorithms Study"
            minLength={3}
            maxLength={60}
            required
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">3–60 characters</p>
        </div>

        <div>
          <label htmlFor="create-group-desc" className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            id="create-group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group studying?"
            rows={3}
            maxLength={500}
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <p className="mt-1 text-xs text-muted-foreground">{description.trim().length}/500 characters</p>
        </div>

        {error && (
          <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Creating..." : "Create group"}
          </button>
        </div>
      </form>
    </GroupModal>
  );
}
