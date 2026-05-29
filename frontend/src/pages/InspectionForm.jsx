import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useDraft } from '../hooks/useDraft';
import DefectChecklist from '../components/DefectChecklist';
import ResultToggle from '../components/ResultToggle';
import Lightbox from '../components/Lightbox';
import { uid } from '../lib/uid';

const EMPTY = {
  supplier_id: '', po_number: '', date_from: '', date_to: '',
  type: 'final', total_order_qty: '', total_inspected: '', result: 'pass',
};
const DRAFT_KEY = 'draft:inspection';

function photoFormData(p) {
  const fd = new FormData();
  fd.append('photo', p.blob, 'photo.jpg');
  fd.append('caption', p.caption || '');
  return fd;
}
function numericForm(f) {
  return {
    ...f,
    total_order_qty: f.total_order_qty === '' ? null : parseInt(f.total_order_qty, 10),
    total_inspected: f.total_inspected === '' ? null : parseInt(f.total_inspected, 10),
  };
}
function trackRemoved(cur, nextPhotos) {
  const still = new Set(nextPhotos.filter((p) => p.id).map((p) => p.id));
  const removed = [...(cur.removedPhotoIds || [])];
  for (const p of cur.photos) if (p.id && !still.has(p.id) && !removed.includes(p.id)) removed.push(p.id);
  return removed;
}

