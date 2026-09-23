import { describe, expect, it } from 'vitest';
import type { RundownItem } from '../../types';
import { applySegmentStatus, validateRundownInput, validateSegment } from '../rundownState';
import { parseClock } from '../rundownTiming';

const item = (id: string, status: RundownItem['status']): RundownItem =>
  ({ id, order: 1, type: 'nota', durationSecs: 60, status });

describe('applySegmentStatus', () => {
  it('cambio simple', () => {
    const out = applySegmentStatus([item('a', 'pendiente'), item('b', 'pendiente')], 'a', 'emitido');
    expect(out.map((i) => i.status)).toEqual(['emitido', 'pendiente']);
  });

  it('relevo: el anterior al aire pasa a emitido', () => {
    const out = applySegmentStatus([item('a', 'al_aire'), item('b', 'pendiente'), item('c', 'emitido')], 'b', 'al_aire');
    expect(out.map((i) => i.status)).toEqual(['emitido', 'al_aire', 'emitido']);
    expect(out.filter((i) => i.status === 'al_aire')).toHaveLength(1);
  });

  it('poner pendiente el que está al aire deja ninguno al aire', () => {
    const out = applySegmentStatus([item('a', 'al_aire'), item('b', 'pendiente')], 'a', 'pendiente');
    expect(out.some((i) => i.status === 'al_aire')).toBe(false);
  });

  it('volver a poner al aire el mismo no cambia los demás', () => {
    const items = [item('a', 'al_aire'), item('b', 'emitido')];
    expect(applySegmentStatus(items, 'a', 'al_aire')).toEqual(items);
  });

  it('id inexistente: sin cambios', () => {
    const items = [item('a', 'al_aire')];
    expect(applySegmentStatus(items, 'zzz', 'al_aire')).toEqual(items);
  });
});

describe('validateSegment', () => {
  it('acepta límites y rechaza fuera de rango', () => {
    expect(validateSegment({ durationSecs: 1 })).toBeNull();
    expect(validateSegment({ durationSecs: 3600 })).toBeNull();
    expect(validateSegment({ durationSecs: 0 })).toMatch(/duración/);
    expect(validateSegment({ durationSecs: 3601 })).toMatch(/duración/);
    expect(validateSegment({ durationSecs: 1.5 })).toMatch(/duración/);
    expect(validateSegment({ notes: 'x'.repeat(1001) })).toMatch(/1000/);
  });
});

describe('validateRundownInput', () => {
  it('valida título, canal, duración planificada y hora de salida', () => {
    expect(validateRundownInput({ title: 'Noche', plannedDurationSecs: 1800, airTime: '20:00' }, parseClock)).toBeNull();
    expect(validateRundownInput({ title: '  ' }, parseClock)).toMatch(/título/);
    expect(validateRundownInput({ channel: 'x'.repeat(101) }, parseClock)).toMatch(/canal/);
    expect(validateRundownInput({ plannedDurationSecs: 59 }, parseClock)).toMatch(/planificada/);
    expect(validateRundownInput({ plannedDurationSecs: 21601 }, parseClock)).toMatch(/planificada/);
    expect(validateRundownInput({ airTime: '25:00' }, parseClock)).toMatch(/hora de salida/);
    expect(validateRundownInput({ airTime: '' }, parseClock)).toBeNull();
  });
});
