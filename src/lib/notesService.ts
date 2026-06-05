import { supabase } from './supabase';
import type { Note, NoteStatus } from '../types';

function toNote(row: Record<string, unknown>): Note {
  return {
    id:                   row.id as string,
    title:                row.title as string,
    lead:                 (row.lead as string) ?? '',
    body:                 (row.body as string) ?? '',
    category:             row.category as Note['category'],
    status:               row.status as NoteStatus,
    authorId:             row.author_id as string,
    authorName:           row.author_name as string,
    assignedEditorId:     (row.assigned_editor_id as string) ?? undefined,
    assignedEditorName:   (row.assigned_editor_name as string) ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
    approvedAt:           (row.approved_at as string) ?? undefined,
    approvedBy:           (row.approved_by as string) ?? undefined,
    rejectedReason:       (row.rejected_reason as string) ?? undefined,
    media:                [],
    tags:                 (row.tags as string[]) ?? [],
    durationSecs:         (row.duration_secs as number) ?? 60,
    forTv:                Boolean(row.for_tv),
  };
}

export async function fetchNotes(): Promise<Note[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNote);
}

export async function createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title:               note.title,
      lead:                note.lead,
      body:                note.body,
      category:            note.category,
      status:              note.status,
      author_id:           note.authorId,
      author_name:         note.authorName,
      tags:                note.tags,
      duration_secs:       note.durationSecs,
      for_tv:              note.forTv,
    })
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function updateNoteById(id: string, changes: Partial<Note>): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.title              !== undefined) patch.title               = changes.title;
  if (changes.lead               !== undefined) patch.lead                = changes.lead;
  if (changes.body               !== undefined) patch.body                = changes.body;
  if (changes.category           !== undefined) patch.category            = changes.category;
  if (changes.status             !== undefined) patch.status              = changes.status;
  if (changes.tags               !== undefined) patch.tags                = changes.tags;
  if (changes.durationSecs       !== undefined) patch.duration_secs       = changes.durationSecs;
  if (changes.forTv              !== undefined) patch.for_tv              = changes.forTv;
  if (changes.approvedAt         !== undefined) patch.approved_at         = changes.approvedAt;
  if (changes.approvedBy         !== undefined) patch.approved_by         = changes.approvedBy;
  if (changes.rejectedReason     !== undefined) patch.rejected_reason     = changes.rejectedReason;
  if (changes.assignedEditorId   !== undefined) patch.assigned_editor_id  = changes.assignedEditorId;
  if (changes.assignedEditorName !== undefined) patch.assigned_editor_name = changes.assignedEditorName;

  const { error } = await supabase.from('notes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteNoteById(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
