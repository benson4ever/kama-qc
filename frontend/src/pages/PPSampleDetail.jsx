import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { fmtDate, resultLabel } from '../lib/format';
import PhotoGallery from '../components/PhotoGallery';

function Field({ label, children }) {
  return (<div className="report-field"><div className="k">{label}</div><div className="v">{children}</div></div>);
}

export default function PPSampleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.get(`/pp-samples/${id}`).then(setS).catch((e) => setErr(e.message)); }, [id]);

  async function exportPdf() {
    setExporting(true);
    try { await downloadFile(`/pp-samples/${id}/pdf`); }
    catch (e) { setErr(e.message); }
    finally { setExporting(false); }
  }
  if (err) return <div className="error">{err}</div>;
  if (!s) return <p className="muted">Loading…</p>;
  const canEdit = user && (user.role === 'admin' || user.id === s.created_by);

  return (
    <div>
      <div className="report-top row between">
        <button className="btn" onClick={() => navigate('/pp-samples')}>‹ Back</button>
        <div className="row" style={{ gap: '.5rem' }}>
          <button className="btn" onClick={exportPdf} disabled={exporting}>{exporting ? 'Exporting…' : 'Export PDF'}</button>
          {canEdit && <button className="btn" onClick={() => navigate(`/pp-samples/${id}/edit`)}>Edit</button>}
        </div>
      </div>

      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h1 style={{ margin: 0 }}>{s.supplier_name}{s.supplier_name_zh ? <span className="zh"> {s.supplier_name_zh}</span> : null}</h1>
        <span className={`badge ${s.result}`}>{resultLabel(s.result)}</span>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <Field label="PO number">{s.po_number || '—'}</Field>
        <Field label="Style ID">{s.style_id || '—'}</Field>
        <Field label="Style / 款式">{s.fit || '—'}</Field>
        <Field label="Comments / Issues Found">{s.issues_text ? <span style={{ whiteSpace: 'pre-wrap' }}>{s.issues_text}</span> : '—'}</Field>
        <Field label="Recorded">{fmtDate(s.created_at)}{s.created_by_name ? ` · ${s.created_by_name}` : ''}</Field>
      </div>

      {s.photos && s.photos.length > 0 && (<><h2>Photos</h2><div className="card"><PhotoGallery photos={s.photos} /></div></>)}
    </div>
  );
}
