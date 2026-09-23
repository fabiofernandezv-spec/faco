import { useState } from 'react';
import { KeyRound, UserCircle } from 'lucide-react';
import { useStore, useCurrentUser } from '../store/useStore';
import { PASSWORD_MIN, validateDisplayName, validatePassword } from '../lib/accountValidation';
import { ROLE_LABELS } from '../components/Layout';

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50';
const btn = 'px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50';

export function Account() {
  const currentUser = useCurrentUser();
  const demo = useStore((s) => s.demo);
  const accountEmail = useStore((s) => s.accountEmail);
  const updateOwnName = useStore((s) => s.updateOwnName);
  const changePassword = useStore((s) => s.changePassword);

  const [name, setName] = useState(currentUser.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameDone, setNameDone] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const nameError = validateDisplayName(name);
  const nameChanged = name.trim() !== currentUser.name;
  const pwError = !current ? 'Escribe tu contraseña actual.'
    : validatePassword(next, confirm) ?? (next === current ? 'La contraseña nueva debe ser distinta de la actual.' : null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (nameError || !nameChanged) return;
    setNameBusy(true);
    setNameDone(false);
    if (await updateOwnName(name)) {
      setName(name.trim());
      setNameDone(true);
    }
    setNameBusy(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwError) return;
    setPwBusy(true);
    setPwDone(false);
    if (await changePassword(current, next, confirm)) {
      setCurrent(''); setNext(''); setConfirm('');
      setPwDone(true);
    }
    setPwBusy(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi cuenta</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tu nombre visible y tu contraseña.</p>
      </div>

      <form onSubmit={saveName} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <UserCircle className="h-4 w-4 text-brand-500" /> Perfil
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Correo</p>
            <p className="text-gray-900" data-testid="account-email">{demo ? '— (modo demo)' : accountEmail ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Rol</p>
            <p className="text-gray-900">{ROLE_LABELS[currentUser.role]}</p>
            <p className="text-xs text-gray-400">Solo un director puede cambiarlo desde Equipo.</p>
          </div>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-gray-500 mb-1">Nombre visible</span>
          <input className={input} value={name} onChange={(e) => { setName(e.target.value); setNameDone(false); }}
            maxLength={130} autoComplete="name" />
        </label>
        {nameError && <p className="text-xs text-red-600" role="alert">{nameError}</p>}
        {nameDone && <p className="text-xs text-green-700" role="status">Nombre actualizado.</p>}
        <p className="text-xs text-gray-400">Las notas y registros anteriores conservan el nombre con el que se firmaron.</p>
        <div className="flex justify-end">
          <button type="submit" disabled={!!nameError || !nameChanged || nameBusy} className={btn}>
            {nameBusy ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <KeyRound className="h-4 w-4 text-brand-500" /> Contraseña
        </h2>
        {demo ? (
          <p className="text-sm text-gray-500">En modo demo la contraseña no se gestiona: usa una cuenta real.</p>
        ) : (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Contraseña actual</span>
              <input className={input} type="password" value={current} autoComplete="current-password"
                onChange={(e) => { setCurrent(e.target.value); setPwDone(false); }} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Contraseña nueva</span>
                <input className={input} type="password" value={next} autoComplete="new-password" minLength={PASSWORD_MIN}
                  onChange={(e) => { setNext(e.target.value); setPwDone(false); }} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Repite la nueva</span>
                <input className={input} type="password" value={confirm} autoComplete="new-password"
                  onChange={(e) => { setConfirm(e.target.value); setPwDone(false); }} />
              </label>
            </div>
            {(current || next || confirm) && pwError && <p className="text-xs text-red-600" role="alert">{pwError}</p>}
            {pwDone && (
              <p className="text-xs text-green-700" role="status">
                Contraseña actualizada. Se cerraron tus sesiones en otros equipos.
              </p>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={!!pwError || pwBusy} className={btn}>
                {pwBusy ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
