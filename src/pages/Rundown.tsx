import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Tv2, Play, CheckCircle, Clock, Pause, ChevronUp, ChevronDown, Plus, Trash2, Pencil,
  Archive, ArchiveRestore, Settings2, Lock,
} from 'lucide-react';
import clsx from 'clsx';
import { useStore, useCurrentUser } from '../store/useStore';
import { canChangeSegmentStatus, canEditRundown, canManageRundown } from '../lib/permissions';
import { computeSchedule, describeDiff, formatClock, formatDuration, parseClock } from '../lib/rundownTiming';
import { SegmentForm, SEGMENT_TYPE_LABELS, type SegmentFormValues } from '../components/SegmentForm';
import { RundownForm } from '../components/RundownForm';
import type { Note, RundownItem } from '../types';

const TYPE_STYLE: Record<RundownItem['type'], string> = {
  nota:            'text-brand-700 bg-brand-50',
  pausa_comercial: 'text-orange-700 bg-orange-50',
  cortina:         'text-purple-700 bg-purple-50',
  apertura:        'text-green-700 bg-green-50',
  cierre:          'text-gray-700 bg-gray-100',
};

const STATUS_ICON: Record<RundownItem['status'], { icon: React.FC<{ className?: string }>; color: string }> = {
  pendiente: { icon: Clock,       color: 'text-gray-400' },
  al_aire:   { icon: Play,        color: 'text-red-500' },
  emitido:   { icon: CheckCircle, color: 'text-green-500' },
};

const DIFF_STYLE = {
  over:  'bg-red-50 text-red-700 border-red-200',
  under: 'bg-amber-50 text-amber-700 border-amber-200',
  ok:    'bg-green-50 text-green-700 border-green-200',
} as const;

const isAvailableForTv = (n: Note | undefined) =>
  !!n && n.forTv && (n.status === 'aprobada' || n.status === 'publicada');

