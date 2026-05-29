import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtDate, resultLabel } from '../lib/format';

export default function PPSampleList() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [factory, setFactory] = useState('');
  const [po, setPo] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/pp-samples').then(setItems).catch((e) => setErr(e.message)); }, []);

  const factories = useMemo(() => {
    const m = new Map();
    (items || []).forEach((s) => { if (!m.has(s.supplier_id)) m.set(s.supplier_id, s.supplier_name); });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = q.trim().toLowerCase();
    const poq = po.trim().toLowerCase();
    return items.filter((s) => {
      if (factory && s.supplier_id !== factory) return false;
      if (poq && !(s.po_number || '').toLowerCase().includes(poq)) return false;
      if (query) {
        const hay = [s.supplier_name, s.supplier_name_zh, s.po_number, s.style_id, s.fit, s.created_by_name, resultLabel(s.result)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [items, q, factory, po]);

  const hasFilter = q || factory || po;

  return (
    <div>
      <div className="row between"><h1>PP samples</h1>
        <button className="btn primary" onClick={() => navigate('/pp-samples/new')}>+ New</button>
      </div>
      {err && <div className="error">{err}</div>}

      <div className="filters">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={factory} onChange={(e) => setFactory(e.target.value)}>
          <option value="">All factories</option>
          {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input placeholder="PO number" value={po} onChange={(e) => setPo(e.target.value)} />
        {hasFilter ? <button className="btn clear" onClick={() => { setQ(''); setFactory(''); setPo(''); }}>Clear</button> : null}
      </div>

      {items && <p className="muted result-count">{filtered.length} of {items.length}</p>}
      {items && filtered.length === 0 && <p className="muted">No matching PP samples.</p>}
      {filtered.map((s) => (
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
