import { supabase } from './supabase';
import type { MediaItem } from '../types';

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

// Debe coincidir con allowed_mime_types del bucket en supabase/schema.sql.
export const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac',
];

const BUCKET = 'media';
const SIGNED_URL_TTL_SECS = 60 * 60;

type Row = Record<string, unknown>;

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

export function mediaTypeOf(mime: string): MediaItem['type'] {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}

/** Devuelve un mensaje de error si el archivo no es válido, o null. */
export function validateMediaFile(file: { type: string; size: number; name: string }): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return `Tipo de archivo no permitido: ${file.name}`;
  if (file.size > MAX_MEDIA_BYTES) return `El archivo supera 100 MB: ${file.name}`;
  if (file.size === 0) return `El archivo está vacío: ${file.name}`;
  return null;
}

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(-100);
  return cleaned || 'archivo';
}

export async function fetchMedia(): Promise<MediaItem[]> {
  const sb = client();
  const { data, error } = await sb.from('media').select('*').order('uploaded_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const paths = rows.map((r) => r.storage_path as string);
  const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECS);
  if (signError) throw signError;
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((r) => ({
    id:           r.id as string,
    name:         r.name as string,
    type:         r.type as MediaItem['type'],
    url:          urlByPath.get(r.storage_path as string) ?? '',
    storagePath:  r.storage_path as string,
    mimeType:     r.mime_type as string,
    size:         Number(r.size ?? 0),
    uploadedById: r.uploaded_by as string,
    uploadedBy:   (r.uploaded_by_name as string) ?? '',
    uploadedAt:   r.uploaded_at as string,
  }));
}

export async function uploadMedia(file: File, userId: string): Promise<void> {
  const invalid = validateMediaFile(file);
  if (invalid) throw new Error(invalid);

  const sb = client();
  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: upError } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upError) throw upError;

  const { error } = await sb.from('media').insert({
    name:         file.name.slice(0, 255),
    type:         mediaTypeOf(file.type),
    storage_path: path,
    mime_type:    file.type,
    size:         file.size,
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function deleteMedia(item: MediaItem): Promise<void> {
  const sb = client();
  const { data, error } = await sb.from('media').delete().eq('id', item.id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para eliminar este archivo.');
  if (item.storagePath) {
    const { error: rmError } = await sb.storage.from(BUCKET).remove([item.storagePath]);
    if (rmError) throw rmError;
  }
}
