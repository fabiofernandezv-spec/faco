import { NewsItem, RankedStory } from "../types.js";

const STOPWORDS = new Set([
  "el", "la", "los", "las", "de", "del", "en", "y", "a", "un", "una", "unos",
  "unas", "que", "por", "para", "con", "su", "sus", "se", "es", "al", "lo",
  "más", "como", "pero", "sobre", "tras", "entre", "sin", "ya", "no", "esta",
  "este", "estos", "estas", "costa", "rica",
]);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.35;
const HOURS_24 = 24 * 60 * 60 * 1000;

/**
 * Agrupa notas de distintos medios que hablan del mismo hecho (similitud de
 * palabras significativas en el título), y ordena los grupos por "importancia":
 * cuántos medios distintos lo cubren + qué tan reciente es.
 */
export function rankTopStories(items: NewsItem[], limit = 10): RankedStory[] {
  const now = Date.now();
  const recent = items.filter(
    (i) => !i.publishedAt || now - i.publishedAt.getTime() < HOURS_24 * 2,
  );

  const groups: { words: Set<string>; items: NewsItem[] }[] = [];

  for (const item of recent) {
    const words = significantWords(item.title);
    const match = groups.find((g) => jaccardSimilarity(g.words, words) >= SIMILARITY_THRESHOLD);
    if (match) {
      match.items.push(item);
      words.forEach((w) => match.words.add(w));
    } else {
      groups.push({ words, items: [item] });
    }
  }

  const stories: RankedStory[] = groups.map((g) => {
    const uniqueSources = new Set(g.items.map((i) => i.sourceId)).size;
    const mostRecent = g.items.reduce<Date | null>((latest, i) => {
      if (!i.publishedAt) return latest;
      if (!latest || i.publishedAt > latest) return i.publishedAt;
      return latest;
    }, null);
    const ageHours = mostRecent ? (now - mostRecent.getTime()) / (60 * 60 * 1000) : 24;
    const recencyScore = Math.max(0, 1 - ageHours / 24);
    const score = uniqueSources * 2 + recencyScore;

    // título más largo/descriptivo como representante del grupo
    const headline = g.items.reduce((best, i) => (i.title.length > best.length ? i.title : best), g.items[0].title);

    return { headline, items: g.items, score };
  });

  return stories.sort((a, b) => b.score - a.score).slice(0, limit);
}