export default function InspectionForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [defects, setDefects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState({});   // defectId -> { issueId?, pcs_found, photos, removedPhotoIds }
  const [customs, setCustoms] = useState([]);      // { key, issueId?, custom_description, pcs_found, photos, removedPhotoIds }
  const [lightbox, setLightbox] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [draftRestored, setDraftRestored] = useState(false);
  const removedIssueIds = useRef([]);
  const applied = useRef(false);

  const { restored, loaded: draftLoaded, discard } = useDraft(DRAFT_KEY, { form, selected, customs }, { enabled: isNew });

  useEffect(() => {
    api.get('/suppliers?active=1').then(setSuppliers).catch(() => {});
    api.get('/defects?active=1').then(setDefects).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.get(`/inspections/${id}`).then((insp) => {
      setForm({
        supplier_id: insp.supplier_id, po_number: insp.po_number || '',
        date_from: insp.date_from ? insp.date_from.slice(0, 10) : '',
        date_to: insp.date_to ? insp.date_to.slice(0, 10) : '',
        type: insp.type,
        total_order_qty: insp.total_order_qty != null ? insp.total_order_qty : '',
        total_inspected: insp.total_inspected != null ? insp.total_inspected : '',
        result: insp.result,
      });
      const sel = {}; const cust = [];
      for (const it of insp.issues) {
        const photos = (it.photos || []).map((p) => ({ id: p.id, file_path: p.file_path, caption: p.caption || '' }));
        if (it.defect_id) sel[it.defect_id] = { issueId: it.id, pcs_found: String(it.pcs_found), photos, removedPhotoIds: [] };
        else cust.push({ key: uid(), issueId: it.id, custom_description: it.custom_description || '', pcs_found: String(it.pcs_found), photos, removedPhotoIds: [] });
      }
      setSelected(sel); setCustoms(cust); setReady(true);
    }).catch((e) => { setErr(e.message); setReady(true); });
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew || applied.current || !draftLoaded) return;
    applied.current = true;
    if (restored && restored.form) {
      setForm(restored.form);
      setSelected(restored.selected || {});
      setCustoms(restored.customs || []);
      setDraftRestored(true);
    }
  }, [isNew, draftLoaded, restored]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleDefect(d) {
    const cur = selected[d.id];
    if (cur) {
      if (cur.issueId) removedIssueIds.current.push(cur.issueId);
      const next = { ...selected }; delete next[d.id]; setSelected(next);
    } else {
      setSelected({ ...selected, [d.id]: { pcs_found: '0', photos: [], removedPhotoIds: [] } });
    }
  }
  const changePcs = (defectId, val) => setSelected((p) => ({ ...p, [defectId]: { ...p[defectId], pcs_found: val } }));
  const changePhotos = (defectId, photos) =>
    setSelected((p) => ({ ...p, [defectId]: { ...p[defectId], photos, removedPhotoIds: trackRemoved(p[defectId], photos) } }));

  const addCustom = () => setCustoms((p) => [...p, { key: uid(), custom_description: '', pcs_found: '0', photos: [], removedPhotoIds: [] }]);
  const changeCustom = (key, patch) => setCustoms((prev) => prev.map((c) => {
    if (c.key !== key) return c;
    const removedPhotoIds = patch.photos ? trackRemoved(c, patch.photos) : c.removedPhotoIds;
    return { ...c, ...patch, removedPhotoIds };
  }));
  function removeCustom(key) {
    const c = customs.find((x) => x.key === key);
    if (c && c.issueId) removedIssueIds.current.push(c.issueId);
    setCustoms((prev) => prev.filter((x) => x.key !== key));
  }

  const withIssues = useMemo(() => {
    let sum = 0;
    for (const k in selected) sum += parseInt(selected[k].pcs_found, 10) || 0;
    for (const c of customs) sum += parseInt(c.pcs_found, 10) || 0;
    return sum;
  }, [selected, customs]);

  async function save() {
    setErr('');
    if (!form.supplier_id) { setErr('Please choose a supplier.'); return; }
    setBusy(true);
    try {
      let inspId = id;
      if (isNew) {
        const created = await api.post('/inspections', { ...numericForm(form), issues: [] });
        inspId = created.id;
      } else {
        await api.patch(`/inspections/${id}`, numericForm(form));
        for (const rid of removedIssueIds.current) await api.del(`/inspections/${id}/issues/${rid}`);
      }

      const desired = [];
      for (const defectId in selected) {
        const s = selected[defectId];
        desired.push({ issueId: s.issueId, payload: { defect_id: defectId, pcs_found: s.pcs_found }, photos: s.photos, removedPhotoIds: s.removedPhotoIds || [] });
      }
      for (const c of customs) {
        if (!c.custom_description.trim()) continue;
        desired.push({ issueId: c.issueId, payload: { custom_description: c.custom_description, pcs_found: c.pcs_found }, photos: c.photos, removedPhotoIds: c.removedPhotoIds || [] });
      }

      for (const di of desired) {
        let issueId = di.issueId;
        if (!issueId) { const created = await api.post(`/inspections/${inspId}/issues`, di.payload); issueId = created.id; }
        else await api.patch(`/inspections/${inspId}/issues/${issueId}`, di.payload);
        for (const pid of di.removedPhotoIds) await api.del(`/inspections/${inspId}/issues/${issueId}/photos/${pid}`);
        for (const p of di.photos) if (p.blob) await api.upload(`/inspections/${inspId}/issues/${issueId}/photos`, photoFormData(p));
      }

      if (isNew) discard();
      navigate('/inspections');
    } catch (e) {
      setErr(e.message); setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this inspection? This cannot be undone.')) return;
    setBusy(true);
    try { await api.del(`/inspections/${id}`); navigate('/inspections'); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  if (!ready) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>{isNew ? 'New factory inspection' : 'Edit inspection'}</h1>
      {draftRestored && <div className="notice">Restored an unsaved draft.</div>}
      {err && <div className="error">{err}</div>}

      <label className="field"><span>Supplier</span>
        <select value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.name_zh ? ` (${s.name_zh})` : ''}</option>)}
        </select>
      </label>
      <label className="field"><span>PO number</span>
        <input value={form.po_number} onChange={(e) => set('po_number', e.target.value)} />
      </label>
      <div className="row" style={{ gap: '.75rem' }}>
        <label className="field grow"><span>From</span><input type="date" value={form.date_from} onChange={(e) => set('date_from', e.target.value)} /></label>
        <label className="field grow"><span>To</span><input type="date" value={form.date_to} onChange={(e) => set('date_to', e.target.value)} /></label>
      </div>
      <label className="field"><span>Inspection type</span></label>
      <ResultToggle value={form.type} onChange={(v) => set('type', v)}
        options={[{ value: 'inline', label: 'Inline', color: 'blue' }, { value: 'final', label: 'Final', color: 'blue' }]} />
      <div className="row" style={{ gap: '.75rem', marginTop: '.9rem' }}>
        <label className="field grow"><span>Total order qty</span><input type="number" inputMode="numeric" value={form.total_order_qty} onChange={(e) => set('total_order_qty', e.target.value)} /></label>
        <label className="field grow"><span>Total pcs inspected</span><input type="number" inputMode="numeric" value={form.total_inspected} onChange={(e) => set('total_inspected', e.target.value)} /></label>
      </div>

      <h2>Defects</h2>
      <DefectChecklist
        defects={defects} selected={selected}
        onToggle={toggleDefect} onChangePcs={changePcs} onPhotos={changePhotos}
        customs={customs} onAddCustom={addCustom} onChangeCustom={changeCustom} onRemoveCustom={removeCustom}
        onOpenPhoto={setLightbox}
      />

      <div className="summary-strip" style={{ marginTop: '1rem' }}>
        <div className="metric"><div className="n">{form.total_order_qty || '—'}</div><div className="l">Order qty</div></div>
        <div className="metric"><div className="n">{form.total_inspected || '—'}</div><div className="l">Inspected</div></div>
        <div className="metric"><div className="n">{withIssues}</div><div className="l">With issues</div></div>
      </div>

      <label className="field" style={{ marginTop: '1rem' }}><span>Result (manual)</span></label>
      <ResultToggle value={form.result} onChange={(v) => set('result', v)}
        options={[{ value: 'pass', label: 'Pass', color: 'green' }, { value: 'fail', label: 'Fail', color: 'red' }]} />

      <div className="sticky-actions row between">
        {!isNew ? <button className="btn danger" onClick={remove} disabled={busy}>Delete</button> : <span />}
        <button className="btn cta" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
