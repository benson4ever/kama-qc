import { useState } from 'react';
import { usePhotoUrl } from '../lib/usePhotoUrl';
import Lightbox from './Lightbox';

function Thumb({ photo, onClick }) {
  const url = usePhotoUrl(photo, 'thumb');
  return (
    <div className="photo-item">
      <img src={url || ''} alt={photo.caption || ''} loading="lazy" decoding="async" onClick={onClick} />
      {photo.caption ? <div className="cap-text">{photo.caption}</div> : null}
    </div>
  );
}

export default function PhotoGallery({ photos }) {
  const [open, setOpen] = useState(null);
  if (!photos || photos.length === 0) return null;
  return (
    <>
      <div className="photo-grid">
        {photos.map((p) => <Thumb key={p.id} photo={p} onClick={() => setOpen(p)} />)}
      </div>
      <Lightbox photo={open} onClose={() => setOpen(null)} />
    </>
  );
}
