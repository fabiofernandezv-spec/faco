import { TTSResult, WordTiming } from "../types.js";

function wordTimingsFromCharacterAlignment(
  text: string,
  characters: string[],
  starts: number[],
  ends: number[],
): WordTiming[] {
  const timings: WordTiming[] = [];
  let word = "";
  let wordStart: number | null = null;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (/\s/.test(ch)) {
      if (word) {
        timings.push({ word, start: wordStart ?? starts[i], end: ends[i - 1] ?? starts[i] });
        word = "";
        wordStart = null;
      }
      continue;
    }
    if (wordStart === null) wordStart = starts[i];
    word += ch;
  }
  if (word) {
    timings.push({
      word,
      start: wordStart ?? 0,
      end: ends[ends.length - 1] ?? 0,
    });
  }
  return timings;
}

async function synthElevenLabs(text: string): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new Error("Faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en el entorno.");
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs respondió ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  const audioBuffer = Buffer.from(data.audio_base64, "base64");
  const wordTimings = wordTimingsFromCharacterAlignment(
    text,
    data.alignment.characters,
    data.alignment.character_start_times_seconds,
    data.alignment.character_end_times_seconds,
  );
  const durationSec =
    data.alignment.character_end_times_seconds[
      data.alignment.character_end_times_seconds.length - 1
    ] ?? 0;

  return { audioBuffer, mimeType: "audio/mpeg", wordTimings, durationSec };
}

/**
 * Fallback más económico. No da timestamps por palabra: buildVideo estima el
 * timing repartiendo la duración total proporcionalmente a la longitud de cada
 * palabra (aproximación razonable para subtítulos, no karaoke exacto).
 */
async function synthOpenAI(text: string): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en el entorno.");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI TTS respondió ${res.status}: ${await res.text()}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  return { audioBuffer, mimeType: "audio/mpeg", wordTimings: null, durationSec: 0 };
}

export async function synthesizeSpeech(text: string): Promise<TTSResult> {
  const provider = process.env.TTS_PROVIDER || "elevenlabs";
  if (provider === "elevenlabs") return synthElevenLabs(text);
  if (provider === "openai") return synthOpenAI(text);
  throw new Error(`TTS_PROVIDER desconocido: ${provider}`);
}
