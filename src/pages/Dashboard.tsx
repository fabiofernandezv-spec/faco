import { Link } from 'react-router-dom';
import { FileText, CheckSquare, Radio, TrendingUp, Clock, Plus } from 'lucide-react';
import { useStore, useCurrentUser } from '../store/useStore';
import { computeSchedule, describeDiff, formatClock, formatDuration } from '../lib/rundownTiming';
import { StatusBadge } from '../components/StatusBadge';

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

export function Dashboard() {
  const { notes, rundown } = useStore();
  const currentUser = useCurrentUser();
  const rundownItems = rundown?.items ?? [];
  const schedule = rundown ? computeSchedule(rundown.items, rundown.airTime, rundown.plannedDurationSecs) : null;

  const borradores  = notes.filter((n) => n.status === 'borrador').length;
  const enRevision  = notes.filter((n) => n.status === 'en_revision').length;
  const aprobadas   = notes.filter((n) => n.status === 'aprobada').length;
  const publicadas  = notes.filter((n) => n.status === 'publicada').length;
  const recientes   = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const alAire      = rundownItems.find((i) => i.status === 'al_aire');

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido/a, {currentUser.name.split(' ')[0]}</h1>
          <p className="text-gray-500 mt-1">Sistema de Redacción Digital y TV — somoseffe</p>
        </div>
        <Link
          to="/notas/nueva"
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Borradores"  value={borradores}  sub="pendientes de envío"  color="text-gray-700" />
        <StatCard label="En revisión" value={enRevision}  sub="esperando aprobación" color="text-yellow-600" />
        <StatCard label="Aprobadas"   value={aprobadas}   sub="listas para emitir"   color="text-green-600" />
        <StatCard label="Publicadas"  value={publicadas}  sub="al aire o publicadas"  color="text-brand-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent notes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-500" />
              <h2 className="font-semibold text-gray-900">Notas recientes</h2>
            </div>
            <Link to="/notas" className="text-xs text-brand-600 hover:underline">Ver todas</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {recientes.map((note) => (
              <li key={note.id}>
                <Link to={`/notas/${note.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{note.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {note.authorName} · {new Date(note.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <StatusBadge status={note.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* On air */}
          <div className={`rounded-xl border p-5 ${alAire ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Radio className={`h-4 w-4 ${alAire ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
              <h2 className={`font-semibold text-sm ${alAire ? 'text-red-700' : 'text-gray-500'}`}>
                {alAire ? 'AL AIRE AHORA' : 'Sin emisión activa'}
              </h2>
            </div>
            {alAire ? (
              <>
                <p className="text-sm font-medium text-gray-900">{alAire.noteTitle ?? alAire.type}</p>
                <p className="text-xs text-gray-500 mt-1">Presenta: {alAire.presenter ?? '—'}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{Math.floor(alAire.durationSecs / 60)}:{String(alAire.durationSecs % 60).padStart(2, '0')} min</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">No hay ningún segmento en transmisión.</p>
            )}
            <Link to="/rundown" className="mt-3 text-xs font-medium text-brand-600 hover:underline block">
              Ver rundown completo →
            </Link>
          </div>

          {/* Pending approvals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="h-4 w-4 text-yellow-500" />
              <h2 className="font-semibold text-sm text-gray-900">Aprobaciones pendientes</h2>
            </div>
            {enRevision > 0 ? (
              <>
                <p className="text-2xl font-bold text-yellow-600">{enRevision}</p>
                <p className="text-xs text-gray-400 mt-0.5">nota{enRevision > 1 ? 's' : ''} esperando revisión</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Sin pendientes.</p>
            )}
            <Link to="/aprobaciones" className="mt-3 text-xs font-medium text-brand-600 hover:underline block">
              Ir a aprobaciones →
            </Link>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              <h2 className="font-semibold text-sm text-gray-900">Rundown de hoy</h2>
            </div>
            <p className="text-sm text-gray-700 font-medium">{rundown?.title ?? 'Sin rundown activo'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rundown ? `${rundown.channel} · ${rundown.date}` : '—'}</p>
            <p className="text-xs text-gray-500 mt-2">{rundownItems.length} segmentos · {formatDuration(schedule?.totalSecs ?? 0)} totales</p>
            {schedule && (
              <p className="text-xs text-gray-500 mt-0.5">
                Fin estimado {schedule.endSecs === null ? '—' : formatClock(schedule.endSecs)} · {describeDiff(schedule.diffSecs).label}
              </p>
            )}
            <Link to="/rundown" className="mt-3 text-xs font-medium text-brand-600 hover:underline block">
              Ver escaleta →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
