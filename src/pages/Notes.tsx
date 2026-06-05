import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Tv2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import type { NoteStatus, NoteCategory } from '../types';

const STATUSES: { value: '' | NoteStatus; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'borrador',    label: 'Borrador' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'aprobada',    label: 'Aprobada' },
  { value: 'rechazada',   label: 'Rechazada' },
  { value: 'publicada',   label: 'Publicada' },
];

const CATEGORIES: { value: '' | NoteCategory; label: string }[] = [
  { value: '', label: 'Todas las categorías' },
  { value: 'nacional',       label: 'Nacional' },
  { value: 'internacional',  label: 'Internacional' },
  { value: 'economia',       label: 'Economía' },
  { value: 'deportes',       label: 'Deportes' },
  { value: 'cultura',        label: 'Cultura' },
  { value: 'tecnologia',     label: 'Tecnología' },
  { value: 'salud',          label: 'Salud' },
  { value: 'entretenimiento',label: 'Entretenimiento' },
];

export function Notes() {
  const { notes } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | NoteStatus>('');
  const [catFilter, setCatFilter] = useState<'' | NoteCategory>('');

  const filtered = notes.filter((n) => {
    const matchSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.authorName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || n.status === statusFilter;
    const matchCat    = !catFilter    || n.category === catFilter;
    return matchSearch && matchStatus && matchCat;
  });

  const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{notes.length} notas en total</p>
        </div>
        <Link
          to="/notas/nueva"
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | NoteStatus)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as '' | NoteCategory)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-sm">No se encontraron notas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Autor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actualizado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">TV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/notas/${note.id}`} className="font-medium text-gray-900 hover:text-brand-600 line-clamp-1">
                      {note.title}
                    </Link>
                    {note.lead && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{note.lead}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{note.category}</td>
                  <td className="px-4 py-3 text-gray-600">{note.authorName}</td>
                  <td className="px-4 py-3"><StatusBadge status={note.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(note.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {note.forTv && <Tv2 className="h-4 w-4 text-brand-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
