import { writeFile } from "node:fs/promises";
import path from "node:path";
import { WordTiming } from "../types.js";
import { buildAssSubtitles } from "./captions.js";
import { runFfmpeg } from "./ffmpegUtil.js";

export interface BuildVideoOptions {
  audioPath: string;
  wordTimings: WordTiming[];
  durationSec: number;
  brandLabel: string;
  outPath: string;
}

/** Escapa una ruta para usarla dentro del filtro `subtitles=` de ffmpeg. */
function escapeForFilter(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function buildShortVideo(opts: BuildVideoOptions): Promise<void> {
  const assPath = opts.outPath.replace(/\.mp4$/, ".ass");
  await writeFile(assPath, buildAssSubtitles(opts.wordTimings), "utf-8");

  const duration = Math.max(opts.durationSec + 0.4, 1);
  const assEscaped = escapeForFilter(path.resolve(assPath));
  const fontsDir = escapeForFilter("/usr/share/fonts/truetype/dejavu");

  const filterComplex = [
    "[1:a]showwaves=s=1000x260:mode=cline:rate=25:colors=#38BDF8[wave]",
    "[0:v][wave]overlay=x=(W-w)/2:y=H-520:format=auto[bg]",
    `[bg]drawtext=text='AgendaCR':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=58:x=(w-text_w)/2:y=130[branded]`,
    `[branded]subtitles='${assEscaped}':fontsdir='${fontsDir}'[vout]`,
  ].join(";");

  await runFfmpeg([
    "-f", "lavfi",
    "-i", `color=c=0x0B1220:s=1080x1920:d=${duration}`,
    "-i", opts.audioPath,
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-map", "1:a",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    opts.outPath,
  ]);
}

/** Video horizontal simple (portada estática + audio) para subir el episodio completo a YouTube. */
export async function buildAudioOnlyVideo(
  audioPath: string,
  durationSec: number,
  brandLabel: string,
  outPath: string,
): Promise<void> {
  const duration = Math.max(durationSec + 0.4, 1);
  await runFfmpeg([
    "-f", "lavfi",
    "-i", `color=c=0x0B1220:s=1920x1080:d=${duration}`,
    "-i", audioPath,
    "-vf",
    `drawtext=text='${brandLabel.replace(/'/g, "\\'")}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    outPath,
  ]);
}
