import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export function ErrorBanner() {
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  if (!error) return null;
  return (
    <div role="alert" className="fixed bottom-4 right-4 z-[60] max-w-md bg-red-50 border border-red-200 text-red-800 rounded-xl shadow-lg p-4 flex gap-3">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
      <p className="text-sm whitespace-pre-line flex-1">{error}</p>
      <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Cerrar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
