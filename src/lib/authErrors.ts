import { errorMessage } from './errors';

const MESSAGES: Record<string, string> = {
  invalid_credentials:        'La contraseña actual no es correcta.',
  same_password:              'La contraseña nueva debe ser distinta de la actual.',
  weak_password:              'La contraseña no cumple los requisitos de seguridad (mínimo 10 caracteres).',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit:    'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  otp_expired:                'El enlace no es válido o venció. Solicita uno nuevo.',
};

/** Traduce errores de Supabase Auth (por `code`) a mensajes en español. */
export function authErrorMessage(e: unknown): string {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  return MESSAGES[code] ?? errorMessage(e);
}

export class AuthMessageError extends Error {}

/** Lanza el error de Auth ya traducido. */
export function throwAuth(e: unknown): never {
  throw new AuthMessageError(authErrorMessage(e));
}

/** El proveedor informa los errores del enlace de recuperación en el fragmento o en la query. */
export function linkErrorInUrl(url: { hash: string; search: string }): boolean {
  const params = new URLSearchParams(`${url.search.replace(/^\?/, '')}&${url.hash.replace(/^#/, '')}`);
  return params.has('error') || params.has('error_code') || params.has('error_description');
}
