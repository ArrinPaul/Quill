import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Note } from "@/features/types";

export type NoteSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

interface UseNoteAutoSaveOptions {
  noteId: string | null;
  title: string;
  content: string;
  version: number;
  onSaved: (note: Note) => void;
}

export function useNoteAutoSave({
  noteId,
  title,
  content,
  version,
  onSaved,
}: UseNoteAutoSaveOptions) {
  const [statusState, setStatusState] = useState<{
    noteId: string | null;
    status: NoteSaveStatus;
  }>({ noteId: null, status: "idle" });
  const saveStatus: NoteSaveStatus =
    statusState.noteId === noteId ? statusState.status : "idle";
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialRef = useRef(true);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const versionRef = useRef(version);
  const onSavedRef = useRef(onSaved);
  const latestRef = useRef({ noteId, title, content });

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    latestRef.current = { noteId, title, content };
  }, [noteId, title, content]);

  const performSave = useCallback(async (force = false) => {
    const { noteId: id, title: t, content: c } = latestRef.current;
    if (!id) return;
    pendingSaveRef.current = null;
    setStatusState({ noteId: id, status: "saving" });
    try {
      const res = await api.put<{ note: Note }>(`/api/notes/${id}`, {
        title: t.trim() || "Untitled",
        content: c,
        version: versionRef.current,
        ...(force ? { force: true } : {}),
      });
      versionRef.current = res.note.version;
      onSavedRef.current(res.note);
      setStatusState({ noteId: id, status: "saved" });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Conflict:")) {
        setStatusState({ noteId: id, status: "conflict" });
        return;
      }
      console.error("Failed to auto-save note:", err);
      setStatusState({ noteId: id, status: "error" });
    }
  }, []);

  // Reset initial flag and version when switching notes
  useEffect(() => {
    isInitialRef.current = true;
    versionRef.current = version;
    pendingSaveRef.current = null;
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush unsaved changes on unmount, note switch, or pagehide
  useEffect(() => {
    const flush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void pendingSaveRef.current?.();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [noteId]);

  // Debounce 2s autosave on title or content changes
  useEffect(() => {
    if (!noteId) return;

    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }

    setStatusState({ noteId, status: "saving" });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    pendingSaveRef.current = () => performSave(false);
    timeoutRef.current = setTimeout(() => {
      void performSave(false);
    }, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [title, content, noteId, performSave]);

  const retry = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void performSave(false);
  }, [performSave]);

  const overwrite = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void performSave(true);
  }, [performSave]);

  const syncAfterReload = useCallback((nextVersion: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pendingSaveRef.current = null;
    isInitialRef.current = true;
    versionRef.current = nextVersion;
    setStatusState({ noteId: null, status: "idle" });
  }, []);

  return { saveStatus, retry, overwrite, syncAfterReload };
}
