'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { Quiz } from '@/lib/types';

const LETTERS = ['A','B','C','D'] as const;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Reorders choices randomly and re-letters them A..D; updates correctChoiceId accordingly */
function fixQuiz(qz: Quiz): Quiz {
  const questions = qz.questions.map((q) => {
    // shuffle by original choice objects
    const shuffled = shuffle([...q.choices]);
    // re-letter to A..D after shuffle
    const relettered = shuffled.map((c, i) => ({ ...c, id: LETTERS[i] }));
    // find which shuffled item was originally the correct one
    const idx = shuffled.findIndex(c => c.id === q.correctChoiceId);
    const newCorrect = LETTERS[idx >= 0 ? idx : 0];
    return { ...q, choices: relettered, correctChoiceId: newCorrect };
  });
  return { ...qz, questions };
}

import { Card, Button, Input, Label, Select, SectionTitle } from '@/components/UI';
import { quizToCsv } from '@/utils/csv';
import { quizToQtiZip } from '@/utils/qti';
import { downloadBlob } from '@/lib/utils';

const QuizPlayer = dynamic(() => import('@/components/QuizPlayer'), { ssr: false, loading: () => <div className="skeleton h-24" /> });

const GenSchema = z.object({
  topic: z.string().min(2),
  numQuestions: z.number().int().min(1).max(25),
  difficulty: z.enum(['easy','medium','hard']),
});

export default function Page() {
  const [topic, setTopic] = useState('Intro to Microeconomics');
  const [numQuestions, setNumQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appName = useMemo(() => (process.env.NEXT_PUBLIC_APP_NAME ?? 'QUIZZR'), []);

  async function generate() {
    setLoading(true); setError(null);
    try {
      GenSchema.parse({ topic, numQuestions, difficulty });
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, numQuestions, difficulty, source: source || undefined }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? `Generation failed (${res.status})`);
      (window as any).__QUIZZR_MODE__ = payload.mode || 'unknown';
      setQuiz(payload.quiz as Quiz);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function exportJSON() {
    if (!quiz) return; const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${quiz.metadata.topic.replace(/\s+/g,'_')}_quiz.json`);
  }
  function exportCSV() {
    if (!quiz) return; const csv = quizToCsv(quiz); const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `${quiz.metadata.topic.replace(/\s+/g,'_')}_quiz.csv`);
  }
  async function exportQTI() {
    if (!quiz) return; const blob = await quizToQtiZip(quiz);
    downloadBlob(blob, `${quiz.metadata.topic.replace(/\s+/g,'_')}_QTI.zip`);
  }

  return (
    <main className="grid gap-6">
      <Card>
        <h1 className="mb-1 text-2xl font-semibold">{appName}: Canvas-friendly Quiz Generator</h1>
        <p className="mb-6 text-sm text-slate-600">Type a topic, optional source text, pick difficulty, Generate. Then practice or export (QTI zip, CSV, JSON).</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Topic</Label>
            <Input placeholder="e.g., Supply & Demand" value={topic} onChange={e=>setTopic(e.target.value)} />
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onChange={e=>setDifficulty(e.target.value as any)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          <div>
            <Label># Questions</Label>
            <Input type="number" min={1} max={25} value={numQuestions} onChange={e=>setNumQuestions(parseInt(e.target.value || '1'))} />
          </div>
          <div className="md:col-span-3">
            <Label>Optional source text (pasted content to generate strictly from)</Label>
            <textarea value={source} onChange={e=>setSource(e.target.value)} rows={6}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate quiz'}</Button>
          <div className="text-xs text-slate-500">LLM host: <code>{process.env.NEXT_PUBLIC_LLM_HOST || 'bigbelto.duckdns.org:8005'}</code></div>
        </div>

        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">{error}</div>}
      </Card>

      {loading && <Card><div className="skeleton h-28" /></Card>}

      {quiz && (
        <>
          <Card>
            <SectionTitle>Preview</SectionTitle>
            <div className="mb-4 text-sm text-slate-600">{quiz.description}</div>
            <ol className="grid gap-4">
              {quiz.questions.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 font-medium">{i+1}. {q.prompt}</div>
                  <ul className="grid gap-1 text-sm">
                    {q.choices.map(c => (<li key={c.id}>• {c.id}) {c.text}</li>))}
                  </ul>
                  {q.explanation && <div className="mt-2 text-xs text-slate-500">Explanation: {q.explanation}</div>}
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={exportQTI}>Export QTI (Canvas)</Button>
              <Button onClick={exportCSV}>Export CSV</Button>
              <Button onClick={exportJSON}>Export JSON</Button>
            </div>
          </Card>

          <Card>
            <SectionTitle>Practice Mode</SectionTitle>
            <div className="mt-2"><QuizPlayer quiz={quiz} /></div>
          </Card>
        </>
      )}
    </main>
  );
}
