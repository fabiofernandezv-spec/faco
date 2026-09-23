import { describe, expect, it } from 'vitest';
import { escapeHtml, htmlToPlainText, normalizeBody, plainTextToHtml, sanitizeHtml } from '../sanitize';
import { buildPrintHtml } from '../printNote';
import { MOCK_NOTES } from '../../data/mockData';

describe('sanitizeHtml', () => {
  it('elimina scripts y manejadores de eventos', () => {
    const out = sanitizeHtml('<p onclick="x()">hola</p><img src=x onerror=alert(1)><script>alert(1)</script>');
    expect(out).toBe('<p>hola</p>');
  });

  it('elimina enlaces javascript: e iframes pero conserva el texto', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">clic</a><iframe src="//evil"></iframe>');
    expect(out).toBe('clic');
  });

  it('conserva el formato permitido', () => {
    const html = '<h2>T</h2><p><strong>a</strong> <em>b</em> <u>c</u></p><ul><li>x</li></ul><blockquote><p>q</p></blockquote><hr>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres especiales', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});

describe('texto plano ↔ HTML', () => {
  it('convierte párrafos y escapa', () => {
    expect(plainTextToHtml('uno\n\n<dos>\ntres')).toBe('<p>uno</p><p>&lt;dos&gt;<br>tres</p>');
  });

  it('normalizeBody trata texto plano como texto, no como HTML', () => {
    expect(normalizeBody('a < b')).toBe('<p>a &lt; b</p>');
    expect(normalizeBody('<p>x</p><script>1</script>')).toBe('<p>x</p>');
  });

  it('htmlToPlainText devuelve texto legible', () => {
    expect(htmlToPlainText('<p>Hola &amp; adiós</p><p>Dos</p>')).toBe('Hola & adiós\n\nDos');
  });
});

describe('buildPrintHtml', () => {
  it('escapa título, lead y autor, sanea el cuerpo e incluye CSP', () => {
    const html = buildPrintHtml({
      ...MOCK_NOTES[0],
      title: '<img src=x onerror=alert(1)>',
      lead: '</div><script>alert(1)</script>',
      authorName: '<b>x</b>',
      body: '<p>ok</p><img src=x onerror=alert(2)>',
    });
    expect(html).not.toMatch(/<script>alert|<img src=x|<b>x<\/b>/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<div class="body"><p>ok</p></div>');
  });
});