export function Rundown() {
  const currentUser = useCurrentUser();
  const {
    notes, rundown, rundowns, presenters, selectRundown, refreshPresenters, createRundown, updateRundown,
    archiveRundown, reactivateRundown, addSegment, updateSegment, setRundownItemStatus, moveRundownItem,
    removeRundownItem,
  } = useStore();
  const [params, setParams] = useSearchParams();
  const [segmentForm, setSegmentForm] = useState<{ item?: RundownItem } | null>(null);
  const [rundownForm, setRundownForm] = useState<'new' | 'edit' | null>(null);

  // La URL manda: /rundown?id=… selecciona; sin id se muestra el activo por defecto.
  const urlId = params.get('id');
  useEffect(() => { if (urlId) void selectRundown(urlId); }, [urlId, selectRundown]);
  useEffect(() => { void refreshPresenters(); }, [refreshPresenters]);

  const canManage = canManageRundown(currentUser);
  const canEdit   = canEditRundown(currentUser, rundown);
  const canStatus = canChangeSegmentStatus(currentUser, rundown);

  function choose(id: string) {
    setParams(id ? { id } : {});
  }

  // Al crear, se selecciona el nuevo rundown: la URL deja de apuntar al anterior.
  async function create(values: Parameters<typeof createRundown>[0]) {
    const ok = await createRundown(values);
    if (ok) setParams({});
    return ok;
  }

  if (!rundown) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Header />
        <p className="text-sm text-gray-500 mb-6">No hay un rundown activo.</p>
        {rundowns.length > 0 && <Selector value="" onChange={choose} />}
        {canManage
          ? <RundownForm inline onSubmit={create} />
          : <p className="text-sm text-gray-400">Un editor o director debe crear el rundown del día.</p>}
      </div>
    );
  }

  const schedule = computeSchedule(rundown.items, rundown.airTime, rundown.plannedDurationSecs);
  const airSecs = parseClock(rundown.airTime);
  const diff = describeDiff(schedule.diffSecs);
  const archived = rundown.status === 'archivado';
  const availableNotes = notes.filter((n) => isAvailableForTv(n) && !rundown.items.some((i) => i.noteId === n.id));
  const emitidos = rundown.items.filter((i) => i.status === 'emitido').length;

  async function submitSegment(values: SegmentFormValues, item?: RundownItem) {
    if (item) {
      return updateSegment(item.id, {
        durationSecs: values.durationSecs, presenterId: values.presenterId, notes: values.notes,
      });
    }
    return addSegment({
      type: values.type, noteId: values.noteId, durationSecs: values.durationSecs,
      presenterId: values.presenterId ?? undefined, notes: values.notes,
    });
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <Header />
          <p className="text-sm text-gray-700 font-medium">{rundown.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{[rundown.channel, rundown.date].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Selector value={rundown.id} onChange={choose} />
          {canManage && (
            <button onClick={() => setRundownForm('new')} className={btnSecondary}>
              <Plus className="h-4 w-4" /> Nuevo rundown
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => setRundownForm('edit')} className={btnSecondary}>
                <Settings2 className="h-4 w-4" /> Datos
              </button>
              <button
                onClick={() => { if (window.confirm('¿Archivar este rundown? Quedará de solo lectura.')) void archiveRundown(); }}
                className={btnSecondary}
              >
                <Archive className="h-4 w-4" /> Archivar
              </button>
              <button onClick={() => setSegmentForm({})} className={btnPrimary}>
                <Plus className="h-4 w-4" /> Agregar segmento
              </button>
            </>
          )}
          {archived && canManage && (
            <button onClick={() => void reactivateRundown()} className={btnPrimary}>
              <ArchiveRestore className="h-4 w-4" /> Reactivar
            </button>
          )}
        </div>
      </div>

      {archived && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <Lock className="h-4 w-4" />
          Archivado · solo lectura
          {rundown.archivedAt && <> · {new Date(rundown.archivedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</>}
          {rundown.archivedBy && <> · {rundown.archivedBy}</>}
        </div>
      )}

      {/* Tiempos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Salida al aire" value={airSecs === null ? '—' : formatClock(airSecs)} />
        <Stat label="Duración planificada" value={formatDuration(rundown.plannedDurationSecs)} />
        <Stat label="Duración total" value={formatDuration(schedule.totalSecs)} />
        <Stat label="Fin estimado" value={schedule.endSecs === null ? '—' : formatClock(schedule.endSecs)} />
        <div className={clsx('rounded-xl border p-3', DIFF_STYLE[diff.tone])} data-testid="rundown-diff">
          <p className="text-xs opacity-80">Desfase</p>
          <p className="text-lg font-bold">{diff.label}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Progreso de emisión · {emitidos}/{rundown.items.length} segmentos emitidos</span>
          <span>{schedule.progress}% · {formatDuration(schedule.emittedSecs)} de {formatDuration(schedule.totalSecs)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${schedule.progress}%` }} />
        </div>
      </div>

      {/* Escaleta */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-14">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Contenido</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Inicio</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Duración</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rundown.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Sin segmentos todavía.</td></tr>
            )}
            {rundown.items.map((item, idx) => {
              const Icon = STATUS_ICON[item.status].icon;
              const note = item.noteId ? notes.find((n) => n.id === item.noteId) : undefined;
              const unavailable = item.type === 'nota' && (!item.noteId || (!!note && !isAvailableForTv(note)));
              const start = schedule.starts[idx];
              return (
                <tr key={item.id} className={clsx('border-b border-gray-100 transition-colors', item.status === 'al_aire' ? 'bg-red-50' : 'hover:bg-gray-50')}>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {canEdit && (
                        <button onClick={() => void moveRundownItem(idx, -1)} disabled={idx === 0} aria-label="Subir" className="disabled:opacity-20 hover:text-brand-600">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      )}
                      <span className="text-xs font-bold text-gray-400 w-5 text-center">{item.order}</span>
                      {canEdit && (
                        <button onClick={() => void moveRundownItem(idx, 1)} disabled={idx === rundown.items.length - 1} aria-label="Bajar" className="disabled:opacity-20 hover:text-brand-600">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TYPE_STYLE[item.type])}>
                      {SEGMENT_TYPE_LABELS[item.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.noteTitle ?? SEGMENT_TYPE_LABELS[item.type]}</p>
                    {unavailable && <p className="text-xs text-amber-600 mt-0.5">Nota no disponible</p>}
                    {item.notes && <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-line">{item.notes}</p>}
                    {item.presenter && <p className="text-xs text-brand-600 mt-0.5">Presenta: {item.presenter}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 text-center font-mono">{start === null ? '—' : formatClock(start)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 text-center font-mono">{formatDuration(item.durationSecs)}</td>
                  <td className="px-4 py-3 text-center">
                    <Icon className={clsx('h-4 w-4 mx-auto', STATUS_ICON[item.status].color, item.status === 'al_aire' && 'animate-pulse')} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <select
                        value={item.status}
                        onChange={(e) => void setRundownItemStatus(item.id, e.target.value as RundownItem['status'])}
                        disabled={!canStatus}
                        aria-label={`Estado del segmento ${item.order}`}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="al_aire">Al aire</option>
                        <option value="emitido">Emitido</option>
                      </select>
                      {canEdit && (
                        <>
                          <button onClick={() => setSegmentForm({ item })} className="p-1 text-gray-300 hover:text-brand-500" aria-label={`Editar segmento ${item.order}`} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void removeRundownItem(item.id)}
                            disabled={item.status === 'al_aire'}
                            className="p-1 text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-300"
                            aria-label={`Quitar segmento ${item.order}`}
                            title={item.status === 'al_aire' ? 'No se puede quitar el segmento que está al aire' : 'Quitar del rundown'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rundown.items.some((i) => i.type === 'pausa_comercial' && i.status === 'al_aire') && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Pause className="h-5 w-5 text-orange-500 animate-pulse" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Pausa comercial en curso</p>
            <p className="text-xs text-orange-600">El bloque de publicidad está al aire.</p>
          </div>
        </div>
      )}

      {segmentForm && (
        <SegmentForm
          item={segmentForm.item}
          availableNotes={availableNotes}
          presenters={presenters}
          onSubmit={(values) => submitSegment(values, segmentForm.item)}
          onClose={() => setSegmentForm(null)}
        />
      )}
      {rundownForm && (
        <RundownForm
          rundown={rundownForm === 'edit' ? rundown : undefined}
          onSubmit={rundownForm === 'edit' ? updateRundown : create}
          onClose={() => setRundownForm(null)}
        />
      )}
    </div>
  );
}

const btnPrimary = 'flex items-center gap-2 bg-brand-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors';
const btnSecondary = 'flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors';

function Header() {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Tv2 className="h-5 w-5 text-brand-500" />
      <h1 className="text-2xl font-bold text-gray-900">Rundown / Escaleta TV</h1>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 font-mono">{value}</p>
    </div>
  );
}

function Selector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const rundowns = useStore((s) => s.rundowns);
  const active = rundowns.filter((r) => r.status !== 'archivado');
  const archived = rundowns.filter((r) => r.status === 'archivado');
  const label = (r: (typeof rundowns)[number]) => [r.title, r.channel, r.date].filter(Boolean).join(' · ');
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Elegir rundown"
      className="text-sm border border-gray-200 rounded-lg px-3 py-2 max-w-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {!value && <option value="">Elegir rundown…</option>}
      {active.length > 0 && (
        <optgroup label="Activos">
          {active.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
        </optgroup>
      )}
      {archived.length > 0 && (
        <optgroup label="Anteriores (archivados)">
          {archived.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
        </optgroup>
      )}
    </select>
  );
}
