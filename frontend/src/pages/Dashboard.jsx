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

      <h2>Latest PP sample</h2>
      {latest_pp_samples.length === 0 && <p className="muted">No PP samples yet.</p>}
      {latest_pp_samples.map((s) => (
        <div className="card clickable" key={s.id} onClick={() => navigate(`/pp-samples/${s.id}`)}>
          <div className="row between">
            <div className="stack">
              <strong>{s.supplier_name}{s.style_id ? <span className="muted"> · {s.style_id}</span> : null}</strong>
              <span className="muted">{s.po_number || '—'} · {fmtDate(s.created_at)}</span>
            </div>
            <span className={`badge ${s.result}`}>{resultLabel(s.result)}</span>
          </div>
        </div>
      ))}

      <h2>Latest inspections</h2>
      {latest_inspections.length === 0 && <p className="muted">No inspections yet.</p>}
      <div className="show-mobile">
        {latest_inspections.map((i) => (
          <div className="card clickable" key={i.id} onClick={() => navigate(`/inspections/${i.id}`)}>
            <div className="row between">
              <div className="stack">
                <strong>{i.supplier_name}</strong>
                <span className="muted">{i.po_number || '—'} · {i.type} · {fmtRange(i.date_from, i.date_to)}</span>
              </div>
              <span className={`badge ${i.result}`}>{resultLabel(i.result)}</span>
            </div>
          </div>
        ))}
      </div>
      {latest_inspections.length > 0 && (
        <table className="data hide-mobile">
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

      <h2>Recently visited</h2>
      {recently_visited.length === 0 && <p className="muted">No factory visits yet.</p>}
      <div className="row wrap">
        {recently_visited.map((r) => (
          <div className="card" key={r.supplier_id} style={{ flex: '1 1 220px' }}>
            <strong>{r.supplier_name}</strong>
            <div className="muted">{fmtRange(r.date_from, r.date_to) || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
