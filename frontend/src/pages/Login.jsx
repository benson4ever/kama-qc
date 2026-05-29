import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-center">
      <form className="card" style={{ width: 'min(360px, 92vw)' }} onSubmit={submit}>
        <h1 className="row" style={{ gap: '.5rem' }}>
          <span style={{ width: 14, height: 14, background: '#0ea5e9', borderRadius: 4 }} />Kama QC
        </h1>
        {err && <div className="error">{err}</div>}
        <label className="field"><span>Email</span>
          <input type="email" autoCapitalize="none" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn cta block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
