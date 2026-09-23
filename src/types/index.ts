export type UserRole = 'redactor' | 'editor' | 'director' | 'presentador';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export type NoteStatus =
  | 'borrador'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada'
  | 'publicada';

export type NoteCategory =
  | 'nacional'
  | 'internacional'
  | 'economia'
  | 'deportes'
  | 'cultura'
  | 'tecnologia'
  | 'salud'
  | 'entretenimiento';

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  /** URL para mostrar (firmada y temporal cuando viene de Supabase Storage). */
  url: string;
  storagePath?: string;
  mimeType?: string;
  size: number;
  uploadedById?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Note {
  id: string;
  title: string;
  lead: string;
  body: string;
  category: NoteCategory;
  status: NoteStatus;
  authorId: string;
  authorName: string;
  assignedEditorId?: string;
  assignedEditorName?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  media: MediaItem[];
  tags: string[];
  durationSecs?: number;
  forTv: boolean;
}

export type RundownItemType = 'nota' | 'pausa_comercial' | 'cortina' | 'apertura' | 'cierre';

export interface RundownItem {
  id: string;
  order: number;
  type: RundownItemType;
  noteId?: string;
  noteTitle?: string;
  presenterId?: string;
  presenter?: string;
  durationSecs: number;
  /** Obsoleto: la hora de inicio se calcula (ver lib/rundownTiming). */
  startTime?: string;
  notes?: string;
  status: RundownItemStatus;
}

export type RundownItemStatus = 'pendiente' | 'al_aire' | 'emitido';

export interface Rundown {
  id: string;
  title: string;
  date: string;
  channel: string;
  /** Hora de salida al aire, HH:MM:SS. */
  airTime?: string;
  plannedDurationSecs: number;
  items: RundownItem[];
  status: RundownStatus;
  archivedAt?: string;
  archivedBy?: string;
}

export type RundownStatus = 'borrador' | 'activo' | 'archivado';

export interface RundownSummary {
  id: string;
  title: string;
  date: string;
  channel: string;
  status: RundownStatus;
  archivedAt?: string;
}

export interface ApprovalAction {
  id: string;
  noteId: string;
  noteTitle: string;
  action: 'aprobada' | 'rechazada';
  by: string;
  at: string;
  reason?: string;
}
