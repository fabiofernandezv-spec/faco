// Reglas de permisos del lado cliente. Reflejan las políticas RLS y los
// triggers de supabase/schema.sql: la UI las usa para mostrar u ocultar
// acciones, y el modo demo para aplicarlas. La seguridad real está en la base.
import type { MediaItem, Note, Rundown, User } from '../types';

export const isEditorRole = (u: User | null) => u?.role === 'editor' || u?.role === 'director';

export const canCreateNote = (u: User | null) => !!u && u.role !== 'presentador';

export function canEditNote(u: User | null, note: Note | null | undefined): boolean {
  if (!u) return false;
  if (!note) return canCreateNote(u);
  if (isEditorRole(u)) return true;
  return note.authorId === u.id && (note.status === 'borrador' || note.status === 'rechazada');
}

export function canSubmitNote(u: User | null, note: Note | null | undefined): boolean {
  if (!note) return canCreateNote(u);
  if (note.status !== 'borrador' && note.status !== 'rechazada') return false;
  return !!u && (note.authorId === u.id || isEditorRole(u));
}

export const canReviewNotes = (u: User | null) => isEditorRole(u);

export function canDeleteNote(u: User | null, note: Note | null | undefined): boolean {
  if (!u || !note) return false;
  if (u.role === 'director') return true;
  return note.authorId === u.id && note.status === 'borrador';
}

export const canManageRundown = (u: User | null) => isEditorRole(u);

export const canChangeRundownStatus = (u: User | null) =>
  isEditorRole(u) || u?.role === 'presentador';

type RundownLike = Pick<Rundown, 'status'> | null | undefined;

/** Crear/editar/reordenar/quitar segmentos y editar datos: solo en un rundown activo. */
export const canEditRundown = (u: User | null, r: RundownLike) =>
  canManageRundown(u) && r?.status === 'activo';

export const canChangeSegmentStatus = (u: User | null, r: RundownLike) =>
  canChangeRundownStatus(u) && r?.status === 'activo';

export const canUploadMedia = (u: User | null) => canCreateNote(u);

export function canDeleteMedia(u: User | null, item: MediaItem): boolean {
  if (!u) return false;
  return u.role === 'director' || (!!item.uploadedById && item.uploadedById === u.id);
}

export const canManageUsers = (u: User | null) => u?.role === 'director';
