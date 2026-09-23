import { supabase } from './supabase';
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
