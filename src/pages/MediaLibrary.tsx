import { useState, useRef } from 'react';
import { ImageIcon, Film, Music, Upload, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { MediaItem } from '../types';

const TYPE_ICONS: Record<MediaItem['type'], React.FC<{ className?: string }>> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
};

function fmtSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

export function MediaLibrary() {
  const { media, addMedia, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'' | MediaItem['type']>('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = media.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchType   = !filter || m.type === filter;
    return matchSearch && matchType;
  });

  function handleFiles(files: FileList) {
    Array.from(files).forEach((file) => {
      const type: MediaItem['type'] =
        file.type.startsWith('video') ? 'video' :
        file.type.startsWith('audio') ? 'audio' : 'image';

      const url = URL.createObjectURL(file);
      addMedia({
        name: file.name,
        type,
        url,
        size: file.size,
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
      });
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Medios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{media.length} archivos · imágenes, video y audio</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Subir archivo
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl py-8 text-center cursor-pointer mb-6 transition-colors ${
          dragging
            ? 'border-brand-400 bg-brand-50'
            : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
        }`}
      >
        <Upload className={`h-8 w-8 mx-auto mb-2 ${dragging ? 'text-brand-500' : 'text-gray-300'}`} />
        <p className="text-sm text-gray-500">
          {dragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Imágenes, videos y audios</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2">
          {(['', 'image', 'video', 'audio'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                filter === t
                  ? 'bg-brand-500 text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === '' ? 'Todos' : t === 'image' ? 'Imágenes' : t === 'video' ? 'Videos' : 'Audio'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No se encontraron archivos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                {/* Preview */}
                <div className="h-36 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {item.type === 'image' && item.url !== '#' ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Icon className="h-10 w-10 text-gray-300" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                    item.type === 'image' ? 'bg-blue-500' :
                    item.type === 'video' ? 'bg-purple-500' : 'bg-green-500'
                  }`}>
                    <Icon className="h-3 w-3" />
                    {item.type}
                  </span>
                </div>
                {/* Info */}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-gray-900 truncate" title={item.name}>{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtSize(item.size)}</p>
                  <p className="text-xs text-gray-400">{item.uploadedBy}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
