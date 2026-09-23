import { supabase } from './supabase';
import type { Rundown, RundownItem, RundownItemStatus, RundownSummary, User } from '../types';

type Row = Record<string, unknown>;

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

/** 'HH:MM:SS' desde el tipo time de Postgres (puede venir 'HH:MM:SS' o con fracción). */
const toClock = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 8) : undefined);

function toItem(row: Row): RundownItem {
  return {
    id:           row.id as string,
    order:        row.order_num as number,
    type:         row.type as RundownItem['type'],
    noteId:       (row.note_id as string) ?? undefined,
    noteTitle:    (row.note_title as string) ?? undefined,
    presenterId:  (row.presenter_id as string) ?? undefined,
    presenter:    (row.presenter as string) ?? undefined,
    durationSecs: (row.duration_secs as number) ?? 60,
    notes:        (row.notes as string) ?? undefined,
    status:       row.status as RundownItemStatus,
  };
}

function toRundown(row: Row): Rundown {
  const items = ((row.rundown_items as Row[]) ?? []).map(toItem).sort((a, b) => a.order - b.order);
  return {
    id:                  row.id as string,
    title:               row.title as string,
    date:                row.air_date as string,
    channel:             (row.channel as string) ?? '',
    airTime:             toClock(row.air_time),
    plannedDurationSecs: (row.planned_duration_secs as number) ?? 1800,
    status:              row.status as Rundown['status'],
    archivedAt:          (row.archived_at as string) ?? undefined,
    archivedBy:          (row.archived_by as string) ?? undefined,
    items,
  };
}

function toSummary(row: Row): RundownSummary {
  return {
    id:         row.id as string,
    title:      row.title as string,
    date:       row.air_date as string,
    channel:    (row.channel as string) ?? '',
    status:     row.status as RundownSummary['status'],
    archivedAt: (row.archived_at as string) ?? undefined,
  };
}

/** Activos y archivados, más recientes primero. */
export async function fetchRundownSummaries(): Promise<RundownSummary[]> {
  const { data, error } = await client()
    .from('rundowns')
    .select('id, title, air_date, channel, status, archived_at')
    .order('air_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toSummary);
}

export async function fetchRundown(id: string): Promise<Rundown | null> {
  const { data, error } = await client()
    .from('rundowns')
    .select('*, rundown_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toRundown(data as Row) : null;
}

/** Rundown activo más reciente, o null si no hay ninguno. */
export async function fetchActiveRundown(): Promise<Rundown | null> {
  const { data, error } = await client()
    .from('rundowns')
    .select('*, rundown_items(*)')
    .eq('status', 'activo')
    .order('air_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRundown(data as Row) : null;
}

export interface RundownInput {
  title: string;
  channel: string;
  date: string;
  airTime?: string;
  plannedDurationSecs: number;
}

function toRundownRow(input: Partial<RundownInput>): Row {
  const row: Row = {};
  if (input.title !== undefined)               row.title = input.title.trim();
  if (input.channel !== undefined)             row.channel = input.channel.trim();
  if (input.date !== undefined)                row.air_date = input.date;
  if (input.airTime !== undefined)             row.air_time = input.airTime || null;
  if (input.plannedDurationSecs !== undefined) row.planned_duration_secs = input.plannedDurationSecs;
  return row;
}

export async function createRundown(input: RundownInput): Promise<string> {
  const { data, error } = await client()
    .from('rundowns')
    .insert({ ...toRundownRow(input), status: 'activo' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function updateRundownRow(id: string, row: Row): Promise<void> {
  const { data, error } = await client().from('rundowns').update(row).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para modificar este rundown.');
}

export const updateRundown = (id: string, changes: Partial<RundownInput>) =>
  updateRundownRow(id, toRundownRow(changes));

export const archiveRundown = (id: string) => updateRundownRow(id, { status: 'archivado' });

export const reactivateRundown = (id: string) => updateRundownRow(id, { status: 'activo' });

export interface SegmentInput {
  order: number;
  type: RundownItem['type'];
  noteId?: string;
  presenterId?: string;
  durationSecs: number;
  notes?: string;
}

export async function insertSegment(rundownId: string, input: SegmentInput): Promise<RundownItem> {
  const { data, error } = await client()
    .from('rundown_items')
    .insert({
      rundown_id:    rundownId,
      order_num:     input.order,
      type:          input.type,
      note_id:       input.type === 'nota' ? input.noteId ?? null : null,
      presenter_id:  input.presenterId || null,
      duration_secs: input.durationSecs,
      notes:         input.notes?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return toItem(data);
}

export interface SegmentChanges {
  durationSecs?: number;
  presenterId?: string | null;
  notes?: string;
}

export async function updateSegment(id: string, changes: SegmentChanges): Promise<RundownItem> {
  const row: Row = {};
  if (changes.durationSecs !== undefined) row.duration_secs = changes.durationSecs;
  if (changes.presenterId !== undefined)  row.presenter_id = changes.presenterId || null;
  if (changes.notes !== undefined)        row.notes = changes.notes.trim() || null;
  const { data, error } = await client().from('rundown_items').update(row).eq('id', id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para editar este segmento.');
  return toItem(data[0]);
}

export async function setRundownItemStatus(id: string, status: RundownItemStatus): Promise<void> {
  const { data, error } = await client().from('rundown_items').update({ status }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar este segmento.');
}

export async function deleteRundownItem(id: string): Promise<void> {
  const { data, error } = await client().from('rundown_items').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para quitar este segmento.');
}

export async function reorderRundown(rundownId: string, itemIds: string[]): Promise<void> {
  const { error } = await client().rpc('reorder_rundown', { p_rundown_id: rundownId, p_item_ids: itemIds });
  if (error) throw error;
}

export async function fetchPresenters(): Promise<User[]> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'presentador')
    .order('full_name');
  if (error) throw error;
  return ((data ?? []) as { id: string; full_name: string }[])
    .map((r) => ({ id: r.id, name: r.full_name, role: 'presentador' as const }));
}
