import { compressImage } from '../lib/imageCompress';
import { uid } from '../lib/uid';
import { usePhotoUrl } from '../lib/usePhotoUrl';

function Thumb({ photo, onClick }) {
  const url = usePhotoUrl(photo, 'thumb');
  return <img src={url || ''} alt={photo.caption || ''} loading="lazy" decoding="async" onClick={onClick} />;
}

// photos: array of { key?, id?, file_path?, blob?, caption }
export default function PhotoUploader({ photos = [], onChange, onOpen }) {
  async function addFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const added = [];
    for (const f of files) {
      const blob = await compressImage(f);
      added.push({ key: uid(), blob, caption: '' });
    }
    onChange([...photos, ...added]);
  }
  function update(idx, patch) {
    const next = photos.slice(); next[idx] = { ...next[idx], ...patch }; onChange(next);
  }
  function remove(idx) {
    const next = photos.slice(); next.splice(idx, 1); onChange(next);
  }
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <div className="photo-item" key={p.key || p.id}>
          <button type="button" className="rm" onClick={() => remove(i)}>×</button>
          <Thumb photo={p} onClick={() => onOpen && onOpen(p)} />
          <input className="cap" placeholder="Caption" value={p.caption || ''} onChange={(e) => update(i, { caption: e.target.value })} />
        </div>
      ))}
      <label className="add-photo">
        +
        <input type="file" accept="image/*" multiple onChange={addFiles} />
      </label>
    </div>
  );
}
