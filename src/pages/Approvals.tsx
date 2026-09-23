import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { useStore, useCurrentUser } from '../store/useStore';
import { canReviewNotes } from '../lib/permissions';
import { StatusBadge } from '../components/StatusBadge';

export function Approvals() {
  const currentUser = useCurrentUser();
  const { notes, approveNote, rejectNote } = useStore();
  const [rejectId,  setRejectId]  = useState<string | null>(null);
  const [rejectMsg, setRejectMsg] = useState('');

  const canApprove = canReviewNotes(currentUser);

  const pending  = notes.filter((n) => n.status === 'en_revision');
  const resolved = notes
    .filter((n) => n.status === 'aprobada' || n.status === 'rechazada')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);

  function handleApprove(id: string) {
    void approveNote(id);
  }

  function handleReject() {
    if (!rejectId || !rejectMsg.trim()) return;
    void rejectNote(rejectId, rejectMsg.trim()).then((ok) => {
      if (ok) { setRejectId(null); setRejectMsg(''); }
    });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Aprobaciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        {canApprove
          ? 'Revisa y aprueba o rechaza las notas enviadas por los redactores.'
          : 'Solo editores y directores pueden aprobar notas. Aquí puedes ver el estado de tus envíos.'}
      </p>

      {/* Pending */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-500" />
          Pendientes de revisión ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-300" />
            <p className="text-sm">No hay notas esperando revisión.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((note) => (
              <div key={note.id} className="bg-white rounded-xl border border-yellow-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{note.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{note.lead}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>Autor: {note.authorName}</span>
                      <span>·</span>
                      <span className="capitalize">{note.category}</span>
                      <span>·</span>
                      <span>{new Date(note.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to={`/notas/${note.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3" />
                      Ver
                    </Link>
                    {canApprove && (
                      <>
                        <button
                          onClick={() => { setRejectId(note.id); setRejectMsg(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                          <XCircle className="h-3 w-3" />
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleApprove(note.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Aprobar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Rechazar nota</h3>
            <p className="text-sm text-gray-500 mb-4">Indica el motivo del rechazo para que el redactor pueda corregirla.</p>
            <textarea
              value={rejectMsg}
              onChange={(e) => setRejectMsg(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Motivo del rechazo..."
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectMsg.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Historial reciente
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {resolved.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin historial.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Nota</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Autor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Por</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {resolved.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link to={`/notas/${note.id}`} className="font-medium text-gray-900 hover:text-brand-600 line-clamp-1">
                        {note.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{note.authorName}</td>
                    <td className="px-4 py-3"><StatusBadge status={note.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{(note.status === 'rechazada' ? note.rejectedBy : note.approvedBy) ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(note.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
