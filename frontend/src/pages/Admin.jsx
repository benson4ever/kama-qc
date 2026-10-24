import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Admin() {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <h1>Admin</h1>
      <div className="toggle" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'users' ? 'on-blue' : ''} onClick={() => setTab('users')}>Users</button>
        <button className={tab === 'suppliers' ? 'on-blue' : ''} onClick={() => setTab('suppliers')}>Suppliers</button>
        <button className={tab === 'defects' ? 'on-blue' : ''} onClick={() => setTab('defects')}>Defects</button>
      </div>
      {tab === 'users' && <UsersAdmin />}
      {tab === 'suppliers' && <SuppliersAdmin />}
      {tab === 'defects' && <DefectsAdmin />}
    </div>
  );
}

function useList(path) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const reload = () => api.get(path).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, [path]);
  return { items, setItems, err, setErr, reload };
}

/* ---------------- Users ---------------- */
function UsersAdmin() {
  const { items, err, setErr, reload } = useList('/users');
  const [f, setF] = useState({ email: '', name: '', name_zh: '', role: 'staff', password: '' });
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.post('/users', f); setF({ email: '', name: '', name_zh: '', role: 'staff', password: '' }); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function patch(id, body) {
    try { await api.patch(`/users/${id}`, body); reload(); } catch (e) { setErr(e.message); }
  }
  const ed = (id, u) => edits[id] || { name: u.name || '', name_zh: u.name_zh || '' };

  return (
    <div>
      {err && <div className="error">{err}</div>}
      <form className="card" onSubmit={create}>
        <h3>Add user</h3>
        <div className="row wrap" style={{ gap: '.5rem' }}>
          <input style={{ flex: '1 1 180px' }} placeholder="Email" type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <input style={{ flex: '1 1 140px' }} placeholder="Name (EN)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input style={{ flex: '1 1 120px' }} placeholder="名字 (中文)" value={f.name_zh} onChange={(e) => setF({ ...f, name_zh: e.target.value })} />
          <select style={{ flex: '0 0 110px' }} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="staff">staff</option><option value="admin">admin</option>
          </select>
          <input style={{ flex: '1 1 140px' }} placeholder="Password (min 8)" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <button className="btn" disabled={busy}>Add</button>
        </div>
      </form>
      {items.map((u) => {
        const e = ed(u.id, u);
        return (
          <div className="card" key={u.id}>
            <div className="row between wrap" style={{ gap: '.5rem' }}>
              <div className="row wrap" style={{ gap: '.5rem', flex: '1 1 260px' }}>
                <input style={{ flex: '1 1 140px' }} placeholder="Name (EN)" value={e.name} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, name: ev.target.value } })} />
                <input style={{ flex: '1 1 110px' }} placeholder="中文" value={e.name_zh} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, name_zh: ev.target.value } })} />
                <button className="btn small" onClick={() => patch(u.id, e)}>Save</button>
              </div>
              <div className="row wrap" style={{ gap: '.5rem' }}>
                <select value={u.role} onChange={(ev) => patch(u.id, { role: ev.target.value })}>
                  <option value="staff">staff</option><option value="admin">admin</option>
                </select>
                <button className="btn small" onClick={() => patch(u.id, { active: !u.active })}>
                  {u.active ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn small" onClick={() => { const p = prompt('New password (min 8 chars):'); if (p) patch(u.id, { password: p }); }}>Reset PW</button>
              </div>
            </div>
            <div className="row" style={{ gap: '.5rem', marginTop: '.4rem', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '.85rem' }}>{u.email}</span>
              {!u.active && <span className="badge muted">inactive</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Suppliers ---------------- */
function SuppliersAdmin() {
  const { items, err, setErr, reload } = useList('/suppliers');
  const [f, setF] = useState({ name: '', name_zh: '' });
  const [edits, setEdits] = useState({});

  async function create(e) {
    e.preventDefault(); setErr('');
    try { await api.post('/suppliers', f); setF({ name: '', name_zh: '' }); reload(); } catch (e) { setErr(e.message); }
  }
  async function patch(id, body) { try { await api.patch(`/suppliers/${id}`, body); reload(); } catch (e) { setErr(e.message); } }
  async function remove(id) {
    if (!window.confirm('Delete this supplier? This cannot be undone.')) return;
    try { await api.del(`/suppliers/${id}`); reload(); } catch (e) { setErr(e.message); }
  }
  const ed = (id, s) => edits[id] || { name: s.name, name_zh: s.name_zh || '' };

  return (
    <div>
      {err && <div className="error">{err}</div>}
      <form className="card row wrap" style={{ gap: '.5rem' }} onSubmit={create}>
        <input style={{ flex: '1 1 180px' }} placeholder="Supplier name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input style={{ flex: '1 1 140px' }} placeholder="名称 (中文)" value={f.name_zh} onChange={(e) => setF({ ...f, name_zh: e.target.value })} />
        <button className="btn">Add supplier</button>
      </form>
      {items.map((s) => {
        const e = ed(s.id, s);
        return (
          <div className="card" key={s.id}>
            <div className="row wrap" style={{ gap: '.5rem' }}>
              <input style={{ flex: '1 1 160px' }} value={e.name} onChange={(ev) => setEdits({ ...edits, [s.id]: { ...e, name: ev.target.value } })} />
              <input style={{ flex: '1 1 120px' }} placeholder="中文" value={e.name_zh} onChange={(ev) => setEdits({ ...edits, [s.id]: { ...e, name_zh: ev.target.value } })} />
              <button className="btn small" onClick={() => patch(s.id, e)}>Save</button>
              <button className="btn small" onClick={() => patch(s.id, { active: !s.active })}>{s.active ? 'Deactivate' : 'Activate'}</button>
              <button className="btn small danger" onClick={() => remove(s.id)}>Delete</button>
              {!s.active && <span className="badge muted">inactive</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Defects ---------------- */
function DefectsAdmin() {
  const { items, err, setErr, reload } = useList('/defects');
  const [f, setF] = useState({ code: '', name_en: '', name_zh: '', classification: 'major', sort_order: '' });
  const [edits, setEdits] = useState({});

  async function create(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/defects', { ...f, sort_order: f.sort_order === '' ? 999 : parseInt(f.sort_order, 10) });
      setF({ code: '', name_en: '', name_zh: '', classification: 'major', sort_order: '' }); reload();
    } catch (e) { setErr(e.message); }
  }
  async function patch(id, body) { try { await api.patch(`/defects/${id}`, body); reload(); } catch (e) { setErr(e.message); } }
  const ed = (id, d) => edits[id] || { name_en: d.name_en, name_zh: d.name_zh || '', sort_order: d.sort_order };

  const group = (cls) => items.filter((d) => d.classification === cls);
  const Row = (d) => {
    const e = ed(d.id, d);
    return (
      <div className="card" key={d.id} style={d.active ? {} : { opacity: 0.6 }}>
        <div className="row wrap" style={{ gap: '.5rem', alignItems: 'center' }}>
          <code style={{ flex: '0 0 auto', fontSize: '.8rem', color: 'var(--muted)' }}>{d.code}</code>
          <input style={{ flex: '1 1 140px' }} value={e.name_en} onChange={(ev) => setEdits({ ...edits, [d.id]: { ...e, name_en: ev.target.value } })} />
          <input style={{ flex: '1 1 100px' }} placeholder="中文" value={e.name_zh} onChange={(ev) => setEdits({ ...edits, [d.id]: { ...e, name_zh: ev.target.value } })} />
          <input style={{ flex: '0 0 70px' }} type="number" value={e.sort_order} onChange={(ev) => setEdits({ ...edits, [d.id]: { ...e, sort_order: ev.target.value } })} />
          <select value={d.classification} onChange={(ev) => patch(d.id, { classification: ev.target.value })}>
            <option value="major">major</option><option value="minor">minor</option>
          </select>
          <button className="btn small" onClick={() => patch(d.id, e)}>Save</button>
          <button className="btn small" onClick={() => patch(d.id, { active: !d.active })}>{d.active ? 'Hide' : 'Show'}</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {err && <div className="error">{err}</div>}
      <form className="card row wrap" style={{ gap: '.5rem' }} onSubmit={create}>
        <input style={{ flex: '1 1 120px' }} placeholder="code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
        <input style={{ flex: '1 1 140px' }} placeholder="Name (EN)" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} required />
        <input style={{ flex: '1 1 100px' }} placeholder="中文" value={f.name_zh} onChange={(e) => setF({ ...f, name_zh: e.target.value })} />
        <select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value })}>
          <option value="major">major</option><option value="minor">minor</option>
        </select>
        <input style={{ flex: '0 0 70px' }} type="number" placeholder="#" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
        <button className="btn">Add defect</button>
      </form>
      <h2>Major 主要</h2>
      {group('major').map(Row)}
      <h2>Minor 次要</h2>
      {group('minor').map(Row)}
    </div>
  );
}
