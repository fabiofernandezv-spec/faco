import DOMPurify from 'dompurify';

// Solo el formato que produce el editor. Todo lo demás (scripts, atributos
// on*, iframes, estilos, enlaces javascript:) se descarta.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr',
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convierte texto plano (párrafos separados por línea en blanco) a HTML seguro. */
export function plainTextToHtml(text: string): string {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Las notas antiguas guardaban texto plano; las nuevas, HTML del editor. */
export function normalizeBody(body: string): string {
  const b = body ?? '';
  return /<[a-z][\s\S]*>/i.test(b) ? sanitizeHtml(b) : plainTextToHtml(b);
}

/** Texto plano para teleprompter, conteos y validaciones. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(
    sanitizeHtml(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|blockquote)>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n'),
    'text/html',
  );
  return (doc.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
