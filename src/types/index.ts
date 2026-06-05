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
  url: string;
  size: number;
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
  presenter?: string;
  durationSecs: number;
  startTime?: string;
  notes?: string;
  status: 'pendiente' | 'al_aire' | 'emitido';
}

export interface Rundown {
  id: string;
  title: string;
  date: string;
  channel: string;
  items: RundownItem[];
  totalDurationSecs: number;
  status: 'borrador' | 'activo' | 'archivado';
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
