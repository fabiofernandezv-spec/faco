import { createReadStream, statSync } from "node:fs";
import { google } from "googleapis";

/**
 * Sube un short vertical a YouTube. Requiere que ya hayas hecho el flujo OAuth2
 * una vez (consentimiento del canal) y tengas el refresh token guardado en
 * YOUTUBE_REFRESH_TOKEN. Ver README para el paso a paso de esa autorización
 * inicial (es manual y solo se hace una vez).
 */
export async function uploadYouTubeShort(opts: {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
}): Promise<{ videoId: string; url: string }> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      "Faltan YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN en el entorno.",
    );
  }

  const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        // #Shorts en el título/descripción es lo que YouTube usa para clasificarlo
        title: `${opts.title} #Shorts`,
        description: opts.description,
        tags: opts.tags,
        categoryId: "25", // Noticias y política
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(opts.filePath) },
  });

  const videoId = res.data.id!;
  return { videoId, url: `https://youtube.com/shorts/${videoId}` };
}

export function fileSizeBytes(filePath: string): number {
  return statSync(filePath).size;
}
