import { useState } from 'react';
import { X } from 'lucide-react';
import type { Note, RundownItem, User } from '../types';
import { formatDuration, parseDuration } from '../lib/rundownTiming';
import { SEGMENT_LIMITS, validateSegment } from '../lib/rundownState';

export const SEGMENT_TYPE_LABELS: Record<RundownItem['type'], string> = {
  apertura:        'Apertura',
  nota:            'Nota',
  pausa_comercial: 'Pausa comercial',
  cortina:         'Cortina',
  cierre:          'Cierre',
};

export interface SegmentFormValues {
  type: RundownItem['type'];
  noteId?: string;
  durationSecs: number;
  presenterId: string | null;
  notes: string;
}

interface Props {
  /** Segmento a editar; sin él, el formulario es de alta. */
  item?: RundownItem;
  /** Notas que se pueden agregar (aprobadas/publicadas para TV que no están en el rundown). */
  availableNotes: Note[];
  presenters: User[];
  onSubmit: (values: SegmentFormValues) => Promise<boolean>;
  onClose: () => void;
}

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500';

export function SegmentForm({ item, availableNotes, presenters, onSubmit, onClose }: Props) {
  const isNew = !item;
  const [type, setType]           = useState<RundownItem['type']>(item?.type ?? 'nota');
  const [noteId, setNoteId]       = useState<string>(availableNotes[0]?.id ?? '');
  const [duration, setDuration]   = useState(formatDuration(item?.durationSecs ?? availableNotes[0]?.durationSecs ?? 60));
  const [presenterId, setPresenter] = useState<string>(item?.presenterId ?? '');
  const [notes, setNotes]         = useState(item?.notes ?? '');
  const [busy, setBusy]           = useState(false);

  const durationSecs = parseDuration(duration);
  const error =
    durationSecs === null ? 'Duración inválida: usa M:SS (por ejemplo 1:30).'
    : validateSegment({ durationSecs, notes })
      ?? (isNew && type === 'nota' && !noteId ? 'Elige una nota aprobada para TV.' : null);

  function chooseNote(id: string) {
    setNoteId(id);
    const note = availableNotes.find((n) => n.id === id);
    if (note?.durationSecs) setDuration(formatDuration(note.durationSecs));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error || durationSecs === null) return;
    setBusy(true);
    const ok = await onSubmit({
      type,
      noteId: type === 'nota' ? noteId : undefined,
      durationSecs,
      presenterId: presenterId || null,
      notes,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{isNew ? 'Agregar segmento' : 'Editar segmento'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isNew ? (
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Tipo</span>
              <select className={input} value={type} onChange={(e) => setType(e.target.value as RundownItem['type'])}>
                {Object.entries(SEGMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          ) : (
            <p className="text-sm text-gray-600">
              <span className="font-medium">{SEGMENT_TYPE_LABELS[item.type]}</span>
              {item.noteTitle && <> · {item.noteTitle}</>}
            </p>
          )}

          {isNew && type === 'nota' && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Nota</span>
              {availableNotes.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No hay notas aprobadas para TV disponibles. Las notas deben estar aprobadas y marcadas "Para TV".
                </p>
              ) : (
                <select className={input} value={noteId} onChange={(e) => chooseNote(e.target.value)}>
                  {availableNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              )}
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Duración (M:SS)</span>
              <input className={input} value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" required />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Presentador</span>
              <select className={input} value={presenterId} onChange={(e) => setPresenter(e.target.value)}>
                <option value="">Sin presentador</option>
                {presenters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">Observaciones</span>
            <textarea
              className={`${input} resize-none`} rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)} maxLength={SEGMENT_LIMITS.maxNotes}
              placeholder="Ej.: Bloque comercial 1 — 4 spots"
            />
          </label>

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            type="submit" disabled={!!error || busy}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
