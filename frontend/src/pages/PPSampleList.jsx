import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtDate, resultLabel } from '../lib/format';

export default function PPSampleList() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/pp-samples').then(setItems).catch((e) => setErr(e.message)); }, []);

  return (
    <div>
      <div className="row between"><h1>PP samples</h1>
        <button className="btn primary" onClick={() => navigate('/pp-samples/new')}>+ New</button>
      </div>
      {err && <div className="error">{err}</div>}
      {items && items.length === 0 && <p className="muted">No PP samples yet.</p>}
      {items && items.map((s) => (
        <div className="card clickable" key={s.id} onClick={() => navigate(`/pp-samples/${s.id}`)}>
          <div className="row between">
            <div className="stack">
              <strong>{s.supplier_name}{s.style_id ? ` · ${s.style_id}` : ''}</strong>
              <span className="muted">{s.po_number || '—'} · {fmtDate(s.created_at)}{s.created_by_name ? ` · ${s.created_by_name}` : ''}</span>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end' }}>
              <span className={`badge ${s.result}`}>{resultLabel(s.result)}</span>
              {s.photo_count > 0 && <span className="muted" style={{ fontSize: '.8rem' }}>📷 {s.photo_count}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
