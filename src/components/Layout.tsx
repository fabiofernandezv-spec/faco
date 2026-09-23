import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, CheckSquare, Tv2,
  Radio, ImageIcon, ChevronRight, ChevronUp, Users, LogOut, FlaskConical,
} from 'lucide-react';
import clsx from 'clsx';
import { useStore, useCurrentUser } from '../store/useStore';
import { canManageUsers } from '../lib/permissions';

const NAV = [
  { to: '/',            label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/notas',       label: 'Notas',          icon: FileText },
  { to: '/aprobaciones',label: 'Aprobaciones',   icon: CheckSquare },
  { to: '/rundown',     label: 'Rundown TV',      icon: Tv2 },
  { to: '/teleprompter',label: 'Teleprompter',   icon: Radio },
  { to: '/medios',      label: 'Medios',         icon: ImageIcon },
];

export const ROLE_LABELS: Record<string, string> = {
  redactor:   'Redactor/a',
  editor:     'Editor/a',
  director:   'Director/a',
  presentador:'Presentador/a',
};

const ROLE_COLORS: Record<string, string> = {
  redactor:    'bg-blue-500',
  editor:      'bg-purple-500',
  director:    'bg-brand-500',
  presentador: 'bg-green-500',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const currentUser  = useCurrentUser();
  const demo         = useStore((s) => s.demo);
  const profiles     = useStore((s) => s.profiles);
  const setDemoUser  = useStore((s) => s.setDemoUser);
  const signOut      = useStore((s) => s.signOut);
  const nav = canManageUsers(currentUser)
    ? [...NAV, { to: '/equipo', label: 'Equipo', icon: Users }]
    : NAV;
  const pendingCount = useStore((s) =>
    s.notes.filter((n) => n.status === 'en_revision').length
  );
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-200">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Tv2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-gray-900">Mesa Central</span>
          <span className="text-xs text-gray-400 mt-0.5">somoseffe</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {to === '/aprobaciones' && pendingCount > 0 && (
                  <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-700">
                    {pendingCount}
                  </span>
                )}
                {active && <ChevronRight className="h-3 w-3 text-brand-400" />}
              </Link>
            );
          })}
        </nav>

        {demo && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <FlaskConical className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>Modo demo: datos locales en este navegador, sin autenticación.</span>
          </div>
        )}

        {/* User menu */}
        <div ref={menuRef} className="relative border-t border-gray-200">
          {showUserMenu && !demo && (
            <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              <button
                onClick={() => { setShowUserMenu(false); void signOut(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
          {showUserMenu && demo && (
            <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 flex items-center gap-1">
                <Users className="h-3 w-3" /> Cambiar usuario (demo)
              </p>
              {profiles.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setDemoUser(u); setShowUserMenu(false); }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors hover:bg-gray-50',
                    u.id === currentUser.id && 'bg-brand-50'
                  )}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ROLE_COLORS[u.role]}`}>
                    {u.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className={clsx('text-sm font-medium truncate', u.id === currentUser.id ? 'text-brand-700' : 'text-gray-900')}>
                      {u.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[u.role]}</p>
                  </div>
                  {u.id === currentUser.id && <span className="ml-auto text-xs text-brand-500">✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${ROLE_COLORS[currentUser.role]}`}>
              {currentUser.name[0]}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-gray-900">{currentUser.name}</p>
              <p className="truncate text-xs text-gray-500">{ROLE_LABELS[currentUser.role]}</p>
            </div>
            <ChevronUp className={clsx('h-4 w-4 text-gray-400 flex-shrink-0 transition-transform', !showUserMenu && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
