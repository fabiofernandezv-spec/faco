import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Play, Pause, RotateCcw, Plus, Minus, ChevronDown } from 'lucide-react';

export function Teleprompter() {
  const { notes, rundown } = useStore();

  const tvNotes = notes.filter((n) => n.forTv && (n.status === 'aprobada' || n.status === 'publicada'));

  const [selectedNoteId, setSelectedNoteId] = useState<string>(tvNotes[0]?.id ?? '');
  const [speed,  setSpeed]  = useState(40);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [fontSize, setFontSize] = useState(36);
  const [mirror, setMirror] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);
  const lastTs    = useRef<number>(0);
  const scrollVal = useRef(0);

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const alAireId = rundown.items.find((i) => i.status === 'al_aire')?.noteId;

  // Auto-select note that's al_aire
  useEffect(() => {
    if (alAireId && notes.find((n) => n.id === alAireId)) {
      setSelectedNoteId(alAireId);
    }
  }, [alAireId, notes]);

  // Scroll animation
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    function step(ts: number) {
      if (!lastTs.current) lastTs.current = ts;
      const dt = ts - lastTs.current;
      lastTs.current = ts;
      scrollVal.current += (speed / 1000) * dt;
      setScrollY(scrollVal.current);
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, speed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollY;
    }
  }, [scrollY]);

  function reset() {
    setIsPlaying(false);
    scrollVal.current = 0;
    lastTs.current    = 0;
    setScrollY(0);
  }

  const text = selectedNote
    ? `${selectedNote.title}\n\n${selectedNote.lead ? selectedNote.lead + '\n\n' : ''}${selectedNote.body}`
    : 'Selecciona una nota aprobada para el teleprompter.';

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50' : 'p-8 max-w-5xl mx-auto'}`}>
      {!fullscreen && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Teleprompter</h1>
          <p className="text-sm text-gray-500 mb-6">Control de texto para presentadores en cámara.</p>
        </>
      )}

      <div className={`${fullscreen ? 'h-full' : 'rounded-2xl overflow-hidden'} bg-black flex flex-col`}>
        {/* Controls bar */}
        {!fullscreen && (
          <div className="bg-gray-900 px-6 py-4 flex flex-wrap items-center gap-4">
            {/* Note selector */}
            <div className="relative flex-1 min-w-48">
              <select
                value={selectedNoteId}
                onChange={(e) => { setSelectedNoteId(e.target.value); reset(); }}
                className="w-full appearance-none bg-gray-800 text-white text-sm rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Seleccionar nota —</option>
                {tvNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id === alAireId ? '🔴 ' : ''}{n.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Speed */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 whitespace-nowrap">Velocidad</span>
              <button onClick={() => setSpeed(Math.max(5, speed - 5))} className="p-1 rounded text-gray-400 hover:text-white">
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm text-white font-mono w-8 text-center">{speed}</span>
              <button onClick={() => setSpeed(Math.min(200, speed + 5))} className="p-1 rounded text-gray-400 hover:text-white">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Font size */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Tamaño</span>
              <button onClick={() => setFontSize(Math.max(18, fontSize - 4))} className="p-1 rounded text-gray-400 hover:text-white">
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm text-white font-mono w-8 text-center">{fontSize}</span>
              <button onClick={() => setFontSize(Math.min(80, fontSize + 4))} className="p-1 rounded text-gray-400 hover:text-white">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Mirror */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mirror}
                onChange={(e) => setMirror(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-gray-400">Espejo</span>
            </label>

            {/* Play controls */}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={reset} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isPlaying
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="px-3 py-2 rounded-lg bg-gray-800 text-xs text-gray-400 hover:text-white"
              >
                Pantalla completa
              </button>
            </div>
          </div>
        )}

        {/* Text display */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden select-none px-16 py-8"
          style={{
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        >
          {/* Red center line */}
          <div
            className="sticky top-1/3 h-0.5 bg-red-500/60 pointer-events-none z-10 -mx-16"
          />
          <div style={{ paddingTop: fullscreen ? '40vh' : '30vh', paddingBottom: '60vh' }}>
            <pre
              className="text-white font-bold leading-relaxed whitespace-pre-wrap text-center"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
            >
              {text}
            </pre>
          </div>
        </div>

        {/* Fullscreen exit */}
        {fullscreen && (
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${isPlaying ? 'bg-red-600' : 'bg-green-600'} text-white`}
            >
              {isPlaying ? 'Pausar' : 'Iniciar'}
            </button>
            <button onClick={() => { setFullscreen(false); setIsPlaying(false); }} className="px-3 py-2 bg-gray-800 text-white text-xs rounded-lg">
              Salir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
