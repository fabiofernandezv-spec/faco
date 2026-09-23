import { supabase } from './supabase';
import { ConflictError } from './errors';
import { normalizeBody, sanitizeHtml } from './sanitize';
import type { Note, NoteStatus } from '../types';

type Row = Record<string, unknown>;

export function toNote(row: Row): Note {
  return {
    id:                   row.id as string,
    title:                row.title as string,
    lead:                 (row.lead as string) ?? '',
    body:                 normalizeBody((row.body as string) ?? ''),
    category:             row.category as Note['category'],
    status:               row.status as NoteStatus,
    authorId:             row.author_id as string,
    authorName:           (row.author_name as string) ?? '',
    assignedEditorId:     (row.assigned_editor_id as string) ?? undefined,
    assignedEditorName:   (row.assigned_editor_name as string) ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
    approvedAt:           (row.approved_at as string) ?? undefined,
    approvedBy:           (row.approved_by as string) ?? undefined,
    rejectedAt:           (row.rejected_at as string) ?? undefined,
    rejectedBy:           (row.rejected_by as string) ?? undefined,
    rejectedReason:       (row.rejected_reason as string) ?? undefined,
    media:                [],
    tags:                 (row.tags as string[]) ?? [],
    durationSecs:         (row.duration_secs as number) ?? 60,
    forTv:                Boolean(row.for_tv),
  };
}

/** Campos editables por el cliente. Autoría y aprobación los fija la base. */
export type NoteContent = Pick<Note, 'title' | 'lead' | 'body' | 'category' | 'tags' | 'durationSecs' | 'forTv'>;

export function toContentPatch(changes: Partial<NoteContent>): Row {
  const patch: Row = {};
  if (changes.title        !== undefined) patch.title         = changes.title.trim();
  if (changes.lead         !== undefined) patch.lead          = changes.lead;
  if (changes.body         !== undefined) patch.body          = sanitizeHtml(changes.body);
  if (changes.category     !== undefined) patch.category      = changes.category;
  if (changes.tags         !== undefined) patch.tags          = changes.tags;
  if (changes.durationSecs !== undefined) patch.duration_secs = changes.durationSecs;
  if (changes.forTv        !== undefined) patch.for_tv        = changes.forTv;
  return patch;
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await client()
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNote);
}

export async function createNote(content: NoteContent, status: 'borrador' | 'en_revision'): Promise<Note> {
  const { data, error } = await client()
    .from('notes')
    .insert({ ...toContentPatch(content), status })
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

/**
 * Actualiza con control de concurrencia optimista: solo aplica si la nota no
 * cambió desde `expectedUpdatedAt`. Si otra persona la modificó, lanza ConflictError.
 */
export async function updateNote(
  id: string,
  expectedUpdatedAt: string,
  patch: Row,
): Promise<Note> {
  const { data, error } = await client()
    .from('notes')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
  return toNote(data[0]);
}

export async function deleteNote(id: string): Promise<void> {
  const { data, error } = await client().from('notes').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para eliminar esta nota.');
}
