import { useEffect, useState } from 'react';
import { fetchObjectUrl } from '../api/client';

// Resolve a photo to a displayable URL: local blob -> object URL,
// server photo (file_path) -> authenticated fetch -> object URL.
export function usePhotoUrl(photo) {
  const [url, setUrl] = useState((photo && photo.previewUrl) || null);
  useEffect(() => {
    let active = true; let revoke = null;
    if (!photo) { setUrl(null); return; }
    if (photo.previewUrl) { setUrl(photo.previewUrl); return; }
    if (photo.blob) {
      const u = URL.createObjectURL(photo.blob); revoke = u; setUrl(u);
    } else if (photo.file_path) {
      fetchObjectUrl(photo.file_path).then((u) => { if (active) { revoke = u; setUrl(u); } }).catch(() => {});
    }
    return () => { active = false; if (revoke) URL.revokeObjectURL(revoke); };
  }, [photo && photo.blob, photo && photo.file_path, photo && photo.previewUrl]);
  return url;
}
