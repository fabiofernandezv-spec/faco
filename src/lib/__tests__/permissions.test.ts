import { describe, expect, it } from 'vitest';
import type { Note, User } from '../../types';
import {
  canDeleteMedia, canDeleteNote, canEditNote, canManageRundown, canManageUsers,
  canReviewNotes, canSubmitNote, canChangeRundownStatus, canCreateNote,
} from '../permissions';
import { transitionNote } from '../noteWorkflow';

const redactor: User    = { id: 'r1', name: 'Rita', role: 'redactor' };
const otro: User        = { id: 'r2', name: 'Otro', role: 'redactor' };
const editor: User      = { id: 'e1', name: 'Eva', role: 'editor' };
const director: User    = { id: 'd1', name: 'Dani', role: 'director' };
const presentador: User = { id: 'p1', name: 'Pau', role: 'presentador' };

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n', title: 't', lead: '', body: '', category: 'nacional', status: 'borrador',
  authorId: redactor.id, authorName: redactor.name, createdAt: '', updatedAt: '',
  media: [], tags: [], forTv: true, durationSecs: 60, ...over,
});

describe('permisos de notas', () => {
  it('el autor edita solo borradores o rechazadas', () => {
    expect(canEditNote(redactor, note())).toBe(true);
    expect(canEditNote(redactor, note({ status: 'rechazada' }))).toBe(true);
    expect(canEditNote(redactor, note({ status: 'en_revision' }))).toBe(false);
    expect(canEditNote(redactor, note({ status: 'aprobada' }))).toBe(false);
  });

  it('otro redactor no puede editar ni borrar', () => {
    expect(canEditNote(otro, note())).toBe(false);
    expect(canDeleteNote(otro, note())).toBe(false);
    expect(canSubmitNote(otro, note())).toBe(false);
  });

  it('solo editores y directores revisan', () => {
    expect(canReviewNotes(redactor)).toBe(false);
    expect(canReviewNotes(presentador)).toBe(false);
    expect(canReviewNotes(editor)).toBe(true);
    expect(canReviewNotes(director)).toBe(true);
  });

  it('presentadores no crean notas', () => {
    expect(canCreateNote(presentador)).toBe(false);
    expect(canCreateNote(redactor)).toBe(true);
  });

  it('solo el director borra notas que no son borrador', () => {
    expect(canDeleteNote(redactor, note({ status: 'aprobada' }))).toBe(false);
    expect(canDeleteNote(editor, note({ status: 'aprobada' }))).toBe(false);
    expect(canDeleteNote(director, note({ status: 'aprobada' }))).toBe(true);
  });
});

describe('permisos de rundown, medios y equipo', () => {
  it('rundown', () => {
    expect(canManageRundown(presentador)).toBe(false);
    expect(canChangeRundownStatus(presentador)).toBe(true);
    expect(canChangeRundownStatus(redactor)).toBe(false);
    expect(canManageRundown(editor)).toBe(true);
  });

  it('medios: dueño o director', () => {
    const item = { id: 'm', name: 'a', type: 'image' as const, url: '', size: 1, uploadedById: redactor.id, uploadedBy: 'Rita', uploadedAt: '' };
    expect(canDeleteMedia(redactor, item)).toBe(true);
    expect(canDeleteMedia(otro, item)).toBe(false);
    expect(canDeleteMedia(director, item)).toBe(true);
  });

  it('solo el director gestiona el equipo', () => {
    expect(canManageUsers(editor)).toBe(false);
    expect(canManageUsers(director)).toBe(true);
  });
});

describe('transitionNote', () => {
  it('flujo completo borrador → revisión → aprobada → publicada', () => {
    const sent = transitionNote(note(), 'en_revision', redactor, undefined, 'T1');
    const ok = transitionNote(sent, 'aprobada', editor, undefined, 'T2');
    expect(ok).toMatchObject({ status: 'aprobada', approvedBy: 'Eva', approvedAt: 'T2' });
    expect(transitionNote(ok, 'publicada', director).status).toBe('publicada');
  });

  it('un redactor no puede aprobar su nota', () => {
    const sent = transitionNote(note(), 'en_revision', redactor);
    expect(() => transitionNote(sent, 'aprobada', redactor)).toThrow(/no permitida/);
  });

  it('el rechazo exige motivo y registra quién rechazó', () => {
    const sent = transitionNote(note(), 'en_revision', redactor);
    expect(() => transitionNote(sent, 'rechazada', editor, '  ')).toThrow(/motivo/);
    const rej = transitionNote(sent, 'rechazada', editor, ' falta fuente ');
    expect(rej).toMatchObject({ status: 'rechazada', rejectedBy: 'Eva', rejectedReason: 'falta fuente', approvedBy: undefined });
  });

  it('no se puede saltar de borrador a aprobada', () => {
    expect(() => transitionNote(note(), 'aprobada', director)).toThrow();
  });
});
