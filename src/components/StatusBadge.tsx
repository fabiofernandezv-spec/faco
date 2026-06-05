import clsx from 'clsx';
import type { NoteStatus } from '../types';

const CONFIG: Record<NoteStatus, { label: string; cls: string }> = {
  borrador:    { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
  en_revision: { label: 'En revisión', cls: 'bg-yellow-100 text-yellow-700' },
  aprobada:    { label: 'Aprobada',    cls: 'bg-green-100 text-green-700' },
  rechazada:   { label: 'Rechazada',   cls: 'bg-red-100 text-red-600' },
  publicada:   { label: 'Publicada',   cls: 'bg-brand-100 text-brand-700' },
};

export function StatusBadge({ status }: { status: NoteStatus }) {
  const { label, cls } = CONFIG[status];
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}
