import { SourceConfig } from "../types.js";

/**
 * Lista de fuentes a monitorear.
 *
 * `verified: true` = la URL de feed fue confirmada por búsqueda antes de escribir
 * este archivo. `verified: false` = es una conjetura razonable (patrón típico de
 * WordPress /feed/) que el fetcher intentará, pero puede fallar o no existir; en
 * ese caso la fuente se omite del episodio y queda logueada como "sin feed".
 *
 * Revisá y ajustá esta lista con URLs reales antes de correr en producción:
 * la red de este entorno de desarrollo bloquea el acceso directo a estos
 * dominios, así que ninguna de estas URLs pudo probarse en vivo desde acá.
 */
export const SOURCES: SourceConfig[] = [
  {
    id: "crhoy",
    name: "CRHoy.com",
    homepage: "https://www.crhoy.com/",
    feedCandidates: [
      "https://www.crhoy.com/feed",
      "https://www.crhoy.com/nacionales/feed",
      "https://www.crhoy.com/economia/feed",
    ],
    kind: "medio",
    verified: false,
  },
  {
    id: "ncr",
    name: "NCR Noticias",
    homepage: "https://ncrnoticias.com/",
    feedCandidates: ["https://ncrnoticias.com/feed/", "https://ncrnoticias.com/feed"],
    kind: "medio",
    verified: false,
  },
  {
    id: "elmundocr",
    name: "El Mundo CR",
    homepage: "https://elmundo.cr/",
    feedCandidates: ["https://elmundo.cr/feed/"],
    kind: "medio",
    verified: true,
  },
  {
    id: "genteopa",
    name: "¡OPA! / Central Noticias",
    homepage: "https://genteopa.com/",
    feedCandidates: ["https://genteopa.com/feed/"],
    kind: "medio",
    verified: false,
  },
  {
    id: "telediariocr",
    name: "Telediario CR",
    homepage: "https://telediariocr.com/",
    feedCandidates: ["https://telediariocr.com/feed/", "https://telediariocr.com/feed"],
    kind: "medio",
    verified: false,
  },
  {
    id: "delfino",
    name: "Delfino.cr",
    homepage: "https://delfino.cr/",
    feedCandidates: ["https://delfino.cr/feed"],
    kind: "medio",
    verified: true,
  },
  {
    id: "ameliarueda",
    name: "AmeliaRueda.com",
    homepage: "https://ameliarueda.com/",
    feedCandidates: ["https://ameliarueda.com/feed", "https://ameliarueda.com/feed/"],
    kind: "medio",
    verified: false,
  },
  {
    id: "presidencia",
    name: "Presidencia de la República",
    homepage: "https://www.presidencia.go.cr/noticias",
    feedCandidates: ["https://www.presidencia.go.cr/noticias/feed/"],
    kind: "gobierno",
    verified: false,
  },
  {
    id: "asamblea",
    name: "Asamblea Legislativa",
    homepage: "https://www.asamblea.go.cr/",
    feedCandidates: [],
    kind: "gobierno",
    verified: false,
  },
];

/** Rutas comunes de RSS a probar cuando no hay feedCandidates o todas fallan. */
export const COMMON_FEED_PATHS = ["feed/", "feed", "rss", "rss.xml", "?feed=rss2"];
