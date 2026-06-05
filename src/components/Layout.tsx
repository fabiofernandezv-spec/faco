import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, CheckSquare, Tv2,
  Radio, ImageIcon, User, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';

const NAV = [
  { to: '/',            label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/notas',       label: 'Notas',          icon: FileText },
  { to: '/aprobaciones',label: 'Aprobaciones',   icon: CheckSquare },
  { to: '/rundown',     label: 'Rundown TV',      icon: Tv2 },
  { to: '/teleprompter',label: 'Teleprompter',   icon: Radio },
  { to: '/medios',      label: 'Medios',         icon: ImageIcon },
];

const ROLE_LABELS: Record<string, string> = {
  redactor:   'Redactor/a',
  editor:     'Editor/a',
  director:   'Director/a',
  presentador:'Presentador/a',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const currentUser = useStore((s) => s.currentUser);
  const pendingCount = useStore((s) =>
    s.notes.filter((n) => n.status === 'en_revision').length
  );

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
          {NAV.map(({ to, label, icon: Icon }) => {
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

        {/* User */}
        <div className="border-t border-gray-200 px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
            {currentUser.name[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="truncate text-xs text-gray-500">{ROLE_LABELS[currentUser.role]}</p>
          </div>
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
