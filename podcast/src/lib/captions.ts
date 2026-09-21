import { WordTiming } from "../types.js";

/** Fallback cuando el proveedor de TTS no da timestamps por palabra. */
export function estimateWordTimings(text: string, durationSec: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalChars = words.reduce((sum, w) => sum + w.length, 0) || 1;
  let t = 0;
  return words.map((word) => {
    const share = (word.length / totalChars) * durationSec;
    const start = t;
    const end = t + share;
    t = end;
    return { word, start, end };
  });
}

function formatAssTime(seconds: number): string {
  const cs = Math.round(seconds * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

const WORDS_PER_LINE = 4;

/** Construye subtítulos estilo ASS agrupando palabras en líneas cortas. */
export function buildAssSubtitles(timings: WordTiming[], resolution = { w: 1080, h: 1920 }): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resolution.w}
PlayResY: ${resolution.h}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,66,&H00FFFFFF,&H000000FF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,3,2,2,60,60,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines: string[] = [];
  for (let i = 0; i < timings.length; i += WORDS_PER_LINE) {
    const chunk = timings.slice(i, i + WORDS_PER_LINE);
    if (!chunk.length) continue;
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => w.word).join(" ").replace(/\n/g, " ");
    lines.push(`Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${text}`);
  }

  return header + lines.join("\n") + "\n";
}
