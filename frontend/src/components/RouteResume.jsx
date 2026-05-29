import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const KEY = 'kama_qc_last_path';
const TS_KEY = 'kama_qc_last_path_ts';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // resume only within 6h of the last session

// iOS relaunches an installed/standalone PWA at the manifest start_url ("/"),
// losing the page you were on. This remembers the last route and, if the app
// just reopened at the dashboard after a recent session, resumes that route —
// so an in-progress entry stays open instead of bouncing to the dashboard.
export default function RouteResume() {
  const location = useLocation();
  const navigate = useNavigate();
  const checked = useRef(false);

  // run once on startup, before remembering the current "/"
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    try {
      const saved = localStorage.getItem(KEY);
      const ts = parseInt(localStorage.getItem(TS_KEY) || '0', 10);
      const current = location.pathname + location.search;
      if (saved && saved !== current && saved !== '/login' && current === '/' && Date.now() - ts < MAX_AGE_MS) {
        navigate(saved, { replace: true });
      }
    } catch { /* ignore */ }
  }, []);

  // remember the current location (skip the login screen)
  useEffect(() => {
    const path = location.pathname + location.search;
    if (path !== '/login') {
      try {
        localStorage.setItem(KEY, path);
        localStorage.setItem(TS_KEY, String(Date.now()));
      } catch { /* ignore */ }
    }
  }, [location]);

  return null;
}
