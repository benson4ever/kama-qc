import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { fmtRange, fmtDate, resultLabel } from '../lib/format';
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
          {isCustom ? <span className="badge muted">custom</span> : <span className={`badge ${issue.defect_classification}`}>{issue.defect_classification}</span>}
          <span className="badge muted">{issue.pcs_found} pcs</span>
        </div>
      </div>
      <PhotoGallery photos={issue.photos} />
    </div>
  );
}

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [i, setI] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get(`/inspections/${id}`).then(setI).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="error">{err}</div>;
  if (!i) return <p className="muted">Loading…</p>;
  const canEdit = user && (user.role === 'admin' || user.id === i.created_by);
  const majors = i.issues.filter((x) => x.defect_classification === 'major');
  const minors = i.issues.filter((x) => x.defect_classification === 'minor');
  const customs = i.issues.filter((x) => !x.defect_id);

  return (
    <div>
      <div className="report-top row between">
        <button className="btn" onClick={() => navigate('/inspections')}>‹ Back</button>
        {canEdit && <button className="btn primary" onClick={() => navigate(`/inspections/${id}/edit`)}>Edit</button>}
      </div>

      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h1 style={{ margin: 0 }}>{i.supplier_name} <span className="muted" style={{ fontWeight: 400 }}>· {i.type}</span></h1>
        <span className={`badge ${i.result}`}>{resultLabel(i.result)}</span>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="headline-trio" style={{ marginBottom: '.85rem' }}>
          <div><div className="n">{i.with_issues}</div><div className="l">with issues</div></div>
          <div><div className="n">{i.total_inspected != null ? i.total_inspected : '—'}</div><div className="l">inspected</div></div>
          <div><div className="n">{i.total_order_qty != null ? i.total_order_qty : '—'}</div><div className="l">order</div></div>
        </div>
        <Field label="PO number">{i.po_number || '—'}</Field>
        <Field label="Inspection dates">{fmtRange(i.date_from, i.date_to) || '—'}</Field>
        <Field label="Recorded">{fmtDate(i.created_at)}{i.created_by_name ? ` · ${i.created_by_name}` : ''}</Field>
      </div>

      <h2>Defects logged ({i.issues.length})</h2>
      {i.issues.length === 0 && <p className="muted">No defects logged.</p>}
      {majors.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Major 主要</h3><span className="badge major">major</span></div>{majors.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}
      {minors.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Minor 次要</h3><span className="badge minor">minor</span></div>{minors.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}
      {customs.length > 0 && (<><div className="defect-group-title"><h3 style={{ margin: 0 }}>Custom issues</h3></div>{customs.map((x) => <IssueCard key={x.id} issue={x} />)}</>)}
    </div>
  );
}
