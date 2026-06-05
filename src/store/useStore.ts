import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, Rundown, User, MediaItem, NoteStatus } from '../types';
import { MOCK_NOTES, MOCK_RUNDOWN, CURRENT_USER, MOCK_MEDIA } from '../data/mockData';
import { supabaseEnabled, fetchNotes, createNote, updateNoteById, deleteNoteById } from '../lib/db';

interface Store {
  currentUser: User;
  notes: Note[];
  rundown: Rundown;
  media: MediaItem[];
  synced: boolean;

  setCurrentUser: (user: User) => void;
  syncFromSupabase: () => Promise<void>;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, changes: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  submitForReview: (id: string) => Promise<void>;
  approveNote: (id: string, editorName: string) => Promise<void>;
  rejectNote: (id: string, editorName: string, reason: string) => Promise<void>;

  updateRundownItem: (itemId: string, status: 'pendiente' | 'al_aire' | 'emitido') => void;
  reorderRundown: (items: Rundown['items']) => void;
  addRundownItem: (note: Note) => void;
  removeRundownItem: (itemId: string) => void;

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
      notes:   MOCK_NOTES,
      rundown: MOCK_RUNDOWN,
      media:   MOCK_MEDIA,
      synced:  false,

      setCurrentUser: (user) => set({ currentUser: user }),

      syncFromSupabase: async () => {
        if (!supabaseEnabled) return;
        try {
          const notes = await fetchNotes();
          set({ notes, synced: true });
        } catch (e) {
          console.error('Supabase sync failed:', e);
        }
      },

      addNote: async (note) => {
        if (supabaseEnabled) {
          const created = await createNote(note);
          set((s) => ({ notes: [created, ...s.notes] }));
        } else {
          set((s) => ({
            notes: [{ ...note, id: genId(), createdAt: now(), updatedAt: now() }, ...s.notes],
          }));
        }
      },

      updateNote: async (id, changes) => {
        if (supabaseEnabled) {
          await updateNoteById(id, changes);
        }
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: now() } : n
          ),
        }));
      },

      deleteNote: async (id) => {
        if (supabaseEnabled) {
          await deleteNoteById(id);
        }
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      },

      submitForReview: async (id) => {
        const changes = { status: 'en_revision' as NoteStatus };
        if (supabaseEnabled) await updateNoteById(id, changes);
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: now() } : n
          ),
        }));
      },

      approveNote: async (id, editorName) => {
        const changes = {
          status: 'aprobada' as NoteStatus,
          approvedAt: now(),
          approvedBy: editorName,
          rejectedReason: undefined,
        };
        if (supabaseEnabled) await updateNoteById(id, changes);
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: now() } : n
          ),
        }));
      },

      rejectNote: async (id, editorName, reason) => {
        const changes = {
          status: 'rechazada' as NoteStatus,
          rejectedReason: reason,
          approvedBy: editorName,
        };
        if (supabaseEnabled) await updateNoteById(id, changes);
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: now() } : n
          ),
        }));
      },

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

      addRundownItem: (note) =>
        set((s) => {
          const items = s.rundown.items;
          const newItem = {
            id: genId(),
            order: items.length + 1,
            type: 'nota' as const,
            noteId: note.id,
            noteTitle: note.title,
            durationSecs: note.durationSecs ?? 60,
            status: 'pendiente' as const,
          };
          return { rundown: { ...s.rundown, items: [...items, newItem] } };
        }),

      removeRundownItem: (itemId) =>
        set((s) => ({
          rundown: {
            ...s.rundown,
            items: s.rundown.items
              .filter((i) => i.id !== itemId)
              .map((item, idx) => ({ ...item, order: idx + 1 })),
          },
        })),

      addMedia: (item) =>
        set((s) => ({
          media: [...s.media, { ...item, id: genId() }],
        })),
    }),
    { name: 'mesa-central-store' }
  )
);
