import { useMemo, useState } from 'react';
import PhotoUploader from './PhotoUploader';

// Props:
//   defects: active catalogue [{id, code, name_en, name_zh, classification}]
//   selected: { [defectId]: { pcs_found, photos: [] } }
//   onToggle(defect), onChangePcs(defectId, val), onPhotos(defectId, photos)
//   customs: [{ key, custom_description, pcs_found, photos: [] }]
//   onAddCustom(), onChangeCustom(key, patch), onRemoveCustom(key)
//   onOpenPhoto(photo)
export default function DefectChecklist({
  defects, selected, onToggle, onChangePcs, onPhotos,
  customs, onAddCustom, onChangeCustom, onRemoveCustom, onOpenPhoto,
}) {
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const match = (d) =>
      !query ||
      (d.name_en && d.name_en.toLowerCase().includes(query)) ||
      (d.name_zh && d.name_zh.includes(q.trim())) ||
      (d.code && d.code.toLowerCase().includes(query));
    // rows stay in their catalogue order; ticking just expands a row in place
    const build = (cls) => defects.filter((d) => d.classification === cls && match(d));
    return { major: build('major'), minor: build('minor') };
  }, [defects, q]);

  const renderRow = (d) => {
    const sel = selected[d.id];
    const ticked = !!sel;
    return (
      <div className={`defect-row ${ticked ? 'ticked' : ''}`} key={d.id}>
        <label className="head">
          <input type="checkbox" checked={ticked} onChange={() => onToggle(d)} />
          <span className="grow">{d.name_zh && <span className="zh">{d.name_zh}</span>} {d.name_en}</span>
        </label>
        {ticked && (
          <div className="detail">
            <label className="field" style={{ margin: 0 }}>
              <span>pcs found</span>
              <input type="number" min="0" inputMode="numeric"
                value={sel.pcs_found}
                onChange={(e) => onChangePcs(d.id, e.target.value)} />
            </label>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>Photos</span>
              <PhotoUploader photos={sel.photos} onChange={(p) => onPhotos(d.id, p)} onOpen={onOpenPhoto} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (title, cls, rows) => (
    <div>
      <div className="defect-group-title">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`badge ${cls}`}>{cls}</span>
      </div>
      {rows.length === 0 && <p className="muted" style={{ margin: '0.25rem 0' }}>No matches</p>}
      {rows.map(renderRow)}
    </div>
  );

  return (
    <div>
      <div className="checklist-search">
        <input placeholder="Search defects (EN / 中文)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {renderGroup('Major 主要', 'major', groups.major)}
      {renderGroup('Minor 次要', 'minor', groups.minor)}

      <div className="defect-group-title">
        <h3 style={{ margin: 0 }}>Custom issues</h3>
        <button type="button" className="btn small" onClick={onAddCustom}>+ Add custom issue</button>
      </div>
      {customs.map((cst) => (
        <div className="defect-row ticked" key={cst.key}>
          <div className="row between">
            <input placeholder="Describe the issue"
              value={cst.custom_description}
              onChange={(e) => onChangeCustom(cst.key, { custom_description: e.target.value })} />
            <button type="button" className="rm" style={{ position: 'static' }} onClick={() => onRemoveCustom(cst.key)}>×</button>
          </div>
          <div className="detail">
            <label className="field" style={{ margin: 0 }}>
              <span>pcs found</span>
              <input type="number" min="0" inputMode="numeric"
                value={cst.pcs_found}
                onChange={(e) => onChangeCustom(cst.key, { pcs_found: e.target.value })} />
            </label>
            <div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>Photos</span>
              <PhotoUploader photos={cst.photos} onChange={(p) => onChangeCustom(cst.key, { photos: p })} onOpen={onOpenPhoto} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
