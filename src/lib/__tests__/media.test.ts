import { describe, expect, it } from 'vitest';
import { MAX_MEDIA_BYTES, mediaTypeOf, safeFileName, validateMediaFile } from '../mediaService';

describe('validación de medios', () => {
  it('rechaza tipos no permitidos, vacíos y demasiado grandes', () => {
    expect(validateMediaFile({ name: 'x.html', type: 'text/html', size: 10 })).toMatch(/no permitido/);
    expect(validateMediaFile({ name: 'x.svg', type: 'image/svg+xml', size: 10 })).toMatch(/no permitido/);
    expect(validateMediaFile({ name: 'x.jpg', type: 'image/jpeg', size: 0 })).toMatch(/vacío/);
    expect(validateMediaFile({ name: 'x.mp4', type: 'video/mp4', size: MAX_MEDIA_BYTES + 1 })).toMatch(/100 MB/);
    expect(validateMediaFile({ name: 'x.jpg', type: 'image/jpeg', size: 10 })).toBeNull();
  });

  it('limpia nombres de archivo', () => {
    expect(safeFileName('../../Año nuevo <script>.jpg')).toBe('Ano-nuevo-script-.jpg');
    expect(safeFileName('...')).toBe('archivo');
  });

  it('detecta el tipo', () => {
    expect(mediaTypeOf('audio/mpeg')).toBe('audio');
    expect(mediaTypeOf('video/mp4')).toBe('video');
    expect(mediaTypeOf('image/png')).toBe('image');
  });
});
