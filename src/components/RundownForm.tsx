import { useState } from 'react';
import { X } from 'lucide-react';
import type { Rundown } from '../types';
import type { RundownInput } from '../lib/rundownService';
import { formatDuration, parseClock, parseDuration } from '../lib/rundownTiming';
import { validateRundownInput } from '../lib/rundownState';

interface Props {
  /** Rundown a editar; sin él, el formulario es de alta. */
  rundown?: Rundown;
  onSubmit: (values: RundownInput) => Promise<boolean>;
  onClose?: () => void;
  /** Mostrar como tarjeta en la página en vez de modal. */
  inline?: boolean;
}

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500';

export function RundownForm({ rundown, onSubmit, onClose, inline }: Props) {
  const [title,   setTitle]   = useState(rundown?.title ?? 'Noticiero Central');
  const [channel, setChannel] = useState(rundown?.channel ?? '');
  const [date,    setDate]    = useState(rundown?.date ?? new Date().toISOString().slice(0, 10));
  const [airTime, setAirTime] = useState(rundown?.airTime ?? '');
  const [planned, setPlanned] = useState(formatDuration(rundown?.plannedDurationSecs ?? 1800));
  const [busy,    setBusy]    = useState(false);

  const plannedSecs = parseDuration(planned);
  const error =
    plannedSecs === null ? 'Duración planificada inválida: usa M:SS, H:MM:SS o minutos.'
    : validateRundownInput({ title, channel, plannedDurationSecs: plannedSecs, airTime }, parseClock)
      ?? (!date ? 'La fecha es obligatoria.' : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error || plannedSecs === null) return;
    setBusy(true);
    const ok = await onSubmit({ title, channel, date, airTime: airTime.trim(), plannedDurationSecs: plannedSecs });
    setBusy(false);
    if (ok) onClose?.();
  }

  const form = (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 w-full max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">{rundown ? 'Editar rundown' : 'Nuevo rundown'}</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <label className="block"><span className="block text-xs text-gray-500 mb-1">Título</span>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Canal</span>
          <input className={input} value={channel} onChange={(e) => setChannel(e.target.value)} maxLength={100} /></label>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Fecha</span>
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Hora de salida (HH:MM)</span>
          <input className={input} value={airTime} onChange={(e) => setAirTime(e.target.value)} placeholder="20:00" /></label>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Duración planificada</span>
          <input className={input} value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="30:00" required /></label>
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <div className="flex justify-end gap-3">
        {onClose && (
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={!!error || busy}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {busy ? 'Guardando…' : rundown ? 'Guardar' : 'Crear rundown'}
        </button>
      </div>
    </form>
  );

  if (inline) return form;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      {form}
    </div>
  );
}
