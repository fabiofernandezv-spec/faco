import { supabase } from './supabase';
import type { Rundown, RundownItem, RundownItemStatus } from '../types';

type Row = Record<string, unknown>;

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

function toItem(row: Row): RundownItem {
  return {
    id:           row.id as string,
    order:        row.order_num as number,
    type:         row.type as RundownItem['type'],
    noteId:       (row.note_id as string) ?? undefined,
    noteTitle:    (row.note_title as string) ?? undefined,
    presenter:    (row.presenter as string) ?? undefined,
    durationSecs: (row.duration_secs as number) ?? 60,
    startTime:    (row.start_time as string) ?? undefined,
    notes:        (row.notes as string) ?? undefined,
    status:       row.status as RundownItemStatus,
  };
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
  if (!data) return null;
  const items = ((data.rundown_items as Row[]) ?? []).map(toItem).sort((a, b) => a.order - b.order);
  return {
    id:      data.id,
    title:   data.title,
    date:    data.air_date,
    channel: data.channel,
    status:  data.status,
    items,
  };
}

export async function createRundown(input: { title: string; channel: string; date: string }): Promise<void> {
  const { error } = await client()
    .from('rundowns')
    .insert({ title: input.title.trim(), channel: input.channel.trim(), air_date: input.date, status: 'activo' });
  if (error) throw error;
}

export async function insertRundownItem(
  rundownId: string,
  item: Omit<RundownItem, 'id' | 'status'>,
): Promise<RundownItem> {
  const { data, error } = await client()
    .from('rundown_items')
    .insert({
      rundown_id:    rundownId,
      order_num:     item.order,
      type:          item.type,
      note_id:       item.noteId ?? null,
      presenter:     item.presenter ?? null,
      duration_secs: item.durationSecs,
      start_time:    item.startTime ?? null,
      notes:         item.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toItem(data);
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
