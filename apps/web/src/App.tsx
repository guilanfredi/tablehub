import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';
import { useSoundPref } from './lib/sounds';
import { useNotifyPref } from './lib/turnAlert';
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

function SoundToggle() {
  const { enabled, toggle } = useSoundPref();
  const label = enabled ? 'Desativar sons' : 'Ativar sons';
  return (
    <button type="button" className="btn btn-ghost btn-sm sound-toggle" onClick={toggle} aria-label={label} aria-pressed={enabled} title={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
        {enabled ? (
          <>
            <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
            <path d="M18.5 7a7 7 0 0 1 0 10" />
          </>
        ) : (
          <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
}

function NotifyToggle() {
  const { enabled, permission, toggle } = useNotifyPref();
  const denied = permission === 'denied';
  const on = enabled && permission === 'granted';
  const label = denied ? 'Notificações bloqueadas' : on ? 'Desativar aviso de vez' : 'Avisar quando for minha vez';
  async function onClick() {
    const msg = await toggle();
    if (msg) useRoom.setState({ toast: { id: Date.now(), text: msg } });
  }
  return (
    <button type="button" className={`btn btn-ghost btn-sm sound-toggle ${on ? '' : 'off'}`} onClick={onClick} aria-label={label} aria-pressed={on} title={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" fill={on ? 'currentColor' : 'none'} />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
        {(denied || !on) && <path d="M3.5 3.5l17 17" />}
      </svg>
    </button>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/tablehub-mark.svg" alt="" />
          TableHub
        </Link>
        <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
          <NotifyToggle />
          <SoundToggle />
        </span>
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
