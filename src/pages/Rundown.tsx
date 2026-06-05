import { useState } from 'react';
import { Tv2, Play, CheckCircle, Clock, Pause, Clapperboard, ChevronUp, ChevronDown, Plus, X, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { RundownItem } from '../types';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nota:            { label: 'Nota',             color: 'text-brand-700', bg: 'bg-brand-50' },
  pausa_comercial: { label: 'Pausa Comercial',  color: 'text-orange-700', bg: 'bg-orange-50' },
  cortina:         { label: 'Cortina',          color: 'text-purple-700', bg: 'bg-purple-50' },
  apertura:        { label: 'Apertura',         color: 'text-green-700',  bg: 'bg-green-50' },
  cierre:          { label: 'Cierre',           color: 'text-gray-700',   bg: 'bg-gray-100' },
};

const STATUS_CONFIG: Record<string, { icon: React.FC<{ className?: string }>; color: string }> = {
  pendiente: { icon: Clock,         color: 'text-gray-400' },
  al_aire:   { icon: Play,          color: 'text-red-500' },
  emitido:   { icon: CheckCircle,   color: 'text-green-500' },
};

function fmtSecs(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function RundownRow({
  item,
  onStatusChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  isFirst,
  isLast,
}: {
  item: RundownItem;
  onStatusChange: (status: RundownItem['status']) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const tc   = TYPE_CONFIG[item.type];
  const sc   = STATUS_CONFIG[item.status];
  const Icon = sc.icon;

  return (
    <tr className={`border-b border-gray-100 ${item.status === 'al_aire' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="disabled:opacity-20 hover:text-brand-600">
            <ChevronUp className="h-3 w-3" />
          </button>
          <span className="text-xs font-bold text-gray-400 w-5 text-center">{item.order}</span>
          <button onClick={onMoveDown} disabled={isLast} className="disabled:opacity-20 hover:text-brand-600">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tc.bg} ${tc.color}`}>
          {tc.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">
          {item.noteTitle ?? item.type.replace('_', ' ')}
        </p>
        {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
        {item.presenter && <p className="text-xs text-brand-600 mt-0.5">Presenta: {item.presenter}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 text-center">
        {item.startTime ?? '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 text-center font-mono">
        {fmtSecs(item.durationSecs)}
      </td>
      <td className="px-4 py-3 text-center">
        <Icon className={`h-4 w-4 mx-auto ${sc.color} ${item.status === 'al_aire' ? 'animate-pulse' : ''}`} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <select
            value={item.status}
            onChange={(e) => onStatusChange(e.target.value as RundownItem['status'])}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="pendiente">Pendiente</option>
            <option value="al_aire">Al aire</option>
            <option value="emitido">Emitido</option>
          </select>
          <button
            onClick={onRemove}
            className="p-1 text-gray-300 hover:text-red-400 transition-colors"
            title="Quitar del rundown"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function Rundown() {
  const { notes, rundown, updateRundownItem, reorderRundown, addRundownItem, removeRundownItem } = useStore();
  const [showLegend,  setShowLegend]  = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const availableNotes = notes.filter(
    (n) => n.forTv && n.status === 'aprobada' && !rundown.items.some((i) => i.noteId === n.id)
  );

  const emitidos   = rundown.items.filter((i) => i.status === 'emitido').length;
  const totalSecs  = rundown.items.reduce((a, i) => a + i.durationSecs, 0);
  const emitSecs   = rundown.items.filter((i) => i.status === 'emitido').reduce((a, i) => a + i.durationSecs, 0);
  const progress   = Math.round((emitSecs / totalSecs) * 100);

  function moveItem(idx: number, dir: -1 | 1) {
    const items = [...rundown.items];
    const swap  = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    reorderRundown(items.map((item, i) => ({ ...item, order: i + 1 })));
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tv2 className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-gray-900">Rundown / Escaleta TV</h1>
          </div>
          <p className="text-sm text-gray-500">{rundown.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{rundown.channel} · {rundown.date}</p>
        </div>
        <div className="flex items-start gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar nota
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-400">Duración total</p>
            <p className="text-2xl font-bold text-gray-900">{fmtSecs(totalSecs)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{emitidos}/{rundown.items.length} segmentos emitidos</p>
          </div>
        </div>
      </div>

      {/* Add note modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Agregar nota al rundown</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {availableNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No hay notas aprobadas disponibles para TV.<br />
                  <span className="text-xs">Las notas deben estar aprobadas y marcadas "Para TV".</span>
                </p>
              ) : (
                <ul className="space-y-2">
                  {availableNotes.map((note) => (
                    <li key={note.id}>
                      <button
                        onClick={() => { addRundownItem(note); setShowAddModal(false); }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
                      >
                        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700">{note.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <span className="capitalize">{note.category}</span>
                          <span>·</span>
                          <span>{fmtSecs(note.durationSecs ?? 60)}</span>
                          <span>·</span>
                          <span>{note.authorName}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Progreso de emisión</span>
          <span>{progress}% · {fmtSecs(emitSecs)} de {fmtSecs(totalSecs)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Legend toggle */}
      <button
        onClick={() => setShowLegend(!showLegend)}
        className="text-xs text-brand-600 hover:underline mb-4 flex items-center gap-1"
      >
        <Clapperboard className="h-3 w-3" />
        {showLegend ? 'Ocultar leyenda' : 'Ver leyenda de tipos'}
      </button>

      {showLegend && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(TYPE_CONFIG).map(([key, val]) => (
            <span key={key} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${val.bg} ${val.color}`}>
              {val.label}
            </span>
          ))}
        </div>
      )}

      {/* Table */}
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
              <th className="px-4 py-3 text-center font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rundown.items.map((item, idx) => (
              <RundownRow
                key={item.id}
                item={item}
                onStatusChange={(s) => updateRundownItem(item.id, s)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
                onRemove={() => removeRundownItem(item.id)}
                isFirst={idx === 0}
                isLast={idx === rundown.items.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Commercial pause indicator */}
      {rundown.items.some((i) => i.type === 'pausa_comercial' && i.status === 'al_aire') && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Pause className="h-5 w-5 text-orange-500 animate-pulse" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Pausa comercial en curso</p>
            <p className="text-xs text-orange-600">El bloque de publicidad está al aire.</p>
          </div>
        </div>
      )}
    </div>
  );
}
