# AgendaCR Podcast

Pipeline que arma, todos los días, un episodio de podcast (y 3 shorts verticales
para TikTok/YouTube Shorts) con las noticias más importantes de Costa Rica,
recopiladas de varios medios digitales y fuentes de gobierno.

## Cómo funciona (resumen)

```
RSS de cada medio (o la base AGENDACR que ya llena n8n) → agrupar/rankear
notas del día → Claude escribe el guion (citando fuentes) → ElevenLabs genera
el audio → ffmpeg arma el video vertical con subtítulos quemados → (opcional)
se sube a YouTube / TikTok / se agrega al feed RSS del podcast para Spotify y
Apple Podcasts
```

### Dos formas de traer las noticias

Con `NEWS_SOURCE=rss` (default), el pipeline le pega directo a los feeds de
`src/config/sources.ts`. Con `NEWS_SOURCE=db`, lee de la tabla `articles_raw`
de tu base Postgres **AGENDACR** — la misma que ya llena cada 6 minutos el
workflow n8n "OPANOTICIAS - Monitor Completo" — así no duplicás el trabajo de
scraping/dedup que ya tenés corriendo en producción.

Ojo con un detalle de ese workflow: el nodo que inserta en `articles_raw`
guarda `source_id = 1` para todas las notas sin importar el medio (está
hardcodeado). El mensaje de Telegram sale bien porque usa el nombre del medio
en memoria antes de insertar, pero la tabla en sí no distingue el medio por
esa columna. `src/lib/readFromDb.ts` lo resuelve infiriendo el medio a partir
del dominio de cada `url`, cruzándolo contra `src/config/sources.ts` — no
hace falta arreglar nada en n8n para que esto funcione, pero si en algún
momento corregís el `source_id` ahí, se puede simplificar a un JOIN directo.

Igual que con los RSS, esa base vive en tu VPS privada: `npm run db-only`
para probarla, corriéndolo desde una red que sí llegue a ese Postgres (tu
máquina, el VPS, o donde corra n8n) — no desde este sandbox de desarrollo.

Corré todo con:

```bash
cp .env.example .env   # completá tus API keys
npm install
npm run episode
```

Esto genera una carpeta `output/<fecha>/` con:
- `script.json` / `script-principal.txt` — el guion completo y el de cada short
- `episodio.mp3` / `episodio.mp4` — audio y video del episodio principal
- `short-1.mp4`, `short-2.mp4`, `short-3.mp4` — verticales 1080×1920 con
  subtítulos quemados, listos para TikTok/Shorts
- `short-N-caption.txt` — texto sugerido para el post (con enlaces a las
  fuentes y hashtags)

**Nada se publica automáticamente por defecto.** Los adaptadores de
`src/publish/` (YouTube, TikTok) están implementados pero hay que invocarlos a
propósito — así podés revisar el guion antes de que salga a producción.

## Sobre derechos de autor — por qué está diseñado así

