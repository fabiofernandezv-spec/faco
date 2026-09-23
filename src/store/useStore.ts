import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MediaItem, Note, Rundown, RundownItemStatus, User, UserRole } from '../types';
import { MOCK_MEDIA, MOCK_NOTES, MOCK_RUNDOWN, MOCK_USERS } from '../data/mockData';
import { supabase, supabaseEnabled, notesApi, rundownApi, mediaApi, profilesApi } from '../lib/db';
import type { NoteContent } from '../lib/notesService';
import { errorMessage } from '../lib/errors';
import { sanitizeHtml, normalizeBody } from '../lib/sanitize';
import { transitionNote } from '../lib/noteWorkflow';
import {
  canCreateNote, canDeleteMedia, canDeleteNote, canEditNote, canManageRundown,
  canChangeRundownStatus, canManageUsers, canReviewNotes, canUploadMedia,
} from '../lib/permissions';

interface Store {
  demo: boolean;
  authReady: boolean;
  currentUser: User | null;
  notes: Note[];
  rundown: Rundown | null;
  media: MediaItem[];
  profiles: User[];
  error: string | null;

  init: () => Promise<void>;
  setError: (msg: string | null) => void;
  setDemoUser: (user: User) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  signOut: () => Promise<void>;

  refreshNotes: () => Promise<void>;
  refreshRundown: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  refreshProfiles: () => Promise<void>;

  /** Crea (id = null) o guarda una nota; `submit` la envía a revisión en la misma operación. */
  saveNote: (id: string | null, content: NoteContent, submit: boolean) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  approveNote: (id: string) => Promise<boolean>;
  rejectNote: (id: string, reason: string) => Promise<boolean>;

  createRundown: (input: { title: string; channel: string; date: string }) => Promise<boolean>;
  addRundownItem: (note: Note) => Promise<boolean>;
  setRundownItemStatus: (itemId: string, status: RundownItemStatus) => Promise<boolean>;
  moveRundownItem: (index: number, dir: -1 | 1) => Promise<boolean>;
  removeRundownItem: (itemId: string) => Promise<boolean>;

  uploadMedia: (files: File[]) => Promise<void>;
  deleteMedia: (item: MediaItem) => Promise<boolean>;

  setUserRole: (userId: string, role: UserRole) => Promise<boolean>;
}

const now = () => new Date().toISOString();
const genId = () => crypto.randomUUID();

const FORBIDDEN = 'No tienes permiso para realizar esta acción.';

