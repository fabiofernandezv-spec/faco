import { useEffect, useState } from 'react';
import { Tv2, LogIn, UserPlus, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PASSWORD_MIN } from '../lib/accountValidation';

type Mode = 'login' | 'signup' | 'forgot';

export const RESET_REQUESTED_MESSAGE =
  'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.';

/** Segundos de espera entre solicitudes de enlace. */
const RESEND_COOLDOWN = 60;

export function Login({ initialMode = 'login' }: { initialMode?: Mode }) {
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const requestPasswordReset = useStore((s) => s.requestPasswordReset);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function switchMode(next: Mode) {
    setMode(next);
    setInfo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    if (mode === 'login') {
      await signIn(email, password);
    } else if (mode === 'signup') {
      if (await signUp(email, password, fullName)) {
        setInfo('Cuenta creada. Si tu proyecto exige confirmación, revisa tu correo. Un director debe asignarte el rol.');
        setMode('login');
      }
    } else if (await requestPasswordReset(email)) {
      // Mismo mensaje exista o no el correo.
      setInfo(RESET_REQUESTED_MESSAGE);
      setCooldown(RESEND_COOLDOWN);
    }
    setBusy(false);
  }

  const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500';
  const title = { login: 'Inicia sesión', signup: 'Crear cuenta', forgot: 'Recuperar contraseña' }[mode];
  const submitLabel = busy
    ? 'Procesando…'
    : mode === 'login' ? 'Entrar'
    : mode === 'signup' ? 'Crear cuenta'
    : cooldown > 0 ? `Enviar otro enlace (${cooldown} s)` : 'Enviar enlace';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center">
            <Tv2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900 leading-tight">Mesa Central</p>
            <p className="text-xs text-gray-400">somoseffe</p>
          </div>
        </div>

        <h1 className="text-sm font-semibold text-gray-700">{title}</h1>

        {mode === 'forgot' && !info && (
          <p className="text-xs text-gray-500">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
        )}
        {info && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2" role="status">{info}</p>}

        {mode === 'signup' && (
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</span>
            <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Correo</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode !== 'forgot' && (
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">Contraseña</span>
            <input
              className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={mode === 'signup' ? PASSWORD_MIN : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'signup' && <span className="block text-xs text-gray-400 mt-1">Mínimo {PASSWORD_MIN} caracteres.</span>}
          </label>
        )}

        <button
          type="submit" disabled={busy || (mode === 'forgot' && cooldown > 0)}
          className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
        >
          {mode === 'login' ? <LogIn className="h-4 w-4" /> : mode === 'signup' ? <UserPlus className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          {submitLabel}
        </button>

        <div className="flex flex-col gap-1">
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('forgot')} className="w-full text-xs text-brand-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          )}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-xs text-brand-600 hover:underline"
          >
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Volver a iniciar sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
