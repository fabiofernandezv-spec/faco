// Validaciones de cuenta compartidas por formularios y servicios.
export const PASSWORD_MIN = 10;
/** Límite de bcrypt: más allá de 72 bytes la contraseña se trunca. */
export const PASSWORD_MAX = 72;
export const NAME_MAX = 120;

export function validatePassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) {
    return `La contraseña debe tener ${PASSWORD_MAX} caracteres como máximo.`;
  }
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const n = name.trim();
  if (n.length < 1 || n.length > NAME_MAX) return `El nombre debe tener entre 1 y ${NAME_MAX} caracteres.`;
  return null;
}
