import { useEffect, useState } from 'react';

/* Saved photos are plain, cacheable URLs; auth is the qc_photo cookie the
   server sets at login (see useAuth), so <img> tags load them directly and
   the browser keeps them for a year. size 'thumb' = small grid JPEG,
   'full' = the original (lightbox). */
export function photoUrl(filePath, size = 'full') {
  return `/api/uploads/${filePath}${size === 'thumb' ? '?size=thumb' : ''}`;
}

function resolve(photo, size) {
  if (!photo) return null;
  if (photo.previewUrl) return photo.previewUrl;
  if (photo.file_path) return photoUrl(photo.file_path, size);
  return null;
}

// Resolve a photo to a displayable URL: local (unsaved) blob -> object URL,
// server photo (file_path) -> direct URL.
export function usePhotoUrl(photo, size = 'full') {
  const [url, setUrl] = useState(() => resolve(photo, size));
  useEffect(() => {
    if (photo && photo.blob && !photo.previewUrl) {
      const u = URL.createObjectURL(photo.blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setUrl(resolve(photo, size));
    return undefined;
  }, [photo && photo.blob, photo && photo.file_path, photo && photo.previewUrl, size]);
  return url;
}
