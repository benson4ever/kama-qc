import { useRef, useState, useEffect, useCallback } from 'react';
import { usePhotoUrl } from '../lib/usePhotoUrl';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SWIPE_PX = 50; // horizontal drag needed (unzoomed) to change photo
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const samePhoto = (a, b) => a === b || (a && b && ((a.id && a.id === b.id) || (a.key && a.key === b.key)));

// photo: the photo that was tapped (null = closed).
// photos: optional list it belongs to, for prev/next (swipe, arrow keys, buttons).
export default function Lightbox({ photo, photos, onClose }) {
  const list = photos && photos.length ? photos : photo ? [photo] : [];
  const [idx, setIdx] = useState(0);
  const current = list[idx] || photo;
  const url = usePhotoUrl(current);
  const [tf, setTf] = useState({ scale: 1, x: 0, y: 0 });
  const tfRef = useRef(tf);
  tfRef.current = tf;
  const [swipeDx, setSwipeDx] = useState(0);
  const pointers = useRef(new Map());
  const start = useRef(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  // Jump to the tapped photo whenever the viewer is (re)opened.
  useEffect(() => {
    if (!photo) return;
    const i = list.findIndex((p) => samePhoto(p, photo));
    setIdx(i >= 0 ? i : 0);
  }, [photo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset zoom/pan whenever a different photo is shown.
  useEffect(() => { setTf({ scale: 1, x: 0, y: 0 }); setSwipeDx(0); }, [current]);

  const hasPrev = idx > 0;
  const hasNext = idx < list.length - 1;
  const go = useCallback((delta) => {
    setIdx((i) => clamp(i + delta, 0, Math.max(list.length - 1, 0)));
  }, [list.length]);

  // Keyboard: ← / → to change photo, Esc to close.
  useEffect(() => {
    if (!photo) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photo, go, onClose]);

  if (!photo) return null;

  const apply = (next) => {
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (scale === MIN_SCALE) setTf({ scale: 1, x: 0, y: 0 });
    else setTf({ scale, x: next.x, y: next.y });
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    moved.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      setSwipeDx(0);
      start.current = { dist: dist(pts[0], pts[1]), mid: mid(pts[0], pts[1]), tf: { ...tfRef.current } };
    } else if (pts.length === 1) {
      start.current = { mid: { x: e.clientX, y: e.clientY }, tf: { ...tfRef.current } };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && start.current.dist) {
      moved.current = true;
      const d = dist(pts[0], pts[1]);
      const m = mid(pts[0], pts[1]);
      const s = start.current;
      apply({
        scale: s.tf.scale * (d / s.dist),
        x: s.tf.x + (m.x - s.mid.x),
        y: s.tf.y + (m.y - s.mid.y),
      });
    } else if (pts.length === 1) {
      const s = start.current;
      const dx = e.clientX - s.mid.x;
      const dy = e.clientY - s.mid.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      if (tfRef.current.scale > 1) {
        apply({ scale: s.tf.scale, x: s.tf.x + dx, y: s.tf.y + dy });
      } else if (!s.dist && list.length > 1) {
        // Unzoomed: drag sideways to swipe; resist at the first/last photo.
        const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
        setSwipeDx(edge ? dx / 4 : dx);
      }
    }
  };

  const onPointerUp = (e) => {
    const s = start.current;
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.entries()];
    if (pts.length === 1) {
      // Resume single-finger panning from the remaining pointer.
      start.current = { mid: { x: pts[0][1].x, y: pts[0][1].y }, tf: { ...tfRef.current }, dist: s && s.dist };
    } else if (pts.length === 0) {
      if (s && !s.dist && p && tfRef.current.scale === 1) {
        const dx = p.x - s.mid.x;
        const dy = p.y - s.mid.y;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }
      setSwipeDx(0);
      const now = Date.now();
      if (!moved.current) {
        if (now - lastTap.current < 300) {
          apply(tfRef.current.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 });
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
      start.current = null;
    }
  };

  const downloadName = () => {
    const base = current.caption
      ? current.caption.replace(/[^\w.-]+/g, '_').slice(0, 60)
      : (current.file_path ? current.file_path.split('/').pop() : 'photo');
    return /\.[a-z0-9]{3,4}$/i.test(base) ? base : `${base}.jpg`;
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lb-bar" onClick={stop}>
        {list.length > 1 && <span className="lb-count">{idx + 1} / {list.length}</span>}
        {url && (
          <a className="lb-btn" href={url} download={downloadName()} aria-label="Download photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M7 11l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </a>
        )}
        <button className="lb-btn" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>
      {hasPrev && (
        <button className="lb-btn lb-nav prev" onClick={(e) => { stop(e); go(-1); }} aria-label="Previous photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      {hasNext && (
        <button className="lb-btn lb-nav next" onClick={(e) => { stop(e); go(1); }} aria-label="Next photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
      {url && (
        <img
          key={url}
          src={url}
          alt={current.caption || ''}
          draggable={false}
          style={{
            transform: `translate(${tf.x + swipeDx}px, ${tf.y}px) scale(${tf.scale})`,
            transition: swipeDx === 0 && pointers.current.size === 0 ? 'transform 0.15s ease-out' : 'none',
          }}
          onClick={stop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
      {current.caption && <div className="cap" onClick={stop}>{current.caption}</div>}
    </div>
  );
}
