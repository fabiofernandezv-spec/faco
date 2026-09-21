import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAllFeeds } from "./lib/fetchFeeds.js";
import { readNewsFromDb } from "./lib/readFromDb.js";
import { NewsItem } from "./types.js";
import { rankTopStories } from "./lib/rankNews.js";
import { generateEpisodeScript } from "./lib/generateScript.js";
import { synthesizeSpeech } from "./lib/tts.js";
import { estimateWordTimings } from "./lib/captions.js";
import { buildShortVideo, buildAudioOnlyVideo } from "./lib/buildVideo.js";
import { getAudioDurationSec } from "./lib/ffmpegUtil.js";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve("output", today);
  await mkdir(outDir, { recursive: true });

  const newsSource = process.env.NEWS_SOURCE || "rss"; // "rss" | "db"
  let items: NewsItem[];

  if (newsSource === "db") {
    console.log("1/5 · Leyendo noticias desde la base AGENDACR (articles_raw)...");
    const result = await readNewsFromDb();
    items = result.items;
    if (result.unmatchedCount) {
      console.warn(`   ${result.unmatchedCount} notas con dominio no reconocido (revisar SOURCES).`);
    }
  } else {
    console.log("1/5 · Recopilando titulares por RSS directo...");
    const { items: rssItems, failedSources } = await fetchAllFeeds();
    items = rssItems;
    if (failedSources.length) {
      console.warn(`   Sin feed disponible (revisar URL manualmente): ${failedSources.join(", ")}`);
    }
  }

  if (!items.length) {
    throw new Error(
      newsSource === "db"
        ? "articles_raw no devolvió notas para la ventana de tiempo configurada. Revisá que el " +
          "workflow de n8n siga corriendo y que las credenciales de Postgres sean correctas."
        : "No se obtuvo ninguna noticia de ninguna fuente. Revisá src/config/sources.ts: " +
          "las URLs de feed sin verificar pueden haber cambiado.",
    );
  }
  console.log(`   ${items.length} notas de ${new Set(items.map((i) => i.sourceId)).size} fuentes.`);

  console.log("2/5 · Rankeando las noticias más importantes...");
  const stories = rankTopStories(items, 10);
  await writeFile(path.join(outDir, "stories.json"), JSON.stringify(stories, null, 2));

  console.log("3/5 · Generando guion con Claude...");
  const script = await generateEpisodeScript(stories, today);
  await writeFile(path.join(outDir, "script.json"), JSON.stringify(script, null, 2));
  await writeFile(path.join(outDir, "script-principal.txt"), script.mainScript);

  console.log("4/5 · Generando audio (TTS)...");
  const mainAudio = await synthesizeSpeech(script.mainScript);
  const mainAudioPath = path.join(outDir, "episodio.mp3");
  await writeFile(mainAudioPath, mainAudio.audioBuffer);
  const mainDuration = mainAudio.durationSec || (await getAudioDurationSec(mainAudioPath));

  console.log("   Generando video de portada del episodio completo...");
  await buildAudioOnlyVideo(mainAudioPath, mainDuration, "AgendaCR — Resumen del día", path.join(outDir, "episodio.mp4"));

  console.log("5/5 · Generando shorts verticales para TikTok/YouTube Shorts...");
  for (let i = 0; i < script.shorts.length; i++) {
    const short = script.shorts[i];
    const audio = await synthesizeSpeech(short.script);
    const audioPath = path.join(outDir, `short-${i + 1}.mp3`);
    await writeFile(audioPath, audio.audioBuffer);
    const duration = audio.durationSec || (await getAudioDurationSec(audioPath));
    const wordTimings = audio.wordTimings ?? estimateWordTimings(short.script, duration);

    const videoPath = path.join(outDir, `short-${i + 1}.mp4`);
    await buildShortVideo({
      audioPath,
      wordTimings,
      durationSec: duration,
      brandLabel: "AgendaCR",
      outPath: videoPath,
    });

    const caption = [
      short.title,
      "",
      short.script.length > 180 ? "" : "", // placeholder por si querés recortar
      "Fuentes: " + short.sourceLinks.join(" | "),
      "",
      "#CostaRica #Noticias #AgendaCR",
    ]
      .filter(Boolean)
      .join("\n");
    await writeFile(path.join(outDir, `short-${i + 1}-caption.txt`), caption);

    console.log(`   Short ${i + 1}/${script.shorts.length} listo: ${videoPath}`);
  }

  console.log(`\nEpisodio de ${today} generado en: ${outDir}`);
  console.log("Revisá el guion y los subtítulos antes de publicar — este pipeline no publica");
  console.log("nada automáticamente salvo que corras explícitamente los scripts de publish/.");
}

main().catch((err) => {
  console.error("Error generando el episodio:", err);
  process.exit(1);
});
