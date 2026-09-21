export interface SourceConfig {
  id: string;
  name: string;
  homepage: string;
  /** Feeds a intentar en orden. El primero que responda con RSS/Atom válido se usa. */
  feedCandidates: string[];
  kind: "medio" | "gobierno";
  /** true si la URL de feedCandidates fue confirmada manualmente */
  verified: boolean;
}

export interface NewsItem {
  sourceId: string;
  sourceName: string;
  title: string;
  link: string;
  publishedAt: Date | null;
  /** Resumen/copete corto tal como lo publica el feed (no el cuerpo completo de la nota) */
  snippet: string;
}

export interface RankedStory {
  headline: string;
  items: NewsItem[];
  score: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
  /** Marca de tiempo por palabra, si el proveedor la da (ElevenLabs sí, OpenAI no) */
  wordTimings: WordTiming[] | null;
  durationSec: number;
}

export interface EpisodeScript {
  date: string;
  mainScript: string;
  shorts: { title: string; script: string; sourceLinks: string[] }[];
  citedSources: { name: string; link: string }[];
}
