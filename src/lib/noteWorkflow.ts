// Máquina de estados de las notas para el modo demo. Es la misma lógica que
// aplica el trigger guard_note_write() en supabase/schema.sql.
import type { Note, NoteStatus, User } from '../types';
import { isEditorRole } from './permissions';

export function transitionNote(
  note: Note,
  to: NoteStatus,
  user: User,
  reason?: string,
  now: string = new Date().toISOString(),
): Note {
  const from = note.status;
  const editor = isEditorRole(user);

  if (from === to) return note;

  const allowed =
    ((from === 'borrador' || from === 'rechazada') && to === 'en_revision' && (note.authorId === user.id || editor)) ||
    (from === 'en_revision' && (to === 'aprobada' || to === 'rechazada') && editor) ||
    (from === 'aprobada' && to === 'publicada' && editor) ||
    ((from === 'en_revision' || from === 'aprobada') && to === 'borrador' && editor);

  if (!allowed) {
    throw new Error(`Transición de estado no permitida: ${from} → ${to} (rol ${user.role})`);
  }

  const next: Note = { ...note, status: to, updatedAt: now };
  if (to === 'aprobada') {
    Object.assign(next, { approvedAt: now, approvedBy: user.name, rejectedAt: undefined, rejectedBy: undefined, rejectedReason: undefined });
  } else if (to === 'rechazada') {
    const r = reason?.trim();
    if (!r) throw new Error('El rechazo requiere un motivo');
    Object.assign(next, { rejectedAt: now, rejectedBy: user.name, rejectedReason: r, approvedAt: undefined, approvedBy: undefined });
  } else if (to === 'borrador') {
    Object.assign(next, { approvedAt: undefined, approvedBy: undefined });
  }
  return next;
}
