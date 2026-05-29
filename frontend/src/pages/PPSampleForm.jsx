import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useDraft } from '../hooks/useDraft';
import PhotoUploader from '../components/PhotoUploader';
import ResultToggle from '../components/ResultToggle';
import Lightbox from '../components/Lightbox';

const EMPTY = { supplier_id: '', po_number: '', style_id: '', fit: '', issues_text: '', result: 'approved' };
const DRAFT_KEY = 'draft:pp_sample';

function photoFormData(photo) {
  const fd = new FormData();
  fd.append('photo', photo.blob, 'photo.jpg');
  fd.append('caption', photo.caption || '');
  return fd;
}

export default function PPSampleForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [draftRestored, setDraftRestored] = useState(false);
  const removedIds = useRef([]);
  const applied = useRef(false);

  const { restored, loaded: draftLoaded, discard } = useDraft(DRAFT_KEY, { form, photos }, { enabled: isNew });

  useEffect(() => { api.get('/suppliers?active=1').then(setSuppliers).catch(() => {}); }, []);

  // load existing entry
  useEffect(() => {
    if (isNew) return;
    api.get(`/pp-samples/${id}`).then((s) => {
      setForm({ supplier_id: s.supplier_id, po_number: s.po_number || '', style_id: s.style_id || '',
        fit: s.fit || '', issues_text: s.issues_text || '', result: s.result });
      setPhotos((s.photos || []).map((p) => ({ id: p.id, file_path: p.file_path, caption: p.caption || '' })));
      setReady(true);
    }).catch((e) => { setErr(e.message); setReady(true); });
  }, [id, isNew]);

  // restore draft (new only, once)
  useEffect(() => {
    if (!isNew || applied.current || !draftLoaded) return;
    applied.current = true;
    if (restored && restored.form) {
      setForm(restored.form);
      setPhotos(restored.photos || []);
      setDraftRestored(true);
    }
  }, [isNew, draftLoaded, restored]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setErr('');
    if (!form.supplier_id) { setErr('Please choose a supplier.'); return; }
    setBusy(true);
    try {
      let sampleId = id;
      if (isNew) {
        const created = await api.post('/pp-samples', form);
        sampleId = created.id;
      } else {
        await api.patch(`/pp-samples/${id}`, form);
        for (const pid of removedIds.current) await api.del(`/pp-samples/${id}/photos/${pid}`);
      }
      for (const p of photos) {
        if (p.blob) await api.upload(`/pp-samples/${sampleId}/photos`, photoFormData(p));
      }
      if (isNew) discard();
      navigate(`/pp-samples/${sampleId}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this PP sample? This cannot be undone.')) return;
    setBusy(true);
    try { await api.del(`/pp-samples/${id}`); navigate('/pp-samples'); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  function onPhotosChange(next) {
    // track deletions of server-side photos for edit mode
    const stillThere = new Set(next.filter((p) => p.id).map((p) => p.id));
    for (const p of photos) if (p.id && !stillThere.has(p.id) && !removedIds.current.includes(p.id)) removedIds.current.push(p.id);
    setPhotos(next);
  }

  if (!ready) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="report-top row between">
        <button type="button" className="btn" onClick={() => navigate(isNew ? '/pp-samples' : `/pp-samples/${id}`)}>‹ Cancel</button>
      </div>
      <h1>{isNew ? 'New PP sample' : 'Edit PP sample'}</h1>
      {draftRestored && <div className="notice">Restored an unsaved draft.</div>}
      {err && <div className="error">{err}</div>}

      <label className="field"><span>Supplier</span>
        <select value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.name_zh ? ` (${s.name_zh})` : ''}</option>)}
        </select>
      </label>
      <label className="field"><span>PO number</span>
        <input value={form.po_number} onChange={(e) => set('po_number', e.target.value)} placeholder="Free text" />
      </label>
      <label className="field"><span>Style ID</span>
        <input value={form.style_id} onChange={(e) => set('style_id', e.target.value)} />
      </label>
      <label className="field"><span>Fit</span>
        <input value={form.fit} onChange={(e) => set('fit', e.target.value)} />
      </label>
      <label className="field"><span>Issues found</span>
        <textarea value={form.issues_text} onChange={(e) => set('issues_text', e.target.value)} />
      </label>

      <label className="field"><span>Photos</span></label>
      <PhotoUploader photos={photos} onChange={onPhotosChange} onOpen={setLightbox} />

      <label className="field" style={{ marginTop: '1rem' }}><span>Result</span></label>
      <ResultToggle value={form.result} onChange={(v) => set('result', v)}
        options={[{ value: 'approved', label: 'Approved', color: 'green' }, { value: 'not_approved', label: 'Not approved', color: 'red' }]} />

      <div className="sticky-actions row between">
        {!isNew ? <button className="btn danger" onClick={remove} disabled={busy}>Delete</button> : <span />}
        <button className="btn cta" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
