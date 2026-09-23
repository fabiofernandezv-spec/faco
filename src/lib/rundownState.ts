// Cambio de estado de segmentos para el modo demo; misma regla que el
// trigger guard_rundown_item(): un solo segmento al aire, el anterior pasa a emitido.
import type { RundownItem, RundownItemStatus } from '../types';

export function applySegmentStatus(items: RundownItem[], itemId: string, status: RundownItemStatus): RundownItem[] {
  const target = items.find((i) => i.id === itemId);
  if (!target || target.status === status) return items;
  return items.map((i) => {
    if (i.id === itemId) return { ...i, status };
    if (status === 'al_aire' && i.status === 'al_aire') return { ...i, status: 'emitido' };
    return i;
  });
}

export const SEGMENT_LIMITS = { minSecs: 1, maxSecs: 3600, maxNotes: 1000 } as const;
export const RUNDOWN_LIMITS = { maxTitle: 200, maxChannel: 100, minPlanned: 60, maxPlanned: 21600 } as const;

/** Mismos límites que los CHECK de supabase/schema.sql. Devuelve un mensaje o null. */
export function validateSegment(input: { durationSecs?: number; notes?: string }): string | null {
  const { durationSecs, notes } = input;
  if (durationSecs !== undefined &&
      (!Number.isInteger(durationSecs) || durationSecs < SEGMENT_LIMITS.minSecs || durationSecs > SEGMENT_LIMITS.maxSecs)) {
    return 'La duración del segmento debe estar entre 0:01 y 60:00.';
  }
  if (notes !== undefined && notes.length > SEGMENT_LIMITS.maxNotes) {
    return 'Las observaciones no pueden superar 1000 caracteres.';
  }
  return null;
}

export function validateRundownInput(input: {
  title?: string; channel?: string; plannedDurationSecs?: number; airTime?: string;
}, parseClock: (v: string) => number | null): string | null {
  const { title, channel, plannedDurationSecs, airTime } = input;
  if (title !== undefined && (!title.trim() || title.trim().length > RUNDOWN_LIMITS.maxTitle)) {
    return 'El título es obligatorio (máx. 200 caracteres).';
  }
  if (channel !== undefined && channel.trim().length > RUNDOWN_LIMITS.maxChannel) {
    return 'El canal no puede superar 100 caracteres.';
  }
  if (plannedDurationSecs !== undefined &&
      (!Number.isInteger(plannedDurationSecs) ||
       plannedDurationSecs < RUNDOWN_LIMITS.minPlanned || plannedDurationSecs > RUNDOWN_LIMITS.maxPlanned)) {
    return 'La duración planificada debe estar entre 1:00 y 6:00:00.';
  }
  if (airTime && parseClock(airTime) === null) {
    return 'La hora de salida debe tener el formato HH:MM o HH:MM:SS.';
  }
  return null;
}
