import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function initials(u) {
  const n = (u && (u.name || u.email)) || '';
  const parts = n.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  const a = (parts[0] || '')[0] || '';
  const b = (parts[1] || '')[0] || '';
  return ((a + b) || '?').toUpperCase();
}

const ICONS = {
  home: (
    <>
      <path d="m3 10.5 9-7.5 9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  sample: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  inspections: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
};

function Ico({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Tabs() {
  const { user } = useAuth();
  return (
    <>
      <NavLink to="/" end><Ico name="home" />Dashboard</NavLink>
      <NavLink to="/pp-samples"><Ico name="sample" />PP samples</NavLink>
      <NavLink to="/inspections"><Ico name="inspections" />Inspections</NavLink>
      {user && user.role === 'admin' && <NavLink to="/admin"><Ico name="admin" />Admin</NavLink>}
    </>
  );
}

export default function NavBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <nav className="nav">
        <div className="logo" onClick={() => navigate('/')}><span className="logo-mark">K</span>Kama QC</div>
        <div className="nav-links"><Tabs /></div>
        <NavLink to="/account" className="user">
          <span className="uname">{user ? (user.name || user.email) : ''}</span>
          <span className="avatar">{initials(user)}</span>
        </NavLink>
      </nav>
      <nav className="tabbar"><Tabs /></nav>
    </>
  );
}
