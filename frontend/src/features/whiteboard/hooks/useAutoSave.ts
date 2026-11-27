import { useEffect, useState, useRef, useCallback } from 'react';
import { Shape, Viewport } from '../lib/shapes';
import { Layer } from './useCanvasEngine';
import { api } from '@/lib/api';

export function useAutoSave(
  whiteboardId: string | null,
  shapes: Shape[],
  viewport: Viewport,
  layers: Layer[],
  title: string
) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitial = useRef(true);
  const pendingSave = useRef<(() => Promise<void>) | null>(null);
  const latestStateRef = useRef({ whiteboardId, shapes, viewport, layers, title });

  useEffect(() => {
    latestStateRef.current = { whiteboardId, shapes, viewport, layers, title };
  }, [whiteboardId, shapes, viewport, layers, title]);

  const performSave = useCallback(async () => {
    const { whiteboardId: id, shapes: s, viewport: v, layers: l, title: t } = latestStateRef.current;
    if (!id) return;
    pendingSave.current = null;
    setSaveStatus('saving');
    try {
      await api.put(`/api/whiteboards/${id}`, {
        title: t,
        data: { shapes: s, viewport: v, layers: l },
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to auto-save whiteboard:', err);
      setSaveStatus('error');
    }
  }, []);

  // Flush an unsaved change when the editor closes or switches boards
  useEffect(() => () => { void pendingSave.current?.(); }, [whiteboardId]);

  useEffect(() => {
    isInitial.current = true;
    setSaveStatus('idle');
  }, [whiteboardId]);

  useEffect(() => {
    if (!whiteboardId) return;

    if (isInitial.current) {
      isInitial.current = false;
      return;
    }

    setSaveStatus('saving');

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    pendingSave.current = performSave;
    timeoutRef.current = setTimeout(() => {
      void performSave();
    }, 3000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [shapes, viewport, layers, title, whiteboardId, performSave]);

  const retry = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void performSave();
  }, [performSave]);

  return { saveStatus, retry };
}
