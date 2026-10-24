import { useRef, useState, useEffect } from 'react';
import { usePhotoUrl } from '../lib/usePhotoUrl';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function Lightbox({ photo, onClose }) {
  const url = usePhotoUrl(photo);
  const [tf, setTf] = useState({ scale: 1, x: 0, y: 0 });
  const tfRef = useRef(tf);
  tfRef.current = tf;
  const pointers = useRef(new Map());
  const start = useRef(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  // Reset zoom/pan whenever a new photo is opened.
  useEffect(() => { setTf({ scale: 1, x: 0, y: 0 }); }, [photo]);

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
    } else if (pts.length === 1 && tfRef.current.scale > 1) {
      const s = start.current;
      const dx = e.clientX - s.mid.x;
      const dy = e.clientY - s.mid.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      apply({ scale: s.tf.scale, x: s.tf.x + dx, y: s.tf.y + dy });
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.entries()];
    if (pts.length === 1) {
      // Resume single-finger panning from the remaining pointer.
      start.current = { mid: { x: pts[0][1].x, y: pts[0][1].y }, tf: { ...tfRef.current } };
    } else if (pts.length === 0) {
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
    const base = photo.caption
      ? photo.caption.replace(/[^\w.-]+/g, '_').slice(0, 60)
      : (photo.file_path ? photo.file_path.split('/').pop() : 'photo');
    return /\.[a-z0-9]{3,4}$/i.test(base) ? base : `${base}.jpg`;
  };

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
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
      {url && (
        <img
          src={url}
          alt={photo.caption || ''}
          draggable={false}
          style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.scale})` }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
      {photo.caption && <div className="cap" onClick={(e) => e.stopPropagation()}>{photo.caption}</div>}
    </div>
  );
}
