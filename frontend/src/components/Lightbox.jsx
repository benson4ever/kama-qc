import { usePhotoUrl } from '../lib/usePhotoUrl';

export default function Lightbox({ photo, onClose }) {
  const url = usePhotoUrl(photo);
  if (!photo) return null;
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="close" onClick={onClose}>×</button>
      {url && <img src={url} alt={photo.caption || ''} onClick={(e) => e.stopPropagation()} />}
      {photo.caption && <div className="cap">{photo.caption}</div>}
    </div>
  );
}
