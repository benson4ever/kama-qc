import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import NavBar from './components/NavBar';
import RouteResume from './components/RouteResume';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PPSampleList from './pages/PPSampleList';
import PPSampleForm from './pages/PPSampleForm';
import PPSampleDetail from './pages/PPSampleDetail';
import InspectionList from './pages/InspectionList';
import InspectionForm from './pages/InspectionForm';
import InspectionDetail from './pages/InspectionDetail';
import Admin from './pages/Admin';
import Account from './pages/Account';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      <main className="container"><Outlet /></main>
    </>
  );
}

function AdminOnly() {
  const { user } = useAuth();
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <>
    <RouteResume />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pp-samples" element={<PPSampleList />} />
        <Route path="/pp-samples/new" element={<PPSampleForm />} />
        <Route path="/pp-samples/:id" element={<PPSampleDetail />} />
        <Route path="/pp-samples/:id/edit" element={<PPSampleForm />} />
        <Route path="/inspections" element={<InspectionList />} />
        <Route path="/inspections/new" element={<InspectionForm />} />
        <Route path="/inspections/:id" element={<InspectionDetail />} />
        <Route path="/inspections/:id/edit" element={<InspectionForm />} />
        <Route path="/account" element={<Account />} />
        <Route element={<AdminOnly />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
