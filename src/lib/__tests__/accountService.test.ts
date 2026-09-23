import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
};
const profilesQuery = { update: vi.fn(), eq: vi.fn(), select: vi.fn() };

vi.mock('../supabase', () => ({
  supabase: { auth, from: () => profilesQuery },
  supabaseEnabled: true,
}));

const svc = await import('../profilesService');

const ok = { data: {}, error: null };
const fail = (code: string) => ({ data: {}, error: Object.assign(new Error(code), { code }) });

beforeEach(() => {
  vi.clearAllMocks();
  profilesQuery.update.mockReturnValue(profilesQuery);
  profilesQuery.eq.mockReturnValue(profilesQuery);
});

describe('requestPasswordReset', () => {
  it('normaliza el correo y redirige a /restablecer', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(ok);
    await svc.requestPasswordReset('  Ana@Ejemplo.COM ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@ejemplo.com', {
      redirectTo: `${window.location.origin}/restablecer`,
    });
  });

  it('traduce el límite de envíos', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(fail('over_email_send_rate_limit'));
    await expect(svc.requestPasswordReset('a@b.com')).rejects.toThrow(/Demasiados intentos/);
  });

  it('rechaza un correo vacío sin llamar al servicio', async () => {
    await expect(svc.requestPasswordReset('   ')).rejects.toThrow(/correo/);
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('completePasswordReset', () => {
  it('valida y guarda la contraseña', async () => {
    auth.updateUser.mockResolvedValue(ok);
    await svc.completePasswordReset('nueva-segura-1', 'nueva-segura-1');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-segura-1' });
  });

  it('no llama al servicio si la contraseña es corta', async () => {
    await expect(svc.completePasswordReset('corta', 'corta')).rejects.toThrow(/al menos 10/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  it('verifica la actual, cambia y cierra las demás sesiones en ese orden', async () => {
    const order: string[] = [];
    auth.signInWithPassword.mockImplementation(async () => { order.push('verify'); return ok; });
    auth.updateUser.mockImplementation(async () => { order.push('update'); return ok; });
    auth.signOut.mockImplementation(async () => { order.push('others'); return { error: null }; });
    await svc.changePassword('ana@x.com', 'actual-123456', 'nueva-1234567', 'nueva-1234567');
    expect(order).toEqual(['verify', 'update', 'others']);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@x.com', password: 'actual-123456' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('contraseña actual incorrecta: no cambia nada', async () => {
    auth.signInWithPassword.mockResolvedValue(fail('invalid_credentials'));
    await expect(svc.changePassword('ana@x.com', 'mala-123456', 'nueva-1234567', 'nueva-1234567'))
      .rejects.toThrow('La contraseña actual no es correcta.');
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('nueva igual a la actual: rechaza sin llamadas', async () => {
    await expect(svc.changePassword('ana@x.com', 'misma-12345', 'misma-12345', 'misma-12345'))
      .rejects.toThrow('La contraseña nueva debe ser distinta de la actual.');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('confirmación distinta: rechaza sin llamadas', async () => {
    await expect(svc.changePassword('ana@x.com', 'actual-123456', 'nueva-1234567', 'otra-12345678'))
      .rejects.toThrow(/no coinciden/);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('updateOwnName', () => {
  it('guarda el nombre recortado', async () => {
    profilesQuery.select.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Ana García', role: 'redactor' }], error: null });
    const user = await svc.updateOwnName('u1', '  Ana García ');
    expect(profilesQuery.update).toHaveBeenCalledWith({ full_name: 'Ana García' });
    expect(profilesQuery.eq).toHaveBeenCalledWith('id', 'u1');
    expect(user).toEqual({ id: 'u1', name: 'Ana García', role: 'redactor' });
  });

  it('0 filas → sin permiso', async () => {
    profilesQuery.select.mockResolvedValue({ data: [], error: null });
    await expect(svc.updateOwnName('u1', 'Ana')).rejects.toThrow(/permiso/);
  });

  it('nombre vacío → error sin llamar', async () => {
    await expect(svc.updateOwnName('u1', '  ')).rejects.toThrow(/entre 1 y 120/);
    expect(profilesQuery.update).not.toHaveBeenCalled();
  });
});