No se reproduce el texto de ninguna nota. El pipeline solo usa **titular +
copete corto + enlace** de cada feed (lo que el propio medio publica para ser
indexado) y le pide a Claude que:
1. Nunca copie frases textuales — que reformule con palabras propias.
2. Atribuya cada dato a su fuente en voz alta ("Según CRHoy...", "De acuerdo
   con Delfino.cr...").
3. Se limite a los hechos recibidos, sin inventar ni opinar.

Además cada short trae en su caption el enlace directo a la nota original de
cada medio — la idea es que el podcast sea un resumen que **manda tráfico**
a las fuentes, no que las reemplace. Aun así, esto no es asesoría legal:
si vas a monetizar el podcast o crecerlo, valdría la pena que un abogado
revise el guion-tipo una vez, sobre todo el uso de contenido de Presidencia y
la Asamblea (que es información pública, pero con sus propias reglas de cita).

## Limitación importante de este entorno de desarrollo

Esta sesión de Claude Code corre en un sandbox cuya política de red **bloquea
el acceso directo** a crhoy.com, delfino.cr, ameliarueda.com, elmundo.cr,
ncrnoticias.com, genteopa.com, telediariocr.com, presidencia.go.cr y
asamblea.go.cr. Por eso:

- Las URLs de feed en `src/config/sources.ts` marcadas `verified: false` son
  conjeturas razonables (patrón típico `/feed/` de WordPress) que **no pude
  probar en vivo**. `elmundo.cr` y `delfino.cr` sí están confirmadas
  (`verified: true`) porque aparecieron en resultados de búsqueda ya
  indexados.
- Corré `npm run fetch-only` desde tu propia máquina o servidor (con acceso
  normal a internet) para ver cuáles feeds responden de verdad, y ajustá
  `sources.ts` con las URLs reales. Las fuentes de gobierno (Presidencia,
  Asamblea) probablemente no tengan RSS público — para esas quizás necesites
  cargar los titulares a mano o hacer scraping puntual respetando sus
  términos de uso.
- El video de prueba (audio + subtítulos + marca de agua) sí se generó y
  verificó con éxito dentro de este sandbox usando ffmpeg local, así que esa
  parte del pipeline está confirmada funcionando.

## Elegir proveedor de texto a voz

`TTS_PROVIDER=elevenlabs` (recomendado): mejor calidad de voz en español y da
timestamps por palabra, así los subtítulos quedan sincronizados como
karaoke. Necesitás `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID` (podés usar
una voz de su librería o clonar/crear una propia en su dashboard).

Alternativas si no querés usar ElevenLabs:
- **OpenAI TTS** (`TTS_PROVIDER=openai`, ya implementado acá): más barato,
  buena calidad, pero la API no da timestamps por palabra — el pipeline
  estima el tiempo de cada palabra repartiendo la duración total según la
  longitud del texto (subtítulos aproximados, no karaoke exacto).
- **Google Cloud TTS / Amazon Polly**: buena opción si ya usás esa nube;
  ambas dan timestamps por SSML mark, se podría agregar un adaptador más
  siguiendo el mismo patrón de `src/lib/tts.ts`.
- **Descript**: si preferís un flujo más manual/editorial (grabar tu propia
  voz o usar su Overdub, editar como si fuera texto, y exportar directo a
  video con subtítulos automáticos) en vez de un pipeline 100% automático.

## Publicar en cada plataforma

- **Spotify / Apple Podcasts / Google Podcasts**: subís los `.mp3` a algún
  storage con URL pública (Supabase Storage, S3, etc.), generás el feed con
  `src/lib/podcastFeed.ts` y registrás **una sola vez** la URL de ese feed en
  Spotify for Podcasters y Apple Podcasts Connect. De ahí en adelante,
  cada episodio nuevo que agregues al feed aparece solo.
- **YouTube Shorts**: `src/publish/youtube.ts` sube el video con la API de
  YouTube Data v3. Necesitás crear credenciales OAuth2 en Google Cloud
  Console, autorizar tu canal una vez (flujo manual, fuera de este repo) y
  guardar el `refresh_token` resultante en `.env`.
- **TikTok**: `src/publish/tiktok.ts` usa la Content Posting API. TikTok
  exige que tu app pase su revisión antes de poder publicar en público
  (`privacy_level: PUBLIC_TO_EVERYONE`); mientras tanto el código publica en
  modo `SELF_ONLY` (borrador) para que lo revises vos.

## Estructura

```
src/
  config/sources.ts     # lista de medios y feeds a monitorear
  lib/fetchFeeds.ts      # trae y normaliza los RSS
  lib/rankNews.ts        # agrupa notas duplicadas entre medios y rankea
  lib/generateScript.ts  # arma el guion con Claude (reglas de atribución)
  lib/tts.ts              # texto a voz (ElevenLabs / OpenAI)
  lib/captions.ts         # subtítulos .ass a partir de timestamps
  lib/buildVideo.ts       # ensamblado del video con ffmpeg
  lib/podcastFeed.ts      # feed RSS del podcast (Spotify/Apple)
  publish/youtube.ts      # subida a YouTube Shorts
  publish/tiktok.ts       # subida a TikTok
  runEpisode.ts           # orquesta todo el pipeline
```
