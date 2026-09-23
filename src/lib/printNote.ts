import type { Note } from '../types';
import { escapeHtml, sanitizeHtml } from './sanitize';

const CAT_LABELS: Record<string, string> = {
  nacional: 'Nacional', internacional: 'Internacional', economia: 'Economía',
  deportes: 'Deportes', cultura: 'Cultura', tecnologia: 'Tecnología',
  salud: 'Salud', entretenimiento: 'Entretenimiento',
};

/**
 * HTML imprimible de una nota. Todo el texto se escapa y el cuerpo se sanea;
 * además la CSP del documento bloquea cualquier script.
 */
export function buildPrintHtml(note: Note): string {
  const e = escapeHtml;
  const dur = note.durationSecs ?? 60;
  const meta = [
    CAT_LABELS[note.category] ?? note.category,
    `Autor: ${note.authorName}`,
    note.approvedBy ? `Aprobado por: ${note.approvedBy}` : '',
    new Date(note.updatedAt).toLocaleDateString('es', { dateStyle: 'long' }),
    note.forTv ? `TV · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')} min` : '',
  ].filter(Boolean).map((m) => `<span>${e(m)}</span>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"/>
  <title>${e(note.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; padding: 0 20px; }
    .header { border-bottom: 3px solid #4361ee; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { font-size: 11px; font-family: sans-serif; color: #6b7280; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    h1 { font-size: 26px; line-height: 1.25; margin-bottom: 10px; }
    .meta { font-size: 12px; font-family: sans-serif; color: #9ca3af; display: flex; gap: 12px; flex-wrap: wrap; }
    .lead { font-size: 16px; color: #374151; font-style: italic; line-height: 1.6; border-left: 3px solid #4361ee; padding-left: 14px; margin: 20px 0; white-space: pre-line; }
    .body { font-size: 14px; }
    .body h2, .body h3 { font-size: 16px; margin: 20px 0 6px; }
    .body p { margin-bottom: 12px; }
    .body ul, .body ol { padding-left: 20px; margin-bottom: 12px; }
    .body blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; font-style: italic; margin: 12px 0; }
    .tags { margin-top: 24px; font-size: 12px; font-family: sans-serif; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; font-family: sans-serif; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print { body { margin: 20px auto; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Mesa Central · somoseffe</div>
    <h1>${e(note.title)}</h1>
    <div class="meta">${meta}</div>
  </div>
  ${note.lead ? `<div class="lead">${e(note.lead)}</div>` : ''}
  <div class="body">${sanitizeHtml(note.body)}</div>
  ${note.tags.length > 0 ? `<div class="tags">Etiquetas: ${note.tags.map((t) => '#' + e(t)).join(' · ')}</div>` : ''}
  <div class="footer">
    <span>Mesa Central — somoseffe</span>
    <span>Estado: ${e(note.status)}</span>
  </div>
</body>
</html>`;
}
