import pg from "pg";
import { SOURCES } from "../config/sources.js";
import { NewsItem } from "../types.js";

/**
 * Lee las notas ya recopiladas por el workflow n8n "OPANOTICIAS - Monitor
 * Completo" desde la base Postgres AGENDACR (tabla `articles_raw`), en vez de
 * volver a pegarle a cada RSS por separado.
 *
 * OJO: ese workflow inserta todas las filas con `source_id = 1` (está
 * hardcodeado en el nodo "Filtrar y armar mensajes"), así que `articles_raw`
 * hoy NO distingue de qué medio vino cada nota por esa columna. Para poder
 * atribuir cada dato a su fuente en el guion, este módulo infiere el medio a
 * partir del dominio de `url` y lo cruza contra `SOURCES` (config/sources.ts).
 * Si arreglás el source_id en n8n más adelante, se puede simplificar esto a
 * un JOIN directo contra la tabla `sources`.
 */

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const HOST_TO_SOURCE = new Map(
  SOURCES.map((s) => [normalizeHost(s.homepage), s]),
);

function resolveSource(articleUrl: string): { sourceId: string; sourceName: string } | null {
  const host = normalizeHost(articleUrl);
  if (!host) return null;

  // match exacto o por subdominio/dominio contenido (ej. wordpress.crhoy.com -> crhoy.com)
  for (const [sourceHost, source] of HOST_TO_SOURCE) {
    if (host === sourceHost || host.endsWith(`.${sourceHost}`) || sourceHost.endsWith(`.${host}`)) {
      return { sourceId: source.id, sourceName: source.name };
    }
  }
  return null;
}

export interface ReadFromDbOptions {
  /** Ventana de tiempo a considerar "noticias del día". Default 24h. */
  hours?: number;
  limit?: number;
}

function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new pg.Pool({ connectionString, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined });
  }

  const { PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
  if (!PGHOST || !PGDATABASE || !PGUSER) {
    throw new Error(
      "Faltan credenciales de Postgres: definí DATABASE_URL, o PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD en el entorno.",
    );
  }
  return new pg.Pool({
    host: PGHOST,
    port: PGPORT ? parseInt(PGPORT, 10) : 5432,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
}

export async function readNewsFromDb(opts: ReadFromDbOptions = {}): Promise<{
  items: NewsItem[];
  unmatchedCount: number;
}> {
  const hours = opts.hours ?? 24;
  const limit = opts.limit ?? 500;

  const pool = getPool();
  try {
    const { rows } = await pool.query<{
      url: string;
      original_title: string;
      published_at: Date;
    }>(
      `SELECT url, original_title, published_at
       FROM articles_raw
       WHERE published_at > NOW() - INTERVAL '1 hour' * $1
         AND processed = true
       ORDER BY published_at DESC
       LIMIT $2`,
      [hours, limit],
    );

    const items: NewsItem[] = [];
    let unmatchedCount = 0;

    for (const row of rows) {
      const resolved = resolveSource(row.url);
      if (!resolved) {
        unmatchedCount++;
        continue;
      }
      items.push({
        sourceId: resolved.sourceId,
        sourceName: resolved.sourceName,
        title: row.original_title,
        link: row.url,
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        // articles_raw no guarda copete/contenido, solo título — el guion se
        // arma con título + fuente + enlace.
        snippet: "",
      });
    }

    return { items, unmatchedCount };
  } finally {
    await pool.end();
  }
}

// `npm run db-only` para probar rápido la conexión y ver qué trae.
if (import.meta.url === `file://${process.argv[1]}`) {
  readNewsFromDb().then(({ items, unmatchedCount }) => {
    console.log(`OK: ${items.length} notas resueltas a una fuente conocida.`);
    if (unmatchedCount) {
      console.log(`${unmatchedCount} notas con dominio no reconocido (revisar SOURCES).`);
    }
    for (const item of items.slice(0, 20)) {
      console.log(`- [${item.sourceName}] ${item.title}`);
    }
  }).catch((err) => {
    console.error("Error leyendo de la base:", err.message);
    process.exit(1);
  });
}
