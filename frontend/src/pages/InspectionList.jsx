import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtRange, resultLabel } from '../lib/format';

export default function InspectionList() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [factory, setFactory] = useState('');
  const [type, setType] = useState('');
  const [po, setPo] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/inspections').then(setItems).catch((e) => setErr(e.message)); }, []);

  const factories = useMemo(() => {
    const m = new Map();
    (items || []).forEach((i) => { if (!m.has(i.supplier_id)) m.set(i.supplier_id, i.supplier_name); });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = q.trim().toLowerCase();
    const poq = po.trim().toLowerCase();
    return items.filter((i) => {
      if (factory && i.supplier_id !== factory) return false;
      if (type && i.type !== type) return false;
      if (poq && !(i.po_number || '').toLowerCase().includes(poq)) return false;
      if (query) {
        const hay = [i.supplier_name, i.supplier_name_zh, i.po_number, i.type, i.created_by_name, resultLabel(i.result)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [items, q, factory, type, po]);

  const hasFilter = q || factory || type || po;

  return (
    <div>
      <div className="row between"><h1>Factory inspections</h1>
        <button className="btn primary" onClick={() => navigate('/inspections/new')}>+ New</button>
      </div>
      {err && <div className="error">{err}</div>}

      <div className="filters">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={factory} onChange={(e) => setFactory(e.target.value)}>
          <option value="">All factories</option>
          {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="inline">Inline</option>
          <option value="final">Final</option>
        </select>
        <input placeholder="PO number" value={po} onChange={(e) => setPo(e.target.value)} />
        {hasFilter ? <button className="btn clear" onClick={() => { setQ(''); setFactory(''); setType(''); setPo(''); }}>Clear</button> : null}
      </div>

      {items && <p className="muted result-count">{filtered.length} of {items.length}</p>}
      {items && filtered.length === 0 && <p className="muted">No matching inspections.</p>}
      {filtered.map((i) => (
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