let realtimeChannel: RealtimeChannel | null = null;
let initialized = false;

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Ejecuta una acción, muestra el error al usuario y devuelve si tuvo éxito. */
      async function run(fn: () => Promise<void> | void): Promise<boolean> {
        try {
          await fn();
          return true;
        } catch (e) {
          set({ error: errorMessage(e) });
          return false;
        }
      }

      function requireUser(): User {
        const u = get().currentUser;
        if (!u) throw new Error('Debes iniciar sesión.');
        return u;
      }

      function assert(allowed: boolean) {
        if (!allowed) throw new Error(FORBIDDEN);
      }

      function replaceNote(note: Note) {
        set((s) => ({ notes: s.notes.map((n) => (n.id === note.id ? note : n)) }));
      }

      function findNote(id: string): Note {
        const note = get().notes.find((n) => n.id === id);
        if (!note) throw new Error('La nota no existe.');
        return note;
      }

      async function loadSession(userId: string | null) {
        if (!userId) {
          set({ currentUser: null, notes: [], rundown: null, media: [], profiles: [] });
          unsubscribeRealtime();
          return;
        }
        const profile = await profilesApi.fetchProfile(userId);
        if (!profile) throw new Error('Tu usuario no tiene perfil. Contacta a un director.');
        set({ currentUser: profile });
        await Promise.all([get().refreshNotes(), get().refreshRundown(), get().refreshMedia()]);
        subscribeRealtime();
      }

      function subscribeRealtime() {
        if (!supabase || realtimeChannel) return;
        const timers: Record<string, ReturnType<typeof setTimeout>> = {};
        const debounced = (key: string, fn: () => Promise<void>) => {
          clearTimeout(timers[key]);
          timers[key] = setTimeout(() => void fn(), 300);
        };
        realtimeChannel = supabase
          .channel('mesa-central')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' },
            () => debounced('notes', get().refreshNotes))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rundowns' },
            () => debounced('rundown', get().refreshRundown))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rundown_items' },
            () => debounced('rundown', get().refreshRundown))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'media' },
            () => debounced('media', get().refreshMedia))
          .subscribe();
      }

      function unsubscribeRealtime() {
        if (supabase && realtimeChannel) void supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      return {
        demo: !supabaseEnabled,
        authReady: !supabaseEnabled,
        currentUser: supabaseEnabled ? null : MOCK_USERS[2],
        notes:   supabaseEnabled ? [] : MOCK_NOTES,
        rundown: supabaseEnabled ? null : MOCK_RUNDOWN,
        media:   supabaseEnabled ? [] : MOCK_MEDIA,
        profiles: supabaseEnabled ? [] : MOCK_USERS,
        error: null,

        init: async () => {
          if (initialized) return;
          initialized = true;
          try { localStorage.removeItem('mesa-central-store'); } catch { /* sin storage */ }
          if (!supabase) {
            set({ authReady: true, notes: get().notes.map((n) => ({ ...n, body: normalizeBody(n.body) })) });
            return;
          }
          const { data } = await supabase.auth.getSession();
          await run(() => loadSession(data.session?.user.id ?? null));
          set({ authReady: true });
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
              const uid = session?.user.id ?? null;
              if (uid === get().currentUser?.id && event !== 'USER_UPDATED') return;
              // Diferido: no llamar a Supabase dentro del callback de auth.
              setTimeout(() => void run(() => loadSession(uid)), 0);
            }
          });
        },

        setError: (msg) => set({ error: msg }),

        setDemoUser: (user) => {
          if (!get().demo) return;
          set({ currentUser: user });
        },

        signIn: (email, password) => run(() => profilesApi.signIn(email, password)),
        signUp: (email, password, fullName) => run(() => profilesApi.signUp(email, password, fullName)),
        signOut: async () => {
          await run(() => profilesApi.signOut());
        },

        refreshNotes: async () => {
          if (get().demo) return;
          await run(async () => set({ notes: await notesApi.fetchNotes() }));
        },
        refreshRundown: async () => {
          if (get().demo) return;
          await run(async () => set({ rundown: await rundownApi.fetchActiveRundown() }));
        },
        refreshMedia: async () => {
          if (get().demo) return;
          await run(async () => set({ media: await mediaApi.fetchMedia() }));
        },
        refreshProfiles: async () => {
          if (get().demo) return;
          await run(async () => set({ profiles: await profilesApi.fetchProfiles() }));
        },

        saveNote: async (id, content, submit) => {
          let result: Note | null = null;
          const ok = await run(async () => {
            const user = requireUser();
            const clean: NoteContent = { ...content, title: content.title.trim(), body: sanitizeHtml(content.body) };
            if (!clean.title) throw new Error('El título es obligatorio.');

            if (id === null) {
              assert(canCreateNote(user));
              const status = submit ? 'en_revision' : 'borrador';
              if (get().demo) {
                result = {
                  ...clean, id: genId(), status, authorId: user.id, authorName: user.name,
                  media: [], createdAt: now(), updatedAt: now(),
                };
              } else {
                result = await notesApi.createNote(clean, status);
              }
              set((s) => ({ notes: [result as Note, ...s.notes] }));
              return;
            }

            const existing = findNote(id);
            assert(canEditNote(user, existing));
            if (get().demo) {
              let next: Note = { ...existing, ...clean, updatedAt: now() };
              if (submit) next = transitionNote(next, 'en_revision', user);
              result = next;
            } else {
              const patch = notesApi.toContentPatch(clean);
              if (submit) patch.status = 'en_revision';
              result = await notesApi.updateNote(id, existing.updatedAt, patch);
            }
            replaceNote(result);
          });
          return ok ? result : null;
        },

        deleteNote: (id) => run(async () => {
          const user = requireUser();
          const note = findNote(id);
          assert(canDeleteNote(user, note));
          if (!get().demo) await notesApi.deleteNote(id);
          set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
        }),

        approveNote: (id) => run(async () => {
          const user = requireUser();
          assert(canReviewNotes(user));
          const note = findNote(id);
          replaceNote(get().demo
            ? transitionNote(note, 'aprobada', user)
            : await notesApi.updateNote(id, note.updatedAt, { status: 'aprobada' }));
        }),

        rejectNote: (id, reason) => run(async () => {
          const user = requireUser();
          assert(canReviewNotes(user));
          const note = findNote(id);
          const r = reason.trim();
          if (!r) throw new Error('El rechazo requiere un motivo.');
          replaceNote(get().demo
            ? transitionNote(note, 'rechazada', user, r)
            : await notesApi.updateNote(id, note.updatedAt, { status: 'rechazada', rejected_reason: r }));
        }),

        createRundown: (input) => run(async () => {
          assert(canManageRundown(requireUser()));
          if (!input.title.trim()) throw new Error('El título es obligatorio.');
          if (get().demo) {
            set({ rundown: { id: genId(), title: input.title.trim(), channel: input.channel.trim(), date: input.date, status: 'activo', items: [] } });
            return;
          }
          await rundownApi.createRundown(input);
          await get().refreshRundown();
        }),

        addRundownItem: (note) => run(async () => {
          assert(canManageRundown(requireUser()));
          const rundown = get().rundown;
          if (!rundown) throw new Error('No hay un rundown activo.');
          if (!note.forTv || (note.status !== 'aprobada' && note.status !== 'publicada')) {
            throw new Error('Solo se pueden agregar notas aprobadas y marcadas para TV.');
          }
          if (rundown.items.some((i) => i.noteId === note.id)) return;
          const base = {
            order: rundown.items.length + 1,
            type: 'nota' as const,
            noteId: note.id,
            noteTitle: note.title,
            durationSecs: note.durationSecs ?? 60,
          };
          const item = get().demo
            ? { ...base, id: genId(), status: 'pendiente' as const }
            : await rundownApi.insertRundownItem(rundown.id, base);
          set((s) => (s.rundown ? { rundown: { ...s.rundown, items: [...s.rundown.items, item] } } : {}));
        }),

        setRundownItemStatus: (itemId, status) => run(async () => {
          assert(canChangeRundownStatus(requireUser()));
          if (!get().demo) await rundownApi.setRundownItemStatus(itemId, status);
          set((s) => (s.rundown ? {
            rundown: { ...s.rundown, items: s.rundown.items.map((i) => (i.id === itemId ? { ...i, status } : i)) },
          } : {}));
        }),

        moveRundownItem: (index, dir) => run(async () => {
          assert(canManageRundown(requireUser()));
          const rundown = get().rundown;
          if (!rundown) return;
          const items = [...rundown.items];
          const swap = index + dir;
          if (swap < 0 || swap >= items.length) return;
          [items[index], items[swap]] = [items[swap], items[index]];
          const reordered = items.map((item, i) => ({ ...item, order: i + 1 }));
          if (!get().demo) await rundownApi.reorderRundown(rundown.id, reordered.map((i) => i.id));
          set({ rundown: { ...rundown, items: reordered } });
        }),

        removeRundownItem: (itemId) => run(async () => {
          assert(canManageRundown(requireUser()));
          const rundown = get().rundown;
          if (!rundown) return;
          const items = rundown.items
            .filter((i) => i.id !== itemId)
            .map((item, idx) => ({ ...item, order: idx + 1 }));
          if (!get().demo) {
            await rundownApi.deleteRundownItem(itemId);
            await rundownApi.reorderRundown(rundown.id, items.map((i) => i.id));
          }
          set({ rundown: { ...rundown, items } });
        }),

        uploadMedia: async (files) => {
          const user = get().currentUser;
          if (!user || !canUploadMedia(user)) {
            set({ error: FORBIDDEN });
            return;
          }
          const errors: string[] = [];
          for (const file of files) {
            const invalid = mediaApi.validateMediaFile(file);
            if (invalid) { errors.push(invalid); continue; }
            try {
              if (get().demo) {
                const item: MediaItem = {
                  id: genId(), name: file.name, type: mediaApi.mediaTypeOf(file.type),
                  url: URL.createObjectURL(file), mimeType: file.type, size: file.size,
                  uploadedById: user.id, uploadedBy: user.name, uploadedAt: now(),
                };
                set((s) => ({ media: [item, ...s.media] }));
              } else {
                await mediaApi.uploadMedia(file, user.id);
              }
            } catch (e) {
              errors.push(`${file.name}: ${errorMessage(e)}`);
            }
          }
          if (!get().demo) await get().refreshMedia();
          if (errors.length) set({ error: errors.join('\n') });
        },

        deleteMedia: (item) => run(async () => {
          assert(canDeleteMedia(requireUser(), item));
          if (get().demo) {
            if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
          } else {
            await mediaApi.deleteMedia(item);
          }
          set((s) => ({ media: s.media.filter((m) => m.id !== item.id) }));
        }),

        setUserRole: (userId, role) => run(async () => {
          assert(canManageUsers(requireUser()));
          if (userId === get().currentUser?.id) throw new Error('No puedes cambiar tu propio rol.');
          if (!get().demo) await profilesApi.updateProfileRole(userId, role);
          set((s) => ({ profiles: s.profiles.map((p) => (p.id === userId ? { ...p, role } : p)) }));
        }),
      };
    },
    {
      name: 'mesa-central-demo-v2',
      storage: createJSONStorage(() => localStorage),
      // Solo el modo demo guarda datos en el navegador. Con Supabase la fuente
      // de verdad es la base y la sesión la gestiona supabase-js.
      partialize: (s) =>
        s.demo
          ? {
              currentUser: s.currentUser,
              notes: s.notes,
              rundown: s.rundown,
              // Las URLs blob: no sobreviven a una recarga.
              media: s.media.filter((m) => !m.url.startsWith('blob:')),
            }
          : {},
    }
  )
);

/** Usuario actual dentro de rutas protegidas (AuthGate garantiza que existe). */
export function useCurrentUser(): User {
  const user = useStore((s) => s.currentUser);
  if (!user) throw new Error('useCurrentUser fuera de una ruta autenticada');
  return user;
}
