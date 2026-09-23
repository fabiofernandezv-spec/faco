import { describe, expect, it } from 'vitest';
import { validateDisplayName, validatePassword } from '../accountValidation';

describe('validatePassword', () => {
  it('exige al menos 10 caracteres', () => {
    expect(validatePassword('123456789', '123456789')).toMatch(/al menos 10/);
    expect(validatePassword('1234567890', '1234567890')).toBeNull();
  });

  it('limita a 72 caracteres', () => {
    const long = 'x'.repeat(73);
    expect(validatePassword(long, long)).toMatch(/72 caracteres como máximo/);
  });

  it('exige que la confirmación coincida', () => {
    expect(validatePassword('1234567890', '1234567899')).toMatch(/no coinciden/);
  });
});

describe('validateDisplayName', () => {
  it('rechaza vacío o solo espacios', () => {
    expect(validateDisplayName('')).toMatch(/entre 1 y 120/);
    expect(validateDisplayName('   ')).toMatch(/entre 1 y 120/);
  });

  it('rechaza más de 120 caracteres tras recortar', () => {
    expect(validateDisplayName('x'.repeat(121))).toMatch(/entre 1 y 120/);
    expect(validateDisplayName(` ${'x'.repeat(120)} `)).toBeNull();
  });

  it('acepta nombres normales', () => {
    expect(validateDisplayName(' Ana García ')).toBeNull();
  });
});
