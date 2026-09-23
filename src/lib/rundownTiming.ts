// Cálculo puro de horarios del rundown (specs/001-rundown-completo, R2/R6).
// Todo en segundos desde las 00:00; las horas se muestran módulo 24 h.
import type { RundownItem } from '../types';

const DAY = 86400;
const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:MM' o 'HH:MM:SS' → segundos desde medianoche, o null si no es válida. */
export function parseClock(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((value ?? '').trim());
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/** 'M:SS', 'H:MM:SS' o minutos enteros ('30') → segundos, o null si no es válida. */
export function parseDuration(value: string | null | undefined): number | null {
  const v = (value ?? '').trim();
  if (/^\d+$/.test(v)) return Number(v) * 60;
  let m = /^(\d+):([0-5]\d)$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(v);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return null;
}

export function formatClock(secs: number): string {
  const t = ((Math.floor(secs) % DAY) + DAY) % DAY;
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

export function formatDuration(secs: number): string {
  const t = Math.max(0, Math.floor(secs));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export interface Schedule {
  /** Inicio de cada segmento (segundos, puede superar 24 h), o null sin hora de salida. */
  starts: (number | null)[];
  totalSecs: number;
  endSecs: number | null;
  /** total − planificado: > 0 sobra, < 0 falta. */
  diffSecs: number;
  emittedSecs: number;
  /** Porcentaje emitido (0-100). */
  progress: number;
}

export function computeSchedule(
  items: Pick<RundownItem, 'durationSecs' | 'status'>[],
  airTime: string | null | undefined,
  plannedSecs: number,
): Schedule {
  const air = parseClock(airTime);
  const starts: (number | null)[] = [];
  let acc = 0;
  let emitted = 0;
  for (const item of items) {
    starts.push(air === null ? null : air + acc);
    acc += item.durationSecs;
    if (item.status === 'emitido') emitted += item.durationSecs;
  }
  return {
    starts,
    totalSecs: acc,
    endSecs: air === null ? null : air + acc,
    diffSecs: acc - plannedSecs,
    emittedSecs: emitted,
    progress: acc > 0 ? Math.round((emitted / acc) * 100) : 0,
  };
}

export function describeDiff(diffSecs: number): { label: string; tone: 'over' | 'under' | 'ok' } {
  if (diffSecs > 0) return { label: `sobran ${formatDuration(diffSecs)}`, tone: 'over' };
  if (diffSecs < 0) return { label: `faltan ${formatDuration(-diffSecs)}`, tone: 'under' };
  return { label: 'En tiempo', tone: 'ok' };
}
