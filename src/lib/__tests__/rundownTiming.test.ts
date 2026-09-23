import { describe, expect, it } from 'vitest';
import {
  computeSchedule, describeDiff, formatClock, formatDuration, parseClock, parseDuration,
} from '../rundownTiming';

const seg = (durationSecs: number, status: 'pendiente' | 'al_aire' | 'emitido' = 'pendiente') => ({ durationSecs, status });

describe('parseClock / formatClock', () => {
  it('parsea HH:MM y HH:MM:SS', () => {
    expect(parseClock('20:00')).toBe(72000);
    expect(parseClock('20:00:30')).toBe(72030);
    expect(parseClock(' 07:05:09 ')).toBe(25509);
  });

  it('rechaza horas inválidas', () => {
    for (const v of ['25:00', '12:60', '12:00:60', 'abc', '', '1:2:3:4']) expect(parseClock(v)).toBeNull();
  });

  it('formatea con ceros y da la vuelta a medianoche', () => {
    expect(formatClock(72030)).toBe('20:00:30');
    expect(formatClock(86400 + 1200)).toBe('00:20:00');
  });
});

describe('parseDuration / formatDuration', () => {
  it('acepta M:SS, H:MM:SS y minutos', () => {
    expect(parseDuration('1:15')).toBe(75);
    expect(parseDuration('0:30')).toBe(30);
    expect(parseDuration('1:00:00')).toBe(3600);
    expect(parseDuration('30')).toBe(1800);
  });

  it('rechaza formatos inválidos', () => {
    for (const v of ['0:75', 'abc', '', '-1:00', '1:2:3:4', '1:5']) expect(parseDuration(v)).toBeNull();
  });

  it('formatea M:SS o H:MM:SS', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('computeSchedule', () => {
  it('ejemplo de la especificación', () => {
    const s = computeSchedule([seg(30), seg(75), seg(120)], '20:00:00', 600);
    expect(s.starts.map((x) => (x === null ? null : formatClock(x)))).toEqual(['20:00:00', '20:00:30', '20:01:45']);
    expect(s.totalSecs).toBe(225);
    expect(formatClock(s.endSecs!)).toBe('20:03:45');
    expect(s.diffSecs).toBe(-375);
    expect(describeDiff(s.diffSecs)).toEqual({ label: 'faltan 6:15', tone: 'under' });
  });

  it('sin hora de salida no hay horas de inicio ni fin', () => {
    const s = computeSchedule([seg(30), seg(60)], undefined, 1800);
    expect(s.starts).toEqual([null, null]);
    expect(s.endSecs).toBeNull();
    expect(s.totalSecs).toBe(90);
  });

  it('lista vacía: total 0 y progreso 0', () => {
    const s = computeSchedule([], '20:00', 1800);
    expect(s.totalSecs).toBe(0);
    expect(s.progress).toBe(0);
    expect(formatClock(s.endSecs!)).toBe('20:00:00');
  });

  it('sobra, en tiempo y progreso de emitidos', () => {
    const over = computeSchedule([seg(700, 'emitido'), seg(100)], '20:00', 600);
    expect(describeDiff(over.diffSecs)).toEqual({ label: 'sobran 3:20', tone: 'over' });
    expect(over.emittedSecs).toBe(700);
    expect(over.progress).toBe(88);
    expect(describeDiff(computeSchedule([seg(600)], '20:00', 600).diffSecs)).toEqual({ label: 'En tiempo', tone: 'ok' });
  });

  it('cruce de medianoche', () => {
    const s = computeSchedule([seg(600), seg(1200)], '23:50', 1800);
    expect(formatClock(s.starts[1]!)).toBe('00:00:00');
    expect(formatClock(s.endSecs!)).toBe('00:20:00');
  });

  it('hora de salida inválida se trata como ausente', () => {
    expect(computeSchedule([seg(10)], '99:99', 60).starts).toEqual([null]);
  });
});
