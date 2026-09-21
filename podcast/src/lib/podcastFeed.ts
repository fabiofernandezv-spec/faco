export interface PodcastEpisodeMeta {
  title: string;
  description: string;
  audioUrl: string;
  audioSizeBytes: number;
  durationSec: number;
  pubDate: Date;
  guid: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDurationHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Genera un feed RSS 2.0 con tags iTunes, listo para enviar a Spotify for
 * Podcasters / Apple Podcasts Connect (se registra la URL del feed una sola
 * vez; después cada episodio nuevo se agrega acá y las plataformas lo detectan
 * solas).
 */
export function buildPodcastRssFeed(params: {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  imageUrl: string;
  author: string;
  episodes: PodcastEpisodeMeta[];
}): string {
  const items = params.episodes
    .map(
      (ep) => `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <enclosure url="${escapeXml(ep.audioUrl)}" length="${ep.audioSizeBytes}" type="audio/mpeg" />
      <guid isPermaLink="false">${escapeXml(ep.guid)}</guid>
      <pubDate>${ep.pubDate.toUTCString()}</pubDate>
      <itunes:duration>${formatDurationHms(ep.durationSec)}</itunes:duration>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(params.title)}</title>
    <description>${escapeXml(params.description)}</description>
    <link>${escapeXml(params.siteUrl)}</link>
    <language>es-cr</language>
    <itunes:author>${escapeXml(params.author)}</itunes:author>
    <itunes:image href="${escapeXml(params.imageUrl)}" />
    <itunes:explicit>false</itunes:explicit>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(params.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
