import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function initials(u) {
  const n = (u && (u.name || u.email)) || '';
  const parts = n.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  const a = (parts[0] || '')[0] || '';
  const b = (parts[1] || '')[0] || '';
  return ((a + b) || '?').toUpperCase();
}

export default function NavBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="logo" onClick={() => navigate('/')}><span className="dot">K</span>Kama QC</div>
      <NavLink to="/" end><span className="ico">🏠</span><span className="label">Dashboard</span></NavLink>
      <NavLink to="/pp-samples"><span className="ico">📦</span><span className="label">PP samples</span></NavLink>
      <NavLink to="/inspections"><span className="ico">🏭</span><span className="label">Factory inspections</span></NavLink>
      {user && user.role === 'admin' && (
        <NavLink to="/admin"><span className="ico">⚙️</span><span className="label">Admin</span></NavLink>
      )}
      <div className="spacer" />
      <NavLink to="/account" className="user">
        <span className="uname">{user ? (user.name || user.email) : ''}</span>
        <span className="avatar">{initials(user)}</span>
      </NavLink>
    </nav>
  );
}
