import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtDate, fmtRange, resultLabel } from '../lib/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/dashboard').then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  const { latest_pp_samples, latest_inspections, recently_visited } = data;

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="dash-grid">
        <div className="panel">
          <div className="row between">
            <h3>🏭 Latest inspections</h3>
            {latest_inspections.length > 0 && <a onClick={() => navigate('/inspections')} style={{ cursor: 'pointer' }}>View all</a>}
          </div>
          {latest_inspections.length === 0 && <p className="muted">No inspections yet.</p>}
          <div className="show-mobile">
            {latest_inspections.map((i) => (
              <div className="list-line" key={i.id} onClick={() => navigate(`/inspections/${i.id}`)} style={{ cursor: 'pointer' }}>
                <div className="stack">
                  <strong>{i.supplier_name}</strong>
                  <span className="muted" style={{ fontSize: '.85rem' }}>{i.po_number || '—'} · {i.type} · {fmtRange(i.date_from, i.date_to)}</span>
                </div>
                <span className={`badge ${i.result}`}>{resultLabel(i.result)}</span>
              </div>
            ))}
          </div>
          {latest_inspections.length > 0 && (
            <table className="data hide-mobile" style={{ boxShadow: 'none', border: 'none' }}>
              <thead><tr><th>PO</th><th>Type</th><th>Factory</th><th>Date</th><th>Result</th></tr></thead>
              <tbody>
                {latest_inspections.map((i) => (
                  <tr className="clickable" key={i.id} onClick={() => navigate(`/inspections/${i.id}`)}>
                    <td>{i.po_number || '—'}</td><td>{i.type}</td><td>{i.supplier_name}</td>
                    <td>{fmtRange(i.date_from, i.date_to)}</td>
                    <td><span className={`badge ${i.result}`}>{resultLabel(i.result)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="panel">
            <h3>📦 Latest PP sample</h3>
            {latest_pp_samples.length === 0 && <p className="muted">No PP samples yet.</p>}
            {latest_pp_samples.map((s) => (
              <div className="list-line" key={s.id} onClick={() => navigate(`/pp-samples/${s.id}`)} style={{ cursor: 'pointer' }}>
                <div className="stack">
                  <strong>{s.style_id || s.supplier_name}</strong>
                  <span className="muted" style={{ fontSize: '.85rem' }}>{s.supplier_name}{s.po_number ? ` · ${s.po_number}` : ''} · {fmtDate(s.created_at)}</span>
                </div>
                <span className={`badge ${s.result}`}>{resultLabel(s.result)}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>📍 Recently visited</h3>
            {recently_visited.length === 0 && <p className="muted">No factory visits yet.</p>}
            {recently_visited.map((r) => (
              <div className="list-line" key={r.supplier_id}>
                <span><strong>{r.supplier_name}</strong></span>
                <span className="muted">{fmtRange(r.date_from, r.date_to) || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
