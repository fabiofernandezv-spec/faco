import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBanner } from './components/ErrorBanner';
import { Dashboard } from './pages/Dashboard';
import { Notes } from './pages/Notes';
import { Approvals } from './pages/Approvals';
import { Rundown } from './pages/Rundown';
import { Teleprompter } from './pages/Teleprompter';
import { MediaLibrary } from './pages/MediaLibrary';
import { Team } from './pages/Team';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Account } from './pages/Account';
import { useStore } from './store/useStore';

// El editor (TipTap) es pesado: se carga solo al abrir una nota.
const NoteEditor = lazy(() => import('./pages/NoteEditor').then((m) => ({ default: m.NoteEditor })));

function AppRoutes() {
  const init        = useStore((s) => s.init);
  const authReady   = useStore((s) => s.authReady);
  const currentUser = useStore((s) => s.currentUser);
  const recovery    = useStore((s) => s.recovery);
  const loginMode   = useStore((s) => s.loginMode);

  useEffect(() => { void init(); }, [init]);

  // El enlace de recuperación se atiende antes que el login (y aunque haya sesión).
  if (recovery) return <ResetPassword />;

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Cargando…</div>;
  }
  if (!currentUser) return <Login key={loginMode} initialMode={loginMode} />;

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/notas"         element={<Notes />} />
        {/* key: remonta el editor al cambiar de nota para reiniciar su estado */}
        <Route path="/notas/:id"     element={<NoteEditorRoute />} />
        <Route path="/aprobaciones"  element={<Approvals />} />
        <Route path="/rundown"       element={<Rundown />} />
        <Route path="/teleprompter"  element={<Teleprompter />} />
        <Route path="/medios"        element={<MediaLibrary />} />
        <Route path="/equipo"        element={<Team />} />
        <Route path="/cuenta"        element={<Account />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function NoteEditorRoute() {
  const { id } = useParams();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Cargando editor…</div>}>
      <NoteEditor key={id} />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ErrorBanner />
    </BrowserRouter>
  );
}
