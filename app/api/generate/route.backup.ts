import { NextRequest } from 'next/server';
import { z } from 'zod';

/** ---------- Types ---------- */
export type Choice = { id: 'A'|'B'|'C'|'D'; text: string };
export type Question = {
  id: string;
  type: 'mcq';
  prompt: string;
  choices: Choice[];
  correctChoiceId: 'A'|'B'|'C'|'D';
  explanation?: string;
};
export type Quiz = {
  title: string;
  description: string;
  metadata: {
    topic: string;
    difficulty: 'easy'|'medium'|'hard';
    numQuestions: number;
  };
  questions: Question[];
};

export const runtime = 'nodejs';

/** ---------- Zod Schemas ---------- */
const ChoiceSchema = z.object({
  id: z.enum(['A','B','C','D']),
  text: z.string().min(1),
});

const QuestionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('mcq'),
  prompt: z.string().min(3),
  choices: z.array(ChoiceSchema).length(4),
  correctChoiceId: z.enum(['A','B','C','D']),
  explanation: z.string().optional(),
});

const QuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  metadata: z.object({
    topic: z.string().min(1),
    difficulty: z.enum(['easy','medium','hard']),
    numQuestions: z.number().int().min(1).max(25),
  }),
  questions: z.array(QuestionSchema).min(1),
});

const InputSchema = z.object({
  topic: z.string().min(2),
  numQuestions: z.number().int().min(1).max(25).default(8),
  difficulty: z.enum(['easy','medium','hard']).default('medium'),
  source: z.string().max(20000).optional(),
});

/** ---------- Helpers: extraction & repairs ---------- */

// Extract choices[0].text if server returned a completions JSON object.
// If it isn't valid JSON, return the raw text.
function extractTextFromCompletions(raw: string): string {
  try {
    const o = JSON.parse(raw);
    // OpenAI-style or compatible
    if (o && typeof o === 'object' && Array.isArray(o.choices) && o.choices.length > 0) {
      const t = o.choices[0]?.text;
      if (typeof t === 'string') return t;
    }
  } catch {
    // not JSON, it might already be plain text
  }
  return raw;
}

// Pull content between ###BEGIN_JSON### ... ###END_JSON###
function extractBetweenMarkers(text: string): string | null {
  const start = text.indexOf('###BEGIN_JSON###');
  const end = text.indexOf('###END_JSON###', start + 1);
  if (start !== -1 && end !== -1) {
    const inside = text.slice(start + '###BEGIN_JSON###'.length, end);
    return inside.trim();
  }
  return null;
}

// Very conservative "repair": strip code fences, trim, and try to isolate the first {...} block.
function conservativeJsonRepair(text: string): string {
  const noFences = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  const s = noFences.indexOf('{');
  const e = noFences.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    return noFences.slice(s, e + 1).trim();
  }
  return noFences;
}

/** ---------- Prompt builders ---------- */

const BASE_SYSTEM = `You are QUIZZR, a strict JSON generator for multiple-choice quizzes.
Return ONLY JSON between markers exactly:
###BEGIN_JSON###
{ ...valid JSON... }
###END_JSON###
Never include markdown, commentary, or extra keys.

Types:
interface Choice { id: 'A'|'B'|'C'|'D'; text: string; }
interface Question { id: string; type: 'mcq'; prompt: string; choices: Choice[]; correctChoiceId: 'A'|'B'|'C'|'D'; explanation?: string; }
interface Quiz { title: string; description: string; metadata: { topic: string; difficulty: 'easy'|'medium'|'hard'; numQuestions: number; }; questions: Question[]; }`;

function buildUserPrompt(p: {topic:string; difficulty:string; numQuestions:number; source?:string}) {
  const scope = p.source?.trim()
    ? `Generate questions ONLY from the following source text. Do NOT invent facts not present in it.

SOURCE START
${p.source.trim().slice(0, 18000)}
SOURCE END`
    : `If you lack a source, use reliable, widely accepted fundamentals for the topic.`;

  return `Create a quiz on: "${p.topic}"
Difficulty: ${p.difficulty}
Number of questions: ${p.numQuestions}

Rules:
- ONLY single-correct MCQs (type="mcq").
- Exactly 4 choices with ids "A","B","C","D".
- Clear prompts; classroom-appropriate.
- Include a short explanation for each.
- Output MUST be valid JSON matching Quiz, wrapped in the specified markers.

${scope}

Return:
###BEGIN_JSON###
{...}
###END_JSON###`;
}

// Plain deterministic template fallback (no JSON parsing needed)
function buildPlainTemplatePrompt(p: {topic:string; difficulty:string; numQuestions:number; source?:string}) {
  const scope = p.source?.trim()
    ? `Use ONLY this source (no invented facts):

SOURCE START
${p.source.trim().slice(0, 18000)}
SOURCE END`
    : `If no source is provided, rely on broadly accepted fundamentals.`;

  return `Produce a quiz in the following PLAIN TEXT TEMPLATE (no JSON):

TITLE: <short title>
DESCRIPTION: <1–2 sentence overview>
QUESTION COUNT: ${p.numQuestions}

For each question i = 1..${p.numQuestions} emit:

Q{i}: <prompt>
A) <choice>
B) <choice>
C) <choice>
D) <choice>
CORRECT: <A|B|C|D>
EXPLAIN: <one-line explanation>

Topic: ${p.topic}
Difficulty: ${p.difficulty}
${scope}`;
}

/** ---------- Network callers ---------- */

async function callLLM_raw(prompt: string, llmUrl: string): Promise<string> {
  const r = await fetch(llmUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      prompt,
      max_tokens: 2400,
      temperature: 0.0,
      stop: ["###END_JSON###","```","END_PREVIOUS","---\n\n"] // trim chatter when supported
    })
  });
  return await r.text();
}

