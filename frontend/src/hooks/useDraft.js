import { useEffect, useRef, useState } from 'react';
import { getDraft, setDraft, clearDraft } from '../lib/idb';

// Autosave a form's in-progress value to IndexedDB, restore it on mount, and
// clear it on successful save. Survives iOS Safari tab-discard / reload.
//
// Two save paths:
//  - debounced save as the user types (covers normal editing)
//  - an *immediate* flush when the tab is backgrounded (visibilitychange ->
//    hidden / pagehide), so the last keystrokes aren't lost if iOS suspends or
//    discards the tab the moment you switch to another app.
export function useDraft(key, value, { enabled = true } = {}) {
  const [restored, setRestored] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  // restore on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await getDraft(key);
        if (active && d) setRestored(d);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [key]);

  // debounced autosave while editing
  useEffect(() => {
    if (!enabled || !loaded) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDraft(key, latest.current).catch(() => {}); }, 400);
    return () => clearTimeout(timer.current);
  }, [key, value, enabled, loaded]);

  // immediate flush right before the tab is backgrounded/discarded
  useEffect(() => {
    if (!enabled) return;
    const flush = () => { setDraft(key, latest.current).catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [key, enabled]);

  return { restored, loaded, discard: () => clearDraft(key).catch(() => {}) };
}
