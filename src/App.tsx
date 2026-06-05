import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Notes } from './pages/Notes';
import { NoteEditor } from './pages/NoteEditor';
import { Approvals } from './pages/Approvals';
import { Rundown } from './pages/Rundown';
import { Teleprompter } from './pages/Teleprompter';
import { MediaLibrary } from './pages/MediaLibrary';
import { useStore } from './store/useStore';

function AppRoutes() {
  const syncFromSupabase = useStore((s) => s.syncFromSupabase);

  useEffect(() => {
    syncFromSupabase();
  }, [syncFromSupabase]);

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/notas"         element={<Notes />} />
        <Route path="/notas/:id"     element={<NoteEditor />} />
        <Route path="/aprobaciones"  element={<Approvals />} />
        <Route path="/rundown"       element={<Rundown />} />
        <Route path="/teleprompter"  element={<Teleprompter />} />
        <Route path="/medios"        element={<MediaLibrary />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