async function callLLM_text(prompt: string, llmUrl: string): Promise<string> {
  const raw = await callLLM_raw(prompt, llmUrl);
  const text = extractTextFromCompletions(raw);
  return text;
}

/** ---------- Parsers ---------- */

function parseQuizFromJsonish(content: string): Quiz {
  // First: look for explicit markers
  const withMarkers = extractBetweenMarkers(content);
  const candidate = withMarkers ?? content;

  const repaired = conservativeJsonRepair(candidate);
  console.log('[QUIZZR] CONTENT LEN:', content.length);
  console.log('[QUIZZR] EXTRACTED LEN:', repaired.length);

  try {
    const obj = JSON.parse(repaired);
    return QuizSchema.parse(obj) as Quiz;
  } catch (err) {
    console.error('[QUIZZR] PARSE ERROR', err);
    console.error('[QUIZZR] REPAIRED HEAD:', repaired.slice(0, 1200));
    throw err;
  }
}

function parseQuizFromPlainTemplate(topic: string, difficulty: 'easy'|'medium'|'hard', n: number, plain: string): Quiz {
  // Parse the strict template we defined above.
  // We’ll be lenient about whitespace but strict about markers like "Q1:", "A)", etc.
  const lines = plain.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // TITLE and DESCRIPTION
  const titleLine = lines.find(l => l.toUpperCase().startsWith('TITLE:'));
  const descLine  = lines.find(l => l.toUpperCase().startsWith('DESCRIPTION:'));
  const title = titleLine ? titleLine.slice(titleLine.indexOf(':')+1).trim() : `${topic} Quiz`;
  const description = descLine ? descLine.slice(descLine.indexOf(':')+1).trim() : `A quick quiz on ${topic}.`;

  // Collect questions
  const questions: Question[] = [];
  let i = 1;
  while (i <= n) {
    const qIdx = lines.findIndex(l => new RegExp(`^Q${i}:\\s*`, 'i').test(l));
    if (qIdx === -1) break;

    const prompt = lines[qIdx].replace(/^Q\d+:\s*/i, '').trim();

    const A = lines[qIdx+1]?.replace(/^A\)\s*/i, '').trim();
    const B = lines[qIdx+2]?.replace(/^B\)\s*/i, '').trim();
    const C = lines[qIdx+3]?.replace(/^C\)\s*/i, '').trim();
    const D = lines[qIdx+4]?.replace(/^D\)\s*/i, '').trim();

    const corrLine = lines[qIdx+5] || '';
    const expLine  = lines[qIdx+6] || '';

    const corr = (corrLine.match(/^CORRECT:\s*([ABCD])/i)?.[1] ?? 'A').toUpperCase() as 'A'|'B'|'C'|'D';
    const expl = expLine.replace(/^EXPLAIN:\s*/i, '').trim();

    if (!prompt || !A || !B || !C || !D) {
      // stop parsing if the block is incomplete
      break;
    }

    questions.push({
      id: `Q${i}`,
      type: 'mcq',
      prompt,
      choices: [
        { id: 'A', text: A },
        { id: 'B', text: B },
        { id: 'C', text: C },
        { id: 'D', text: D },
      ],
      correctChoiceId: corr,
      explanation: expl || undefined,
    });

    i++;
  }

  if (questions.length === 0) {
    throw new Error('No questions parsed from plain template.');
  }

  const quiz: Quiz = {
    title,
    description,
    metadata: { topic, difficulty, numQuestions: questions.length },
    questions,
  };
  return QuizSchema.parse(quiz);
}

/** ---------- Route ---------- */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topic, numQuestions, difficulty, source } = InputSchema.parse(body);
  const llmUrl = process.env.LLM_URL || 'http://bigbelto.duckdns.org:8005/v1/completions';

  // 1) Primary attempt: strict JSON with markers (model instructed to do so)
  const p1 = `${BASE_SYSTEM}\n\n${buildUserPrompt({ topic, numQuestions, difficulty, source })}`;
  let text = await callLLM_text(p1, llmUrl);

  try {
    const quiz = parseQuizFromJsonish(text);
    return new Response(JSON.stringify({ mode: 'json', quiz }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    // 2) Second attempt: ask the model to "repair" itself
    const p2 = `${BASE_SYSTEM}

Your previous reply was not valid JSON. Convert it to EXACTLY the required JSON (no commentary). Keep content; fix structure/keys if needed.
BEGIN_PREVIOUS
${text.slice(0, 6000)}
END_PREVIOUS

Return only between markers.`;
    text = await callLLM_text(p2, llmUrl);
    try {
      const quiz = parseQuizFromJsonish(text);
      return new Response(JSON.stringify({ mode: 'json-fixed', quiz }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch {
      // 3) Final fallback: a plain deterministic template and parse it
      const p3 = buildPlainTemplatePrompt({ topic, numQuestions, difficulty, source });
      const plain = await callLLM_text(p3, llmUrl);

      try {
        const quiz = parseQuizFromPlainTemplate(topic, difficulty, numQuestions, plain);
        return new Response(JSON.stringify({ mode: 'plain-template', quiz }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch {
        // Debug aid for you on the client
        return new Response(JSON.stringify({
          error: 'LLM returned content that could not be parsed as JSON or the plain template.',
          hint: 'Open terminal logs to see the raw/parsed content. Try fewer questions, shorter source, or a different local model.',
          preview: (plain || text || '').slice(0, 1200),
        }), { status: 422 });
      }
    }
  }
}

