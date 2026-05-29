import { useEffect, useRef, useState } from 'react';
import { getDraft, setDraft, clearDraft } from '../lib/idb';

// Autosave a form's in-progress value to IndexedDB on every change, restore it
// on mount, and clear it on successful save. Survives tab-discard / reload.
export function useDraft(key, value, { enabled = true } = {}) {
  const [restored, setRestored] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

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

  useEffect(() => {
    if (!enabled || !loaded) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDraft(key, value).catch(() => {}); }, 400);
    return () => clearTimeout(timer.current);
  }, [key, value, enabled, loaded]);

  return {
    restored,
    loaded,
    discard: () => clearDraft(key).catch(() => {}),
  };
}
