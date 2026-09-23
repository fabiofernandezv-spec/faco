import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useStore, useCurrentUser } from '../store/useStore';
import { canManageUsers } from '../lib/permissions';
import { ROLE_LABELS } from '../components/Layout';
import type { UserRole } from '../types';

const ROLES: UserRole[] = ['redactor', 'editor', 'director', 'presentador'];

export function Team() {
  const currentUser = useCurrentUser();
  const profiles = useStore((s) => s.profiles);
  const refreshProfiles = useStore((s) => s.refreshProfiles);
  const setUserRole = useStore((s) => s.setUserRole);

  useEffect(() => { void refreshProfiles(); }, [refreshProfiles]);

  if (!canManageUsers(currentUser)) return <Navigate to="/" replace />;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-brand-500" />
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Asigna el rol de cada persona. Los usuarios nuevos entran como redactores.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3">
            <p className="text-sm font-medium text-gray-900">
              {p.name} {p.id === currentUser.id && <span className="text-xs text-gray-400">(tú)</span>}
            </p>
            <select
              value={p.role}
              disabled={p.id === currentUser.id}
              onChange={(e) => void setUserRole(p.id, e.target.value as UserRole)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
              aria-label={`Rol de ${p.name}`}
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
