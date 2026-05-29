import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="logo" onClick={() => navigate('/')}><span className="dot" />Kama QC</div>
      <div className="spacer" />
      <NavLink to="/pp-samples"><span className="ico">📋</span><span className="label">PP samples</span></NavLink>
      <NavLink to="/inspections"><span className="ico">🏭</span><span className="label">Factory inspections</span></NavLink>
      {user && user.role === 'admin' && (
        <NavLink to="/admin"><span className="ico">⚙️</span><span className="label">Admin</span></NavLink>
      )}
      <NavLink to="/account"><span className="ico">👤</span><span className="label">{user ? (user.name || user.email) : 'User'}</span></NavLink>
      <button className="navlink" onClick={logout} title="Log out"><span className="ico">⏻</span><span className="label">Logout</span></button>
    </nav>
  );
}
