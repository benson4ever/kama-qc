import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

export default function Account() {
  const { user } = useAuth();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [c2, setC2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (nw !== c2) { setErr('New passwords do not match'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: nw });
      setMsg('Password updated.');
      setCur(''); setNw(''); setC2('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Account</h1>
      <div className="card">
        <div className="stack">
          <strong>{user && user.name ? user.name : '—'} {user && user.name_zh && <span className="zh">{user.name_zh}</span>}</strong>
          <span className="muted">{user && user.email}</span>
          <span className="badge muted" style={{ alignSelf: 'flex-start' }}>{user && user.role}</span>
        </div>
      </div>
      <h2>Change password</h2>
      <form className="card" onSubmit={submit}>
        {err && <div className="error">{err}</div>}
        {msg && <div className="notice">{msg}</div>}
        <label className="field"><span>Current password</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
        <label className="field"><span>New password (min 8 characters)</span><input type="password" value={nw} onChange={(e) => setNw(e.target.value)} required /></label>
        <label className="field"><span>Confirm new password</span><input type="password" value={c2} onChange={(e) => setC2(e.target.value)} required /></label>
        <button className="btn primary" disabled={busy}>Update password</button>
      </form>
    </div>
  );
}
