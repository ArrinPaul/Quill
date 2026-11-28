import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Note } from "@/features/types";
import { createNoteSaver, type NoteSaver, type SaveResult } from "../lib/autoSaver";

export type NoteSaveStatus = "idle" | SaveResult;

interface UseNoteAutoSaveOptions {
  noteId: string | null;
  title: string;
  content: string;
  onSaved: (note: Note) => void;
}

// Browsers refuse keepalive requests with bodies over 64KB.
const KEEPALIVE_MAX_CHARS = 20_000;

export function useNoteAutoSave({ noteId, title, content, onSaved }: UseNoteAutoSaveOptions) {
  const [state, setState] = useState<{ noteId: string | null; status: NoteSaveStatus }>({
    noteId: null,
    status: "idle",
  });
  const saveStatus: NoteSaveStatus = state.noteId === noteId ? state.status : "idle";
  const sessionRef = useRef<{ id: string; saver: NoteSaver } | null>(null);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  /** Start tracking a note that was just loaded from the server. */
  const begin = useCallback((note: Note) => {
    const saver: NoteSaver = createNoteSaver(
      note,
      async ({ title: t, content: c, version, force, keepalive }) => {
        const res = await api.put<{ note: Note }>(
          `/api/notes/${note.id}`,
          { title: t.trim() || "Untitled", content: c, version, ...(force ? { force: true } : {}) },
          { keepalive: keepalive && c.length <= KEEPALIVE_MAX_CHARS }
        );
        onSavedRef.current(res.note);
        return res.note.version;
      },
      (status) => {
        if (sessionRef.current?.saver === saver) {
          setState({ noteId: note.id, status });
        } else if (status === "error" || status === "conflict") {
          toast.error(`Your last changes to "${note.title}" could not be saved.`);
        }
      }
    );
    sessionRef.current = { id: note.id, saver };
    setState({ noteId: note.id, status: "idle" });
  }, []);

  /** Stop tracking the open note, saving it first unless the text should be dropped. */
  const end = useCallback((options: { discard?: boolean } = {}) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return Promise.resolve();
    if (options.discard) {
      session.saver.discard();
      return Promise.resolve();
    }
    return session.saver.flush();
  }, []);

  // Autosave 2s after the last edit
  useEffect(() => {
    const session = sessionRef.current;
    // Until the new note has loaded, title and content still belong to the previous one.
    if (!session || session.id !== noteId) return;
    session.saver.update({ title, content });
    if (!session.saver.isDirty()) return;
    const timer = setTimeout(() => void session.saver.save(), 2000);
    return () => clearTimeout(timer);
  }, [noteId, title, content]);

  useEffect(() => {
    const flush = () => void sessionRef.current?.saver.flush({ keepalive: true });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const retry = useCallback(() => void sessionRef.current?.saver.save(), []);
  const overwrite = useCallback(() => void sessionRef.current?.saver.save({ force: true }), []);

  return { saveStatus, begin, end, retry, overwrite };
}
