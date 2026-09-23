import { createClient } from '@supabase/supabase-js';
import { linkErrorInUrl } from './authErrors';

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Capturado antes de crear el cliente: supabase-js procesa (y limpia) el
// fragmento de la URL al inicializarse.
export const initialLinkError = typeof window !== 'undefined' && linkErrorInUrl(window.location);

export const supabase = url && key ? createClient(url, key) : null;
export const supabaseEnabled = Boolean(supabase);
