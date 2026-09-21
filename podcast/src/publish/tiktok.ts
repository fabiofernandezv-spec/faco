import { readFile, stat } from "node:fs/promises";

/**
 * Publica un video en TikTok usando la Content Posting API (flujo FILE_UPLOAD).
 * Requiere una app aprobada por TikTok for Developers con el scope
 * `video.publish`, y un access token de usuario ya autorizado en
 * TIKTOK_ACCESS_TOKEN. TikTok exige que las apps nuevas empiecen en modo
 * borrador/privado hasta que te aprueben publicación directa — revisá el
 * estado de tu app en developers.tiktok.com antes de asumir que esto publica
 * en público.
 */
export async function uploadTikTokVideo(opts: {
  filePath: string;
  title: string;
}): Promise<{ publishId: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Falta TIKTOK_ACCESS_TOKEN en el entorno.");

  const { size } = await stat(opts.filePath);

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: opts.title,
        privacy_level: "SELF_ONLY", // cambiar a PUBLIC_TO_EVERYONE solo cuando tu app esté aprobada
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initRes.ok) {
    throw new Error(`TikTok init respondió ${initRes.status}: ${await initRes.text()}`);
  }

  const initData = (await initRes.json()) as {
    data: { publish_id: string; upload_url: string };
  };

  const buffer = await readFile(opts.filePath);
  const uploadRes = await fetch(initData.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`TikTok upload respondió ${uploadRes.status}: ${await uploadRes.text()}`);
  }

  return { publishId: initData.data.publish_id };
}
