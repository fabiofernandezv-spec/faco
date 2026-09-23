import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MediaItem, Note, Rundown, RundownItemStatus, RundownSummary, User, UserRole } from '../types';
import { MOCK_MEDIA, MOCK_NOTES, MOCK_RUNDOWN, MOCK_USERS } from '../data/mockData';
import { supabase, supabaseEnabled, notesApi, rundownApi, mediaApi, profilesApi } from '../lib/db';
import type { NoteContent } from '../lib/notesService';
import type { RundownInput, SegmentChanges, SegmentInput } from '../lib/rundownService';
import { applySegmentStatus, validateRundownInput, validateSegment } from '../lib/rundownState';
import { parseClock } from '../lib/rundownTiming';
import { validateDisplayName } from '../lib/accountValidation';
import { RESET_PATH } from '../lib/profilesService';
import { errorMessage } from '../lib/errors';
import { sanitizeHtml, normalizeBody } from '../lib/sanitize';
import { transitionNote } from '../lib/noteWorkflow';
import {
  canCreateNote, canDeleteMedia, canDeleteNote, canEditNote, canManageRundown,
  canChangeSegmentStatus, canEditRundown, canManageUsers, canReviewNotes, canUploadMedia,
} from '../lib/permissions';

interface Store {
  demo: boolean;
  authReady: boolean;
  currentUser: User | null;
  /** Correo de la sesión (Supabase); null en demo. */
  accountEmail: string | null;
  /** Hay una sesión de recuperación de contraseña pendiente. */
  recovery: boolean;
  /** Modo con el que se abre el login (p. ej. tras un enlace vencido). */
  loginMode: 'login' | 'forgot';
  notes: Note[];
  /** Rundown seleccionado (con segmentos). */
  rundown: Rundown | null;
  /** Listado resumido: activos y archivados, más recientes primero. */
  rundowns: RundownSummary[];
  selectedRundownId: string | null;
  /** Modo demo: todos los rundowns locales. */
  demoRundowns: Rundown[];
  presenters: User[];
  media: MediaItem[];
  profiles: User[];
  error: string | null;

  init: () => Promise<void>;
  setError: (msg: string | null) => void;
  setDemoUser: (user: User) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  completePasswordReset: (password: string, confirm: string) => Promise<boolean>;
  /** Sale de la recuperación; con `requestNew` el login se abre en "recuperar contraseña". */
  cancelRecovery: (requestNew?: boolean) => void;
  changePassword: (current: string, next: string, confirm: string) => Promise<boolean>;
  updateOwnName: (name: string) => Promise<boolean>;

  refreshNotes: () => Promise<void>;
  refreshRundown: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  refreshPresenters: () => Promise<void>;
  selectRundown: (id: string | null) => Promise<void>;
  refreshProfiles: () => Promise<void>;

  /** Crea (id = null) o guarda una nota; `submit` la envía a revisión en la misma operación. */
  saveNote: (id: string | null, content: NoteContent, submit: boolean) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  approveNote: (id: string) => Promise<boolean>;
  rejectNote: (id: string, reason: string) => Promise<boolean>;

  createRundown: (input: RundownInput) => Promise<boolean>;
  updateRundown: (changes: Partial<RundownInput>) => Promise<boolean>;
  archiveRundown: () => Promise<boolean>;
  reactivateRundown: () => Promise<boolean>;
  addSegment: (input: Omit<SegmentInput, 'order'>) => Promise<boolean>;
  updateSegment: (itemId: string, changes: SegmentChanges) => Promise<boolean>;
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

      const summarize = (r: Rundown): RundownSummary => ({
        id: r.id, title: r.title, date: r.date, channel: r.channel, status: r.status, archivedAt: r.archivedAt,
      });

      const sortSummaries = (list: RundownSummary[]) =>
        [...list].sort((a, b) => b.date.localeCompare(a.date));

      /** Rundown seleccionado editable por el usuario actual (o error). */
      function editableRundown(): Rundown {
        const rundown = get().rundown;
        if (!rundown) throw new Error('No hay un rundown seleccionado.');
        if (rundown.status === 'archivado') {
          throw new Error('El rundown está archivado: es de solo lectura (reactívalo para editarlo).');
        }
        assert(canEditRundown(requireUser(), rundown));
        return rundown;
      }

