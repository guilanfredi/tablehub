import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';
import { useRoom } from './store/room';

function Toast() {
  const toast = useRoom((s) => s.toast);
  const dismiss = useRoom((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" onClick={dismiss}>
      {toast.text}
    </div>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" />
          TableHub
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sala/:code" element={<RoomPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toast />
    </div>
  );
}
