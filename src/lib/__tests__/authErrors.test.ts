import { describe, expect, it } from 'vitest';
import { authErrorMessage, linkErrorInUrl } from '../authErrors';

const err = (code: string, message = 'x') => Object.assign(new Error(message), { code });

describe('authErrorMessage', () => {
  it('traduce códigos conocidos', () => {
    expect(authErrorMessage(err('invalid_credentials'))).toBe('La contraseña actual no es correcta.');
    expect(authErrorMessage(err('same_password'))).toBe('La contraseña nueva debe ser distinta de la actual.');
    expect(authErrorMessage(err('weak_password'))).toMatch(/mínimo 10/);
    expect(authErrorMessage(err('over_email_send_rate_limit'))).toMatch(/Demasiados intentos/);
    expect(authErrorMessage(err('over_request_rate_limit'))).toMatch(/Demasiados intentos/);
    expect(authErrorMessage(err('otp_expired'))).toMatch(/no es válido o venció/);
  });

  it('usa el mensaje original para códigos desconocidos', () => {
    expect(authErrorMessage(err('otro', 'Fallo de red'))).toBe('Fallo de red');
    expect(authErrorMessage('raro')).toBe('Ocurrió un error inesperado.');
  });
});

describe('linkErrorInUrl', () => {
  it('detecta errores en el fragmento o la query', () => {
    expect(linkErrorInUrl({ hash: '#error=access_denied&error_code=otp_expired', search: '' })).toBe(true);
    expect(linkErrorInUrl({ hash: '', search: '?error_description=Email+link+is+invalid' })).toBe(true);
  });

  it('un enlace de recuperación válido no es error', () => {
    expect(linkErrorInUrl({ hash: '#access_token=abc&type=recovery', search: '' })).toBe(false);
    expect(linkErrorInUrl({ hash: '', search: '' })).toBe(false);
  });
});
