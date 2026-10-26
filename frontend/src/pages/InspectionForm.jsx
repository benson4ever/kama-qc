import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useDraft } from '../hooks/useDraft';
import DefectChecklist from '../components/DefectChecklist';
import PhotoUploader from '../components/PhotoUploader';
import ResultToggle from '../components/ResultToggle';
import Lightbox from '../components/Lightbox';
import { uid } from '../lib/uid';

const EMPTY = {
  supplier_id: '', po_number: '', date_from: '', date_to: '',
  type: 'final', total_order_qty: '', total_inspected: '', comment: '', result: 'pass',
};
const DRAFT_KEY = 'draft:inspection';

function photoFormData(p, kind, productId) {
  const fd = new FormData();
  fd.append('photo', p.blob, 'photo.jpg');
  fd.append('caption', p.caption || '');
  if (kind) fd.append('kind', kind);
  if (productId) fd.append('product_id', productId);
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

const emptyProduct = () => ({ key: uid(), productId: null, product_ref: '', front: [], back: [] });

export default function InspectionForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [defects, setDefects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState({});   // defectId -> { issueId?, pcs_found, photos, removedPhotoIds }
  const [customs, setCustoms] = useState([]);      // { key, issueId?, custom_description, pcs_found, photos, removedPhotoIds }
  const [products, setProducts] = useState([]);    // { key, productId?, product_ref, front: [photos], back: [photos] }
  const [packaging, setPackaging] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [draftRestored, setDraftRestored] = useState(false);
  const removedIssueIds = useRef([]);
  const removedPhotoIds = useRef([]);
  const removedProductIds = useRef([]);
  const applied = useRef(false);

  const { restored, loaded: draftLoaded, discard } = useDraft(
    DRAFT_KEY, { form, selected, customs, products, packaging, measurements }, { enabled: isNew }
  );

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
        comment: insp.comment || '',
        result: insp.result,
      });
      const sel = {}; const cust = [];
      for (const it of insp.issues) {
        const photos = (it.photos || []).map((p) => ({ id: p.id, file_path: p.file_path, caption: p.caption || '' }));
        if (it.defect_id) sel[it.defect_id] = { issueId: it.id, pcs_found: String(it.pcs_found), photos, removedPhotoIds: [] };
        else cust.push({ key: uid(), issueId: it.id, custom_description: it.custom_description || '', pcs_found: String(it.pcs_found), classification: it.defect_classification || '', photos, removedPhotoIds: [] });
      }
      const prods = (insp.products || []).map((p) => ({ key: uid(), productId: p.id, product_ref: p.product_ref || '', front: [], back: [] }));
      const byProductId = {};
      for (const p of prods) byProductId[p.productId] = p;
      const pack = [];
      const meas = [];
      let orphan = null;
      for (const ph of insp.photos || []) {
        const item = { id: ph.id, file_path: ph.file_path, caption: ph.caption || '' };
        if (ph.kind === 'packaging') { pack.push(item); continue; }
        if (ph.kind === 'measurement') { meas.push(item); continue; }
        let target = ph.product_id ? byProductId[ph.product_id] : null;
        if (!target) { orphan = orphan || emptyProduct(); target = orphan; }
        (ph.kind === 'product_front' ? target.front : target.back).push(item);
      }
      if (orphan) prods.push(orphan);
      setProducts(prods); setPackaging(pack); setMeasurements(meas);
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
      let prods = restored.products || [];
      // migrate drafts from the earlier flat front/back shape
      if (!prods.length && (restored.productFront?.length || restored.productBack?.length)) {
        prods = [{ ...emptyProduct(), front: restored.productFront || [], back: restored.productBack || [] }];
      }
      setProducts(prods);
      setPackaging(restored.packaging || []);
      setMeasurements(restored.measurements || []);
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
      setSelected({ ...selected, [d.id]: { pcs_found: '', photos: [], removedPhotoIds: [] } });
    }
  }
  const changePcs = (defectId, val) => setSelected((p) => ({ ...p, [defectId]: { ...p[defectId], pcs_found: val } }));
  const changePhotos = (defectId, photos) =>
    setSelected((p) => ({ ...p, [defectId]: { ...p[defectId], photos, removedPhotoIds: trackRemoved(p[defectId], photos) } }));

  // remember already-saved direct photos the user removed from a list
  function noteRemovedDirect(prev, next) {
    const still = new Set(next.filter((p) => p.id).map((p) => p.id));
    for (const p of prev) {
      if (p.id && !still.has(p.id) && !removedPhotoIds.current.includes(p.id)) removedPhotoIds.current.push(p.id);
    }
    return next;
  }
  const changePackaging = (next) => setPackaging((prev) => noteRemovedDirect(prev, next));
  const changeMeasurements = (next) => setMeasurements((prev) => noteRemovedDirect(prev, next));

  const addProduct = () => setProducts((prev) => [...prev, emptyProduct()]);
  const changeProduct = (key, patch) => setProducts((prev) => prev.map((p) => {
    if (p.key !== key) return p;
    if (patch.front) noteRemovedDirect(p.front, patch.front);
    if (patch.back) noteRemovedDirect(p.back, patch.back);
    return { ...p, ...patch };
  }));
  function removeProductCard(key) {
    const p = products.find((x) => x.key === key);
    const hasContent = p && ((p.product_ref || '').trim() || p.front.length || p.back.length);
    if (hasContent && !window.confirm('Remove this product and its photos?')) return;
    if (p && p.productId) removedProductIds.current.push(p.productId);
    setProducts((prev) => prev.filter((x) => x.key !== key));
  }

  const addCustom = () => setCustoms((p) => [...p, { key: uid(), custom_description: '', pcs_found: '', classification: '', photos: [], removedPhotoIds: [] }]);
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

  const defectPcs = useMemo(() => {
    const byId = {};
    for (const d of defects) byId[d.id] = d;
    let major = 0; let minor = 0; let other = 0;
    for (const k in selected) {
      const n = parseInt(selected[k].pcs_found, 10) || 0;
      const cls = byId[k] && byId[k].classification;
      if (cls === 'major') major += n; else if (cls === 'minor') minor += n; else other += n;
    }
    for (const c of customs) {
      const n = parseInt(c.pcs_found, 10) || 0;
      if (c.classification === 'major') major += n; else if (c.classification === 'minor') minor += n; else other += n;
    }
    return { major, minor, total: major + minor + other };
  }, [selected, customs, defects]);
  const orderQty = parseInt(form.total_order_qty, 10) || 0;
  const inspectedQty = parseInt(form.total_inspected, 10) || 0;
  const pct = (n) => `${((n / inspectedQty) * 100).toFixed(2)}%`;

  async function save() {
    setErr('');
    if (!form.supplier_id) { setErr('Please choose a supplier.'); return; }
    if (customs.some((c) => c.custom_description.trim() && c.classification !== 'major' && c.classification !== 'minor')) {
      setErr('Please choose a severity (major or minor) for each other issue. 请为每个其他问题选择严重程度。'); return;
    }
    setBusy(true);
    try {
      let inspId = id;
      if (isNew) {
        const payload = { ...numericForm(form), issues: [] };
        const created = await api.post('/inspections', payload);
        inspId = created.id;
      } else {
        await api.patch(`/inspections/${id}`, numericForm(form));
        for (const rid of removedIssueIds.current) await api.del(`/inspections/${id}/issues/${rid}`);
      }

      for (const rid of removedProductIds.current) await api.del(`/inspections/${inspId}/products/${rid}`);
      for (const pid of removedPhotoIds.current) await api.del(`/inspections/${inspId}/photos/${pid}`);

      for (const p of products) {
        const hasNew = p.front.some((x) => x.blob) || p.back.some((x) => x.blob);
        const ref = (p.product_ref || '').trim();
        if (!p.productId && !hasNew && !ref) continue; // skip untouched empty cards
        let productId = p.productId;
        if (!productId) { const created = await api.post(`/inspections/${inspId}/products`, { product_ref: ref }); productId = created.id; }
        else await api.patch(`/inspections/${inspId}/products/${productId}`, { product_ref: ref });
        for (const ph of p.front) if (ph.blob) await api.upload(`/inspections/${inspId}/photos`, photoFormData(ph, 'product_front', productId));
        for (const ph of p.back) if (ph.blob) await api.upload(`/inspections/${inspId}/photos`, photoFormData(ph, 'product_back', productId));
      }
      for (const ph of packaging) if (ph.blob) await api.upload(`/inspections/${inspId}/photos`, photoFormData(ph, 'packaging'));
      for (const ph of measurements) if (ph.blob) await api.upload(`/inspections/${inspId}/photos`, photoFormData(ph, 'measurement'));

      const desired = [];
      for (const defectId in selected) {
        const s = selected[defectId];
        desired.push({ issueId: s.issueId, payload: { defect_id: defectId, pcs_found: s.pcs_found }, photos: s.photos, removedPhotoIds: s.removedPhotoIds || [] });
      }
      for (const c of customs) {
        if (!c.custom_description.trim()) continue;
        desired.push({ issueId: c.issueId, payload: { custom_description: c.custom_description, pcs_found: c.pcs_found, classification: c.classification }, photos: c.photos, removedPhotoIds: c.removedPhotoIds || [] });
      }

      for (const di of desired) {
        let issueId = di.issueId;
        if (!issueId) { const created = await api.post(`/inspections/${inspId}/issues`, di.payload); issueId = created.id; }
        else await api.patch(`/inspections/${inspId}/issues/${issueId}`, di.payload);
        for (const pid of di.removedPhotoIds) await api.del(`/inspections/${inspId}/issues/${issueId}/photos/${pid}`);
        for (const p of di.photos) if (p.blob) await api.upload(`/inspections/${inspId}/issues/${issueId}/photos`, photoFormData(p));
      }

      if (isNew) discard();
      navigate(`/inspections/${inspId}`);
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
      <div className="report-top row between">
        <button type="button" className="btn" onClick={() => { if (isNew) discard(); navigate(isNew ? '/inspections' : `/inspections/${id}`); }}>‹ Cancel</button>
      </div>
      <h1>{isNew ? 'New factory inspection' : 'Edit inspection'}</h1>
      {draftRestored && <div className="notice">Restored an unsaved draft.</div>}
      {err && <div className="error">{err}</div>}

      <h2>Details</h2>
      <div className="fset">
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
        <label className="field" style={{ marginTop: '0.5rem', marginBottom: 0 }}><span>Comment</span>
          <textarea value={form.comment || ''} onChange={(e) => set('comment', e.target.value)} placeholder="Notes on this inspection — observations, why it passed or failed, follow-up, etc." />
        </label>
      </div>

      <h2>Products</h2>
      <p className="muted" style={{ margin: '0 0 0.5rem 0.25rem', fontSize: '0.85rem' }}>Reference photos of each product inspected (not defects). Add one entry per product.</p>
      {products.map((p, idx) => (
        <div className="card" key={p.key}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <strong>Product {idx + 1}</strong>
            <button type="button" className="btn danger" onClick={() => removeProductCard(p.key)}>Remove</button>
          </div>
          <label className="field"><span>Product ID</span>
            <input value={p.product_ref} onChange={(e) => changeProduct(p.key, { product_ref: e.target.value })} placeholder="Style no. / SKU / item ref" />
          </label>
          <label className="field"><span>Front</span></label>
          <PhotoUploader photos={p.front} onChange={(next) => changeProduct(p.key, { front: next })} onOpen={setLightbox} />
          <label className="field"><span>Back</span></label>
          <PhotoUploader photos={p.back} onChange={(next) => changeProduct(p.key, { back: next })} onOpen={setLightbox} />
        </div>
      ))}
      <button type="button" className="btn" onClick={addProduct}>+ Add product</button>

      <h2>Defects</h2>
      <DefectChecklist
        defects={defects} selected={selected}
        onToggle={toggleDefect} onChangePcs={changePcs} onPhotos={changePhotos}
        customs={customs} onAddCustom={addCustom} onChangeCustom={changeCustom} onRemoveCustom={removeCustom}
        onOpenPhoto={setLightbox}
      />

      <h2>Measurements</h2>
      <div className="fset">
        <p className="muted" style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>Photos of measurement charts.</p>
        <PhotoUploader photos={measurements} onChange={changeMeasurements} onOpen={setLightbox} />
      </div>

      <h2>Packaging photos</h2>
      <div className="fset">
        <p className="muted" style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>Photos of packing, cartons, polybags, labels etc.</p>
        <PhotoUploader photos={packaging} onChange={changePackaging} onOpen={setLightbox} />
      </div>

      <h2>Result</h2>
      <div className="summary-strip">
        <div className="metric"><div className="n">{form.total_order_qty || '—'}</div><div className="l">Order qty</div></div>
        <div className="metric"><div className="n">{form.total_inspected || '—'}</div><div className="l">Inspected</div></div>
        <div className="metric"><div className="n">{withIssues}</div><div className="l">With issues</div></div>
      </div>
      {inspectedQty > 0 && (
        <p className="muted" style={{ margin: '.4rem 0 0 .25rem', fontSize: '.85rem' }}>
          Defect % of inspected: major {pct(defectPcs.major)} · minor {pct(defectPcs.minor)} · total {pct(defectPcs.total)}
          {orderQty > 0 ? ` · ${((inspectedQty / orderQty) * 100).toFixed(1)}% of order inspected` : ''}
        </p>
      )}
      <div style={{ marginTop: '0.6rem' }}>
        <ResultToggle value={form.result} onChange={(v) => set('result', v)}
          options={[{ value: 'pass', label: 'Pass', color: 'green' }, { value: 'fail', label: 'Fail', color: form.type === 'inline' ? 'yellow' : 'red' }]} />
      </div>

      <div className="sticky-actions row between">
        {!isNew ? <button className="btn danger" onClick={remove} disabled={busy}>Delete</button> : <span />}
        <button className="btn cta" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
