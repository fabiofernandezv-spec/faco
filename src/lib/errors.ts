export class ConflictError extends Error {
  constructor(message = 'La nota fue modificada por otra persona. Recarga para ver la última versión.') {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Mensaje legible para mostrar al usuario a partir de cualquier error. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return 'Ocurrió un error inesperado.';
}
