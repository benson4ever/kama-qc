import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { fmtRange, fmtDate, resultLabel, resultBadgeClass } from '../lib/format';
import PhotoGallery from '../components/PhotoGallery';

function Field({ label, children }) {
  return (<div className="report-field"><div className="k">{label}</div><div className="v">{children}</div></div>);
}

function IssueCard({ issue }) {
  const isCustom = !issue.defect_id;
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <strong className="grow">
          {isCustom ? issue.custom_description
            : <>{issue.defect_name_zh ? <span className="zh">{issue.defect_name_zh} </span> : null}{issue.defect_name_en}</>}
        </strong>
        <div className="row" style={{ gap: '.4rem' }}>
          {issue.defect_classification ? <span className={`badge ${issue.defect_classification}`}>{issue.defect_classification}</span> : <span className="badge muted">other</span>}
          <span className="badge muted">{issue.pcs_found} pcs</span>
        </div>
      </div>
      <PhotoGallery photos={issue.photos} />
    </div>
  );
}

const sideLabel = (p) =>
  p.caption || (p.kind === 'product_front' ? 'Front' : p.kind === 'product_back' ? 'Back' : '');

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [i, setI] = useState(null);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.get(`/inspections/${id}`).then(setI).catch((e) => setErr(e.message)); }, [id]);

  async function exportPdf() {
    setExporting(true);
    try { await downloadFile(`/inspections/${id}/pdf`); }
    catch (e) { setErr(e.message); }
    finally { setExporting(false); }
  }
  if (err) return <div className="error">{err}</div>;
  if (!i) return <p className="muted">Loading…</p>;
  const canEdit = user && (user.role === 'admin' || user.id === i.created_by);
  const majors = i.issues.filter((x) => x.defect_classification === 'major');
  const minors = i.issues.filter((x) => x.defect_classification === 'minor');
  const customs = i.issues.filter((x) => !x.defect_classification);

  const sumPcs = (arr) => arr.reduce((n, x) => n + (x.pcs_found || 0), 0);
  const pct = (n) => (i.total_inspected ? `${((n / i.total_inspected) * 100).toFixed(2)}%` : '—');
  const inspectedPct = i.total_order_qty && i.total_inspected != null
    ? ((i.total_inspected / i.total_order_qty) * 100).toFixed(1)
    : null;

  const products = i.products || [];
  const photosByProduct = {};
  const looseProductPhotos = [];
  const packagingPhotos = [];
  const measurementPhotos = [];
  for (const p of i.photos || []) {
    if (p.kind === 'packaging') { packagingPhotos.push(p); continue; }
    if (p.kind === 'measurement') { measurementPhotos.push(p); continue; }
    const labeled = { ...p, caption: sideLabel(p) };
    if (p.product_id) (photosByProduct[p.product_id] ||= []).push(labeled);
    else looseProductPhotos.push(labeled);
  }
  const hasProducts = products.length > 0 || looseProductPhotos.length > 0;

  return (
    <div>
      <div className="report-top row between">
        <button className="btn" onClick={() => navigate('/inspections')}>‹ Back</button>
        <div className="row" style={{ gap: '.5rem' }}>
          <button className="btn" onClick={exportPdf} disabled={exporting}>{exporting ? 'Exporting…' : 'Export PDF'}</button>
          {canEdit && <button className="btn" onClick={() => navigate(`/inspections/${id}/edit`)}>Edit</button>}
        </div>
      </div>

      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h1 style={{ margin: 0 }}>{i.supplier_name} <span className="muted" style={{ fontWeight: 400 }}>· {i.type}</span></h1>
        <span className={`badge ${resultBadgeClass(i.result, i.type)}`}>{resultLabel(i.result)}</span>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="headline-trio" style={{ marginBottom: '.85rem' }}>
          <div><div className="n">{i.with_issues}</div><div className="l">with issues</div></div>
          <div><div className="n">{i.total_inspected != null ? i.total_inspected : '—'}</div><div className="l">inspected</div></div>
          <div><div className="n">{i.total_order_qty != null ? i.total_order_qty : '—'}</div><div className="l">order</div></div>
        </div>
        <div className="headline-trio" style={{ marginBottom: '.85rem', flexWrap: 'wrap' }}>
          <div><div className="n">{pct(sumPcs(majors))}</div><div className="l">major defect %</div></div>
          <div><div className="n">{pct(sumPcs(minors))}</div><div className="l">minor defect %</div></div>
          <div><div className="n">{pct(sumPcs(i.issues))}</div><div className="l">total defect %</div></div>
          {inspectedPct != null && (
            <div><div className="n">{inspectedPct}%</div><div className="l">of order inspected</div></div>
          )}
        </div>
        <Field label="PO number">{i.po_number || '—'}</Field>
        <Field label="Inspection dates">{fmtRange(i.date_from, i.date_to) || '—'}</Field>
        <Field label="Recorded">{fmtDate(i.created_at)}{i.created_by_name ? ` · ${i.created_by_name}` : ''}</Field>
        <Field label="Comment">{i.comment ? <span style={{ whiteSpace: 'pre-wrap' }}>{i.comment}</span> : '—'}</Field>
      </div>

      {hasProducts && (<>
        <h2>Products ({products.length || 1})</h2>
        {products.map((p, idx) => (
          <div className="card" key={p.id}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <strong className="grow">{p.product_ref || `Product ${idx + 1}`}</strong>
              <span className="badge muted">{(photosByProduct[p.id] || []).length} photos</span>
            </div>
            <PhotoGallery photos={photosByProduct[p.id] || []} />
          </div>
        ))}
        {looseProductPhotos.length > 0 && (
          <div className="card"><PhotoGallery photos={looseProductPhotos} /></div>
        )}
      </>)}

      <h2>Defects logged ({i.issues.length})</h2>
      {i.issues.length === 0 && <p className="muted">No defects logged.</p>}
      {majors.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Major 主要</h3><span className="badge major">major</span></div>{majors.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}
      {minors.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Minor 次要</h3><span className="badge minor">minor</span></div>{minors.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}
      {customs.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Other issues</h3></div>{customs.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}

      {packagingPhotos.length > 0 && (<>
        <h2>Packaging photos ({packagingPhotos.length})</h2>
        <div className="card"><PhotoGallery photos={packagingPhotos} /></div>
      </>)}

      {measurementPhotos.length > 0 && (<>
        <h2>Measurements ({measurementPhotos.length})</h2>
        <div className="card"><PhotoGallery photos={measurementPhotos} /></div>
      </>)}
    </div>
  );
}
