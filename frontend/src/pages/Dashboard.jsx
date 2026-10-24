import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtDate, fmtRange, resultLabel, resultBadgeClass } from '../lib/format';
import DashboardKpis from '../components/DashboardKpis';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/dashboard').then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  const { latest_pp_samples, latest_inspections, recently_visited, failed_entries } = data;
  const failedInsp = failed_entries?.inspections || [];
  const failedPP = failed_entries?.pp_samples || [];
  const open = [...failedInsp.filter((i) => !i.passed).map((i) => ({ kind: 'inspection', ...i })),
                ...failedPP.filter((s) => !s.passed).map((s) => ({ kind: 'pp', ...s }))];
  const resolved = [...failedInsp.filter((i) => i.passed).map((i) => ({ kind: 'inspection', ...i })),
                    ...failedPP.filter((s) => s.passed).map((s) => ({ kind: 'pp', ...s }))];

  // multi-PO entries ("7219L/7220L") can be resolved by a pass on one of the POs: say which
  const poNote = (e) => {
    const m = e.passed?.matched_po;
    if (!m) return '';
    const whole = (e.po_number || '').trim().toUpperCase();
    return m.toUpperCase() === whole ? '' : ` (${m})`;
  };

  const FailedLine = ({ e }) => {
    const isInsp = e.kind === 'inspection';
    const href = isInsp ? `/inspections/${e.id}` : `/pp-samples/${e.id}`;
    return (
      <div className="list-line" key={e.id}>
        <div className="stack grow" onClick={() => navigate(href)} style={{ cursor: 'pointer' }}>
          <strong>
            {isInsp ? e.supplier_name : (e.style_id || e.supplier_name)}{' '}
            <span className={`badge ${isInsp ? `type-${e.type}` : 'muted'}`}>{isInsp ? e.type : 'PP sample'}</span>
          </strong>
          <span className="muted" style={{ fontSize: '.85rem' }}>
            {isInsp
              ? `${e.po_number || '—'} · ${fmtRange(e.date_from, e.date_to) || fmtDate(e.created_at)}`
              : `${e.supplier_name}${e.po_number ? ` · ${e.po_number}` : ''} · ${fmtDate(e.created_at)}`}
          </span>
          {e.passed && (
            <span style={{ fontSize: '.85rem', color: 'var(--confirm)' }}>
              {isInsp
                ? `Passed later ${e.passed.type} inspection${poNote(e)} · ${fmtRange(e.passed.date_from, e.passed.date_to) || fmtDate(e.passed.created_at)}`
                : `Approved in later PP sample${poNote(e)} · ${fmtDate(e.passed.created_at)}`}
            </span>
          )}
        </div>
        {e.passed && (
          <button className="btn small" onClick={() => navigate(isInsp ? `/inspections/${e.passed.id}` : `/pp-samples/${e.passed.id}`)}>
            View pass
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="dash-wide">
      <h1>Dashboard</h1>
      <DashboardKpis />
      <h2>Latest activity</h2>
      <div className="activity-grid">
      {(open.length > 0 || resolved.length > 0) && (
        <div className="panel">
          <div className="row between">
            <h3>Failed — awaiting reinspection <span className="badge fail">{open.length}</span></h3>
          </div>
          {open.length === 0 && <p className="muted">All failed entries have passed a later inspection.</p>}
          {open.map((e) => <FailedLine e={e} key={e.id} />)}
          {resolved.length > 0 && (
            <>
              <div className="row between" style={{ marginTop: '1rem' }}>
                <h3>Failed — passed later <span className="badge pass">{resolved.length}</span></h3>
              </div>
              {resolved.map((e) => <FailedLine e={e} key={e.id} />)}
            </>
          )}
        </div>
      )}
        <div className="panel activity-main">
          <div className="row between">
            <h3>Latest inspections</h3>
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
                <span className={`badge ${resultBadgeClass(i.result, i.type)}`}>{resultLabel(i.result)}</span>
              </div>
            ))}
          </div>
          {latest_inspections.length > 0 && (
            <table className="data hide-mobile" style={{ boxShadow: 'none', border: 'none' }}>
              <thead><tr><th>PO</th><th>Type</th><th>Factory</th><th>Date</th><th>Result</th></tr></thead>
              <tbody>
                {latest_inspections.map((i) => (
                  <tr className="clickable" key={i.id} onClick={() => navigate(`/inspections/${i.id}`)}>
                    <td>{i.po_number || '—'}</td><td><span className={`badge type-${i.type}`}>{i.type}</span></td><td>{i.supplier_name}</td>
                    <td>{fmtRange(i.date_from, i.date_to)}</td>
                    <td><span className={`badge ${resultBadgeClass(i.result, i.type)}`}>{resultLabel(i.result)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>Latest PP sample</h3>
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
          <h3>Recently visited</h3>
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
  );
}
