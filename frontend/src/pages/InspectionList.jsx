import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtRange, resultLabel } from '../lib/format';

export default function InspectionList() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/inspections').then(setItems).catch((e) => setErr(e.message)); }, []);

  return (
    <div>
      <div className="row between"><h1>Factory inspections</h1>
        <button className="btn primary" onClick={() => navigate('/inspections/new')}>+ New</button>
      </div>
      {err && <div className="error">{err}</div>}
      {items && items.length === 0 && <p className="muted">No inspections yet.</p>}
      {items && items.map((i) => (
        <div className="card clickable" key={i.id} onClick={() => navigate(`/inspections/${i.id}`)}>
          <div className="row between">
            <div className="stack">
              <strong>{i.supplier_name} <span className="muted">· {i.type}</span></strong>
              <span className="muted">{i.po_number || '—'} · {fmtRange(i.date_from, i.date_to)}{i.created_by_name ? ` · ${i.created_by_name}` : ''}</span>
            </div>
            <span className={`badge ${i.result}`}>{resultLabel(i.result)}</span>
          </div>
          <div className="headline-trio" style={{ marginTop: '.5rem' }}>
            <div><div className="n">{i.with_issues}</div><div className="l">with issues</div></div>
            <div><div className="n">{i.total_inspected != null ? i.total_inspected : '—'}</div><div className="l">inspected</div></div>
            <div><div className="n">{i.total_order_qty != null ? i.total_order_qty : '—'}</div><div className="l">order</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}
