import { SourceConfig } from "../types.js";

/**
 * Lista de fuentes a monitorear.
 *
 * `verified: true` = URL de feed confirmada en producción (viene del workflow
 * n8n "OPANOTICIAS - Monitor Completo" que ya corre cada 6 minutos contra
 * estos feeds reales). `verified: false` = conjetura razonable sin confirmar
 * todavía; si falla, la fuente se omite del episodio y queda logueada.
 */
export const SOURCES: SourceConfig[] = [
  {
    id: "crhoy",
    name: "CRHoy",
    homepage: "https://www.crhoy.com/",
    feedCandidates: ["https://wordpress.crhoy.com/feed/"],
    kind: "medio",
    verified: true,
  },
  {
    id: "diarioextra",
    name: "Diario Extra",
    homepage: "https://www.diarioextra.com/",
    feedCandidates: ["https://www.diarioextra.com/feed"],
    kind: "medio",
    verified: true,
  },
  {
    id: "nacion",
    name: "La Nación",
    homepage: "https://www.nacion.com/",
    feedCandidates: ["https://www.nacion.com/arc/outboundfeeds/rss/?outputType=xml"],
    kind: "medio",
    verified: true,
  },
  {
    id: "elmundocr",
    name: "El Mundo CR",
    homepage: "https://www.elmundo.cr/",
    feedCandidates: ["https://www.elmundo.cr/feed"],
    kind: "medio",
    verified: true,
  },
  {
    id: "elfinanciero",
    name: "El Financiero CR",
    homepage: "https://www.elfinancierocr.com/",
    feedCandidates: ["https://www.elfinancierocr.com/arc/outboundfeeds/rss/?outputType=xml"],
    kind: "medio",
    verified: true,
  },
  {
    id: "ameliarueda",
    name: "Amelia Rueda",
    homepage: "https://ameliarueda.com/",
    // AmeliaRueda no publica RSS propio; se usa Google News acotado a su sitio
    // (mismo truco que ya usa el workflow de n8n en producción).
    feedCandidates: [
      "https://news.google.com/rss/search?q=site:ameliarueda.com&hl=es-419&gl=CR&ceid=CR:es-419",
    ],
    kind: "medio",
    verified: true,
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
    id: "teletica",
    name: "Teletica",
    homepage: "https://teletica.com/",
    feedCandidates: ["https://teletica.com/rss/feed"],
    kind: "medio",
    verified: true,
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
