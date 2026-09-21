import Parser from "rss-parser";
import { SOURCES, COMMON_FEED_PATHS } from "../config/sources.js";
import { NewsItem, SourceConfig } from "../types.js";

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "AgendaCR-Podcast/0.1 (+https://agendacr.example)" },
});

function candidateUrls(source: SourceConfig): string[] {
  const fromHomepage = COMMON_FEED_PATHS.map(
    (p) => new URL(p, source.homepage).toString(),
  );
  return [...source.feedCandidates, ...fromHomepage];
}

async function tryFetchFeed(source: SourceConfig): Promise<NewsItem[] | null> {
  for (const url of candidateUrls(source)) {
    try {
      const feed = await parser.parseURL(url);
      if (!feed.items?.length) continue;
      return feed.items.slice(0, 15).map((item) => ({
        sourceId: source.id,
        sourceName: source.name,
        title: (item.title ?? "").trim(),
        link: item.link ?? source.homepage,
        publishedAt: item.isoDate ? new Date(item.isoDate) : null,
        snippet: (item.contentSnippet ?? item.summary ?? "").trim().slice(0, 400),
      }));
    } catch {
      // probar el siguiente candidato
      continue;
    }
  }
  return null;
}

export interface FetchAllResult {
  items: NewsItem[];
  /** Fuentes de las que no se pudo obtener feed alguno (revisar/ajustar URL manualmente) */
  failedSources: string[];
}

export async function fetchAllFeeds(
  sources: SourceConfig[] = SOURCES,
): Promise<FetchAllResult> {
  const items: NewsItem[] = [];
  const failedSources: string[] = [];

  const results = await Promise.allSettled(sources.map((s) => tryFetchFeed(s)));

  results.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "fulfilled" && result.value) {
      items.push(...result.value);
    } else {
      failedSources.push(source.name);
    }
  });

  return { items, failedSources };
}

// Permite correr `npm run fetch-only` para probar rápido qué feeds funcionan.
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllFeeds().then(({ items, failedSources }) => {
    console.log(`OK: ${items.length} notas de ${SOURCES.length - failedSources.length} fuentes.`);
    if (failedSources.length) {
      console.log("Sin feed (revisar URL manualmente):", failedSources.join(", "));
    }
    for (const item of items.slice(0, 20)) {
      console.log(`- [${item.sourceName}] ${item.title}`);
    }
  });
}
