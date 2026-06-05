import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, Rundown, User, MediaItem, NoteStatus } from '../types';
import { MOCK_NOTES, MOCK_RUNDOWN, CURRENT_USER, MOCK_MEDIA } from '../data/mockData';

interface Store {
  currentUser: User;
  notes: Note[];
  rundown: Rundown;
  media: MediaItem[];

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, changes: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  submitForReview: (id: string) => void;
  approveNote: (id: string, editorName: string) => void;
  rejectNote: (id: string, editorName: string, reason: string) => void;

  updateRundownItem: (itemId: string, status: 'pendiente' | 'al_aire' | 'emitido') => void;
  reorderRundown: (items: Rundown['items']) => void;

  addMedia: (item: Omit<MediaItem, 'id'>) => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return new Date().toISOString();
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      currentUser: CURRENT_USER,
      notes: MOCK_NOTES,
      rundown: MOCK_RUNDOWN,
      media: MOCK_MEDIA,

      addNote: (note) =>
        set((s) => ({
          notes: [
            ...s.notes,
            { ...note, id: genId(), createdAt: now(), updatedAt: now() },
          ],
        })),

      updateNote: (id, changes) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: now() } : n
          ),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      submitForReview: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? { ...n, status: 'en_revision' as NoteStatus, updatedAt: now() }
              : n
          ),
        })),

      approveNote: (id, editorName) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  status: 'aprobada' as NoteStatus,
                  approvedAt: now(),
                  approvedBy: editorName,
                  rejectedReason: undefined,
                  updatedAt: now(),
                }
              : n
          ),
        })),

      rejectNote: (id, editorName, reason) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  status: 'rechazada' as NoteStatus,
                  rejectedReason: reason,
                  approvedBy: editorName,
                  updatedAt: now(),
                }
              : n
          ),
        })),

      updateRundownItem: (itemId, status) =>
        set((s) => ({
          rundown: {
            ...s.rundown,
            items: s.rundown.items.map((item) =>
              item.id === itemId ? { ...item, status } : item
            ),
          },
        })),

      reorderRundown: (items) =>
        set((s) => ({ rundown: { ...s.rundown, items } })),

      addMedia: (item) =>
        set((s) => ({
          media: [...s.media, { ...item, id: genId() }],
        })),
    }),
    { name: 'faco-store' }
  )
);
