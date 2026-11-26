const runtimeEnv = typeof window !== 'undefined' ? window.__ENV__ : undefined;

const apiKey = (
  runtimeEnv?.VITE_GEMINI_API_KEY ||
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)
)?.trim();

const configuredModel = (
  runtimeEnv?.VITE_GEMINI_MODEL ||
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ||
  ''
).trim();

const CANDIDATE_MODELS = configuredModel
  ? [configuredModel, 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash']
  : ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

export const isGeminiConfigured = Boolean(apiKey);

export interface MistakeContext {
  expected: string;
  userAnswer: string;
  sentence: string;
  sentenceTranslation: string;
}

/**
 * Calls Gemini on explicit user click to explain the learner's mistake in 2 concise sentences max.
 * Tries `gemini-2.5-flash` first and falls back to `gemini-3.1-flash-lite` if unavailable on newer projects.
 */
export async function explainMistake(ctx: MistakeContext): Promise<string> {
  if (!apiKey) {
    throw new Error('Add VITE_GEMINI_API_KEY in .env to enable AI mistake explanations.');
  }

  const prompt = `You are a friendly CEFR A1 German teacher. A beginner made a mistake.
Context sentence: "${ctx.sentence}" (${ctx.sentenceTranslation})
Expected answer: "${ctx.expected}"
Learner's answer: "${ctx.userAnswer || '(empty)'}"

Explain in clear, simple ENGLISH, in 2 sentences maximum, why the learner's answer is wrong, focusing on the exact grammar or vocabulary mistake (e.g. V2 verb position, noun gender der/die/das, accusative/dative case, verb ending, or spelling). Use 100% English & German only (zero French).`;

  let lastError = 'Gemini request failed';

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
          }),
        }
      );

      if (!res.ok) {
        lastError = `Gemini (${model}) returned HTTP ${res.status}`;
        continue;
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim();

      if (text) return text;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}
