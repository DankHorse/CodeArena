import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { paths } from '../../routes';

export function LogoutButton() {
  const { logout } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handleLogout() {
    setBusy(true); setError('');
    try { await logout(); navigate(paths.home, { replace: true }); }
    catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <div className="logout-control"><button className="public-site" type="button" onClick={handleLogout} disabled={busy}>{busy ? 'SIGNING OUT…' : 'LOG OUT ↗'}</button>{error && <p className="auth-message" role="alert">{error}</p>}</div>;
}
