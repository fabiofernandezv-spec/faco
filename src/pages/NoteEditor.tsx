import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Send, Trash2, Tv2, Tag, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import type { NoteCategory } from '../types';

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: 'nacional',       label: 'Nacional' },
  { value: 'internacional',  label: 'Internacional' },
  { value: 'economia',       label: 'Economía' },
  { value: 'deportes',       label: 'Deportes' },
  { value: 'cultura',        label: 'Cultura' },
  { value: 'tecnologia',     label: 'Tecnología' },
  { value: 'salud',          label: 'Salud' },
  { value: 'entretenimiento',label: 'Entretenimiento' },
];

export function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notes, currentUser, addNote, updateNote, deleteNote, submitForReview } = useStore();

  const isNew = id === 'nueva';
  const existing = isNew ? null : notes.find((n) => n.id === id);

  const [title,    setTitle]    = useState(existing?.title    ?? '');
  const [lead,     setLead]     = useState(existing?.lead     ?? '');
  const [body,     setBody]     = useState(existing?.body     ?? '');
  const [category, setCategory] = useState<NoteCategory>(existing?.category ?? 'nacional');
  const [forTv,    setForTv]    = useState(existing?.forTv    ?? false);
  const [duration, setDuration] = useState(existing?.durationSecs ?? 60);
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState<string[]>(existing?.tags ?? []);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    if (!isNew && !existing) navigate('/notas');
  }, [isNew, existing, navigate]);

  const canEdit = isNew || existing?.status === 'borrador' || existing?.status === 'rechazada';
  const canSubmit = canEdit && (existing?.status === 'borrador' || existing?.status === 'rechazada' || isNew);

  function handleSave() {
    if (isNew) {
      addNote({
        title, lead, body, category, forTv,
        durationSecs: duration,
        status: 'borrador',
        authorId: currentUser.id,
        authorName: currentUser.name,
        media: [],
        tags,
      });
      navigate('/notas');
    } else if (existing) {
      updateNote(existing.id, { title, lead, body, category, forTv, durationSecs: duration, tags });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleSubmit() {
    if (isNew) {
      addNote({
        title, lead, body, category, forTv,
        durationSecs: duration,
        status: 'en_revision',
        authorId: currentUser.id,
        authorName: currentUser.name,
        media: [],
        tags,
      });
      navigate('/notas');
    } else if (existing) {
      updateNote(existing.id, { title, lead, body, category, forTv, durationSecs: duration, tags });
      submitForReview(existing.id);
      navigate('/notas');
    }
  }

  function handleDelete() {
    if (!existing) return;
    if (window.confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.')) {
      deleteNote(existing.id);
      navigate('/notas');
    }
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
      if (!tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/notas" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isNew ? 'Nueva nota' : 'Editar nota'}
          </h1>
          {existing && (
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={existing.status} />
              {existing.status === 'rechazada' && existing.rejectedReason && (
                <span className="text-xs text-red-600">
                  Motivo: {existing.rejectedReason}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {existing && (
            <button
              onClick={handleDelete}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saved ? 'Guardado' : 'Guardar'}
            </button>
          )}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              Enviar a revisión
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="col-span-2 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="Título de la nota"
              className="w-full px-4 py-3 text-lg font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lead / Entradilla</label>
            <textarea
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="Resumen de un párrafo que resume la noticia..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cuerpo de la nota *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!canEdit}
              rows={14}
              placeholder="Desarrolla el contenido completo de la nota..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 resize-y font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Category */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Clasificación</h3>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NoteCategory)}
              disabled={!canEdit}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* TV options */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Televisión</h3>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={forTv}
                onChange={(e) => setForTv(e.target.checked)}
                disabled={!canEdit}
                className="rounded border-gray-300 text-brand-500"
              />
              <Tv2 className="h-4 w-4 text-brand-500" />
              <span className="text-sm text-gray-700">Incluir en rundown TV</span>
            </label>
            {forTv && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duración en pantalla (seg)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={!canEdit}
                  min={10}
                  max={600}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ≈ {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')} min
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-1 mb-3">
              <Tag className="h-3 w-3 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</h3>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                  {t}
                  {canEdit && (
                    <button onClick={() => setTags(tags.filter((x) => x !== t))}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Etiqueta + Enter"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Meta */}
          {existing && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
              <p>Autor: <span className="text-gray-700">{existing.authorName}</span></p>
              {existing.assignedEditorName && (
                <p>Editor: <span className="text-gray-700">{existing.assignedEditorName}</span></p>
              )}
              <p>Creado: <span className="text-gray-700">{new Date(existing.createdAt).toLocaleString('es')}</span></p>
              <p>Editado: <span className="text-gray-700">{new Date(existing.updatedAt).toLocaleString('es')}</span></p>
              {existing.approvedBy && (
                <p>Aprobado por: <span className="text-gray-700">{existing.approvedBy}</span></p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
