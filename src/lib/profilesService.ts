import { supabase } from './supabase';
import { throwAuth } from './authErrors';
import { validateDisplayName, validatePassword } from './accountValidation';
import type { User, UserRole } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

type Row = { id: string; full_name: string; role: UserRole };

const toUser = (r: Row): User => ({ id: r.id, name: r.full_name, role: r.role });

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toUser(data as Row) : null;
}

export async function fetchProfiles(): Promise<User[]> {
  const { data, error } = await client().from('profiles').select('id, full_name, role').order('full_name');
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toUser);
}

export async function updateProfileRole(userId: string, role: UserRole): Promise<void> {
  const { data, error } = await client().from('profiles').update({ role }).eq('id', userId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar este rol.');
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  const { error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

// ── Cuenta y contraseña (specs/002-cuenta-contrasena) ─────────

export const RESET_PATH = '/restablecer';

/**
 * Pide el enlace de recuperación. No distingue si el correo existe: el
 * llamador muestra siempre el mismo mensaje; solo fallan red y límites.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Escribe tu correo.');
  const { error } = await client().auth.resetPasswordForEmail(normalized, {
    redirectTo: `${window.location.origin}${RESET_PATH}`,
  });
  if (error) throwAuth(error);
}

/** Fija la contraseña nueva usando la sesión de recuperación del enlace. */
export async function completePasswordReset(password: string, confirm: string): Promise<void> {
  const invalid = validatePassword(password, confirm);
  if (invalid) throw new Error(invalid);
  const { error } = await client().auth.updateUser({ password });
  if (error) throwAuth(error);
}

/**
 * Cambia la contraseña verificando antes la actual y cierra las demás
 * sesiones (la actual sigue abierta).
 */
export async function changePassword(email: string, current: string, next: string, confirm: string): Promise<void> {
  const invalid = validatePassword(next, confirm);
  if (invalid) throw new Error(invalid);
  if (next === current) throw new Error('La contraseña nueva debe ser distinta de la actual.');
  const sb = client();
  const verify = await sb.auth.signInWithPassword({ email, password: current });
  if (verify.error) throwAuth(Object.assign(verify.error, { code: 'invalid_credentials' }));
  const update = await sb.auth.updateUser({ password: next });
  if (update.error) throwAuth(update.error);
  const { error } = await sb.auth.signOut({ scope: 'others' });
  if (error) throwAuth(error);
}

export async function updateOwnName(userId: string, name: string): Promise<User> {
  const invalid = validateDisplayName(name);
  if (invalid) throw new Error(invalid);
  const { data, error } = await client()
    .from('profiles')
    .update({ full_name: name.trim() })
    .eq('id', userId)
    .select('id, full_name, role');
  if (error) {
    if (error.code === '23514') throw new Error('El nombre debe tener entre 1 y 120 caracteres.');
    throw error;
  }
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar este nombre.');
  return toUser(data[0] as Row);
}

export async function getAccountEmail(): Promise<string | null> {
  const { data, error } = await client().auth.getUser();
  if (error) return null;
  return data.user?.email ?? null;
}