      /** Modo demo: guarda el rundown en la lista local y lo deja seleccionado. */
      function commitDemo(r: Rundown) {
        const demoRundowns = [r, ...get().demoRundowns.filter((x) => x.id !== r.id)];
        set({
          demoRundowns,
          rundowns: sortSummaries(demoRundowns.map(summarize)),
          rundown: r,
          selectedRundownId: r.id,
        });
      }

      function pickDefault(list: RundownSummary[], preferred: string | null): string | null {
        if (preferred && list.some((r) => r.id === preferred)) return preferred;
        return list.find((r) => r.status === 'activo')?.id ?? null;
      }

      async function loadSession(userId: string | null) {
        if (!userId) {
          set({ currentUser: null, accountEmail: null, notes: [], rundown: null, rundowns: [], media: [], profiles: [], presenters: [] });
          unsubscribeRealtime();
          return;
        }
        const profile = await profilesApi.fetchProfile(userId);
        if (!profile) throw new Error('Tu usuario no tiene perfil. Contacta a un director.');
        set({ currentUser: profile, accountEmail: await profilesApi.getAccountEmail() });
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
        accountEmail: null,
        loginMode: 'login',
        recovery: supabaseEnabled && typeof window !== 'undefined' && window.location.pathname === RESET_PATH,
        notes:   supabaseEnabled ? [] : MOCK_NOTES,
        rundown: supabaseEnabled ? null : MOCK_RUNDOWN,
        rundowns: supabaseEnabled ? [] : [summarize(MOCK_RUNDOWN)],
        selectedRundownId: supabaseEnabled ? null : MOCK_RUNDOWN.id,
        demoRundowns: supabaseEnabled ? [] : [MOCK_RUNDOWN],
        presenters: supabaseEnabled ? [] : MOCK_USERS.filter((u) => u.role === 'presentador'),
        media:   supabaseEnabled ? [] : MOCK_MEDIA,
        profiles: supabaseEnabled ? [] : MOCK_USERS,
        error: null,

        init: async () => {
          if (initialized) return;
          initialized = true;
          try {
            localStorage.removeItem('mesa-central-store');
            localStorage.removeItem('mesa-central-demo-v2');
          } catch { /* sin storage */ }
          if (!supabase) {
            set({ authReady: true, notes: get().notes.map((n) => ({ ...n, body: normalizeBody(n.body) })) });
            return;
          }
          // Suscribirse antes de leer la sesión para no perder PASSWORD_RECOVERY.
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
              const uid = session?.user.id ?? null;
              if (uid === get().currentUser?.id && event !== 'USER_UPDATED') return;
              // Diferido: no llamar a Supabase dentro del callback de auth.
              setTimeout(() => void run(() => loadSession(uid)), 0);
            }
          });
          const { data } = await supabase.auth.getSession();
          await run(() => loadSession(data.session?.user.id ?? null));
          set({ authReady: true });
        },

        setError: (msg) => set({ error: msg }),

        setDemoUser: (user) => {
          if (!get().demo) return;
          set({ currentUser: user });
        },

        signIn: (email, password) => run(() => profilesApi.signIn(email, password)),
        signUp: (email, password, fullName) => run(() => profilesApi.signUp(email, password, fullName)),
        requestPasswordReset: (email) => run(() => profilesApi.requestPasswordReset(email)),

        completePasswordReset: (password, confirm) => run(async () => {
          await profilesApi.completePasswordReset(password, confirm);
          set({ recovery: false });
          const { data } = await supabase!.auth.getSession();
          await loadSession(data.session?.user.id ?? null);
        }),

        cancelRecovery: (requestNew = false) => set({ recovery: false, loginMode: requestNew ? 'forgot' : 'login' }),

        changePassword: (current, next, confirm) => run(async () => {
          if (get().demo) throw new Error('En modo demo la contraseña no se gestiona: usa una cuenta real.');
          const email = get().accountEmail;
          if (!email) throw new Error('No se pudo obtener el correo de tu cuenta. Vuelve a iniciar sesión.');
          await profilesApi.changePassword(email, current, next, confirm);
        }),

        updateOwnName: (name) => run(async () => {
          const user = requireUser();
          const invalid = validateDisplayName(name);
          if (invalid) throw new Error(invalid);
          const updated = get().demo
            ? { ...user, name: name.trim() }
            : await profilesApi.updateOwnName(user.id, name);
          set((s) => ({
            currentUser: updated,
            profiles: s.profiles.map((p) => (p.id === updated.id ? updated : p)),
            presenters: s.presenters.map((p) => (p.id === updated.id ? updated : p)),
          }));
        }),

        signOut: async () => {
          await run(() => profilesApi.signOut());
        },

        refreshNotes: async () => {
          if (get().demo) return;
          await run(async () => set({ notes: await notesApi.fetchNotes() }));
        },
        refreshRundown: async () => {
          if (get().demo) {
            const list = sortSummaries(get().demoRundowns.map(summarize));
            const id = pickDefault(list, get().selectedRundownId);
            set({ rundowns: list, selectedRundownId: id, rundown: get().demoRundowns.find((r) => r.id === id) ?? null });
            return;
          }
          await run(async () => {
            const list = await rundownApi.fetchRundownSummaries();
            const id = pickDefault(list, get().selectedRundownId);
            set({ rundowns: list, selectedRundownId: id, rundown: id ? await rundownApi.fetchRundown(id) : null });
          });
        },
        refreshPresenters: async () => {
          if (get().demo) {
            set({ presenters: get().profiles.filter((u) => u.role === 'presentador') });
            return;
          }
          await run(async () => set({ presenters: await rundownApi.fetchPresenters() }));
        },
        selectRundown: async (id) => {
          if (id === get().selectedRundownId && get().rundown?.id === id) return;
          if (get().demo) {
            set({ selectedRundownId: id, rundown: get().demoRundowns.find((r) => r.id === id) ?? null });
            return;
          }
          await run(async () => {
            const rundown = id ? await rundownApi.fetchRundown(id) : null;
            if (id && !rundown) throw new Error('El rundown no existe.');
            set({ selectedRundownId: id, rundown });
          });
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
          const invalid = validateRundownInput(input, parseClock);
          if (invalid) throw new Error(invalid);
          if (get().demo) {
            commitDemo({
              id: genId(), title: input.title.trim(), channel: input.channel.trim(), date: input.date,
              airTime: input.airTime || undefined, plannedDurationSecs: input.plannedDurationSecs,
              status: 'activo', items: [],
            });
            return;
          }
          const id = await rundownApi.createRundown(input);
          set({ selectedRundownId: id });
          await get().refreshRundown();
        }),

        updateRundown: (changes) => run(async () => {
          const rundown = editableRundown();
          const invalid = validateRundownInput(changes, parseClock);
          if (invalid) throw new Error(invalid);
          if (get().demo) {
            commitDemo({
              ...rundown,
              ...(changes.title !== undefined && { title: changes.title.trim() }),
              ...(changes.channel !== undefined && { channel: changes.channel.trim() }),
              ...(changes.date !== undefined && { date: changes.date }),
              ...(changes.airTime !== undefined && { airTime: changes.airTime || undefined }),
              ...(changes.plannedDurationSecs !== undefined && { plannedDurationSecs: changes.plannedDurationSecs }),
            });
            return;
          }
          await rundownApi.updateRundown(rundown.id, changes);
          await get().refreshRundown();
        }),

        archiveRundown: () => run(async () => {
          const user = requireUser();
          const rundown = get().rundown;
          if (!rundown || rundown.status === 'archivado') return;
          assert(canManageRundown(user));
          if (get().demo) {
            commitDemo({ ...rundown, status: 'archivado', archivedAt: now(), archivedBy: user.name });
            return;
          }
          await rundownApi.archiveRundown(rundown.id);
          await get().refreshRundown();
        }),

        reactivateRundown: () => run(async () => {
          const rundown = get().rundown;
          if (!rundown || rundown.status !== 'archivado') return;
          assert(canManageRundown(requireUser()));
          if (get().demo) {
            commitDemo({ ...rundown, status: 'activo', archivedAt: undefined, archivedBy: undefined });
            return;
          }
          await rundownApi.reactivateRundown(rundown.id);
          await get().refreshRundown();
        }),

        addSegment: (input) => run(async () => {
          const rundown = editableRundown();
          const invalid = validateSegment(input);
          if (invalid) throw new Error(invalid);
          const base: SegmentInput = { ...input, order: rundown.items.length + 1 };
          let item;
          if (input.type === 'nota') {
            const note = get().notes.find((n) => n.id === input.noteId);
            if (!note || !note.forTv || (note.status !== 'aprobada' && note.status !== 'publicada')) {
              throw new Error('Solo se pueden agregar notas aprobadas y marcadas para TV.');
            }
            if (rundown.items.some((i) => i.noteId === note.id)) throw new Error('La nota ya está en el rundown.');
            if (get().demo) {
              item = { ...base, id: genId(), status: 'pendiente' as const, noteTitle: note.title };
            }
          } else if (get().demo) {
            item = { ...base, id: genId(), status: 'pendiente' as const, noteId: undefined };
          }
          if (get().demo && item) {
            const presenter = get().presenters.find((p) => p.id === input.presenterId);
            if (input.presenterId && !presenter) throw new Error('El presentador asignado no tiene rol de presentador.');
            item = { ...item, presenter: presenter?.name, notes: input.notes?.trim() || undefined };
          } else {
            item = await rundownApi.insertSegment(rundown.id, base);
          }
          const next = { ...rundown, items: [...rundown.items, item] };
          if (get().demo) commitDemo(next); else set({ rundown: next });
        }),

        updateSegment: (itemId, changes) => run(async () => {
          const rundown = editableRundown();
          const invalid = validateSegment({ durationSecs: changes.durationSecs, notes: changes.notes });
          if (invalid) throw new Error(invalid);
          let updated;
          if (get().demo) {
            const current = rundown.items.find((i) => i.id === itemId);
            if (!current) throw new Error('El segmento no existe.');
            updated = { ...current };
            if (changes.durationSecs !== undefined) updated.durationSecs = changes.durationSecs;
            if (changes.notes !== undefined) updated.notes = changes.notes.trim() || undefined;
            if (changes.presenterId !== undefined) {
              const presenter = get().presenters.find((p) => p.id === changes.presenterId);
              if (changes.presenterId && !presenter) throw new Error('El presentador asignado no tiene rol de presentador.');
              updated.presenterId = presenter?.id;
              updated.presenter = presenter?.name;
            }
          } else {
            updated = await rundownApi.updateSegment(itemId, changes);
          }
          const next = { ...rundown, items: rundown.items.map((i) => (i.id === itemId ? updated : i)) };
          if (get().demo) commitDemo(next); else set({ rundown: next });
        }),

        addRundownItem: (note) => get().addSegment({
          type: 'nota', noteId: note.id, durationSecs: note.durationSecs ?? 60,
        }),

        setRundownItemStatus: (itemId, status) => run(async () => {
          const rundown = get().rundown;
          if (!rundown) return;
          if (rundown.status === 'archivado') {
            throw new Error('El rundown está archivado: es de solo lectura (reactívalo para editarlo).');
          }
          assert(canChangeSegmentStatus(requireUser(), rundown));
          const next = { ...rundown, items: applySegmentStatus(rundown.items, itemId, status) };
          if (get().demo) { commitDemo(next); return; }
          await rundownApi.setRundownItemStatus(itemId, status);
          set({ rundown: next });
        }),

        moveRundownItem: (index, dir) => run(async () => {
          const rundown = editableRundown();
          const items = [...rundown.items];
          const swap = index + dir;
          if (swap < 0 || swap >= items.length) return;
          [items[index], items[swap]] = [items[swap], items[index]];
          const reordered = items.map((item, i) => ({ ...item, order: i + 1 }));
          const next = { ...rundown, items: reordered };
          if (get().demo) { commitDemo(next); return; }
          await rundownApi.reorderRundown(rundown.id, reordered.map((i) => i.id));
          set({ rundown: next });
        }),

        removeRundownItem: (itemId) => run(async () => {
          const rundown = editableRundown();
          if (rundown.items.find((i) => i.id === itemId)?.status === 'al_aire') {
            throw new Error('No se puede quitar el segmento que está al aire.');
          }
          const items = rundown.items
            .filter((i) => i.id !== itemId)
            .map((item, idx) => ({ ...item, order: idx + 1 }));
          const next = { ...rundown, items };
          if (get().demo) { commitDemo(next); return; }
          await rundownApi.deleteRundownItem(itemId);
          await rundownApi.reorderRundown(rundown.id, items.map((i) => i.id));
          set({ rundown: next });
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
      name: 'mesa-central-demo-v3',
      storage: createJSONStorage(() => localStorage),
      // Solo el modo demo guarda datos en el navegador. Con Supabase la fuente
      // de verdad es la base y la sesión la gestiona supabase-js.
      partialize: (s) =>
        s.demo
          ? {
              currentUser: s.currentUser,
              profiles: s.profiles,
              notes: s.notes,
              rundown: s.rundown,
              demoRundowns: s.demoRundowns,
              selectedRundownId: s.selectedRundownId,
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
