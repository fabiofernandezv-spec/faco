import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Tv2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PASSWORD_MIN, validatePassword } from '../lib/accountValidation';
import { initialLinkError } from '../lib/supabase';

export const INVALID_LINK_MESSAGE = 'El enlace no es válido o venció. Solicita uno nuevo.';

export function ResetPassword() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const accountEmail = useStore((s) => s.accountEmail);
  const authReady = useStore((s) => s.authReady);
  const completePasswordReset = useStore((s) => s.completePasswordReset);
  const cancelRecovery = useStore((s) => s.cancelRecovery);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const urlError = initialLinkError;

  // Sin sesión de recuperación tras cargar (o con error en la URL): enlace inválido.
  const invalid = urlError || (authReady && !currentUser);

  useEffect(() => {
    // Limpia los tokens del fragmento cuando supabase-js ya los procesó.
    if (authReady && window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, [authReady]);

  const error = validatePassword(password, confirm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    setBusy(true);
    const ok = await completePasswordReset(password, confirm);
    setBusy(false);
    if (ok) navigate('/', { replace: true });
  }

  const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center">
            <Tv2 className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold text-lg text-gray-900">Mesa Central</p>
        </div>
        <h1 className="text-sm font-semibold text-gray-700">Nueva contraseña</h1>

        {!authReady && !urlError ? (
          <p className="text-sm text-gray-400">Verificando el enlace…</p>
        ) : invalid ? (
          <>
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{INVALID_LINK_MESSAGE}</p>
            <button
              type="button"
              onClick={() => { window.history.replaceState(null, '', '/'); cancelRecovery(true); }}
              className="w-full bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600"
            >
              Pedir otro enlace
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {accountEmail && <p className="text-xs text-gray-500">Cuenta: {accountEmail}</p>}
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Contraseña nueva</span>
              <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password" required minLength={PASSWORD_MIN} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Repite la contraseña</span>
              <input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password" required />
            </label>
            {(password || confirm) && error && <p className="text-xs text-red-600" role="alert">{error}</p>}
            <button type="submit" disabled={!!error || busy}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
              <KeyRound className="h-4 w-4" /> {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
