import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

// Photos are loaded by plain <img> tags, which need the qc_photo cookie the
// server sets from the JWT. Ask for it once per session start and after login;
// a failure here only means photos show as broken until the next reload.
const startPhotoSession = () => api.post('/auth/photo-session', {}).catch(() => {});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    api.post('/auth/logout', {}).catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        // both in parallel: one round trip instead of two on slow mobile links
        const [{ user }] = await Promise.all([api.get('/auth/me'), startPhotoSession()]);
        if (active) setUser(user);
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    startPhotoSession(); // login already set the cookie; this is a no-cost safety net, not awaited
    setUser(user);
    return user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
