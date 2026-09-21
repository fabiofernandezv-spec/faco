import Anthropic from "@anthropic-ai/sdk";
import { EpisodeScript, RankedStory } from "../types.js";

const SYSTEM_PROMPT = `Sos el redactor de "AgendaCR", un podcast diario de noticias de Costa Rica.

Reglas de derechos de autor — son innegociables:
1. NUNCA copiés frases textuales de los titulares o copetes que te paso. Escribí
   siempre con palabras propias, como lo haría un periodista resumiendo lo que
   pasó, no citando literalmente a otro medio.
2. Cada dato debe llevar atribución explícita y hablada ("Según CRHoy...",
   "De acuerdo con Delfino.cr...", "El Ministerio de Salud informó..."). Nunca
   presentes como propia una nota que en realidad reportó otro medio.
3. Limitate a los HECHOS que aparecen en los titulares/copetes recibidos. No
   inventés detalles, cifras ni declaraciones que no estén ahí.
4. No copies estructuras de titular clickbait de la fuente; reformulá.
5. Tono: conversacional, claro, neutral, como un boletín hablado — no un
   artículo escrito.

Formato de salida: SOLO un objeto JSON válido (sin markdown, sin texto extra)
con esta forma exacta:
{
  "mainScript": "guion completo del episodio principal (3 a 5 minutos hablados, ~450-700 palabras), con intro, un repaso de las noticias más importantes del día en orden de relevancia, transiciones naturales entre notas, y un cierre breve invitando a seguir las fuentes originales",
  "shorts": [
    { "title": "título corto para el video", "script": "guion de 45-60 segundos hablados (~90-140 palabras) sobre UNA sola noticia destacada, con gancho inicial y atribución de fuente", "sourceIds": ["id-de-fuente-1"] }
  ]
}
Generá exactamente 3 elementos en "shorts", cada uno sobre una noticia distinta de las más importantes.`;

function buildUserPrompt(stories: RankedStory[]): string {
  const lines = stories.map((story, i) => {
    const perSource = story.items
      .map((it) => `    - Fuente: ${it.sourceName} (id: ${it.sourceId}) | Titular: "${it.title}" | Copete: "${it.snippet}" | Enlace: ${it.link}`)
      .join("\n");
    return `${i + 1}. ${story.headline}\n${perSource}`;
  });
  return `Noticias del día en Costa Rica, agrupadas por hecho (varias fuentes pueden cubrir lo mismo):\n\n${lines.join("\n\n")}\n\nEscribí el episodio de hoy siguiendo las reglas del sistema.`;
}

export async function generateEpisodeScript(
  stories: RankedStory[],
  date: string,
): Promise<EpisodeScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(stories) }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No se pudo extraer JSON de la respuesta del modelo:\n${text}`);

  const parsed = JSON.parse(jsonMatch[0]) as {
    mainScript: string;
    shorts: { title: string; script: string; sourceIds: string[] }[];
  };

  const sourceById = new Map<string, { name: string; link: string }>();
  for (const story of stories) {
    for (const item of story.items) {
      if (!sourceById.has(item.sourceId)) {
        sourceById.set(item.sourceId, { name: item.sourceName, link: item.link });
      }
    }
  }

  const shorts = parsed.shorts.map((s) => ({
    title: s.title,
    script: s.script,
    sourceLinks: s.sourceIds
      .map((id) => sourceById.get(id)?.link)
      .filter((link): link is string => Boolean(link)),
  }));

  return {
    date,
    mainScript: parsed.mainScript,
    shorts,
    citedSources: Array.from(sourceById.values()),
  };
}
