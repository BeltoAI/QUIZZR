'use client';
import { useMemo, useState } from 'react';
import type { Quiz } from '@/lib/types';
import { Button } from './UI';

export default function QuizPlayer({ quiz }: { quiz: Quiz }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = quiz.questions[idx];
  const total = quiz.questions.length;
  const progress = useMemo(() => Math.round((idx / total) * 100), [idx, total]);

  function submit() {
    if (!selected) return;
    if (selected === q.correctChoiceId) setScore((s) => s + 1);
    if (idx + 1 < total) { setIdx((i) => i + 1); setSelected(null); } else { setDone(true); }
  }

  if (done) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="text-center">
        <div className="mb-2 text-4xl font-semibold">{pct}%</div>
        <div className="text-slate-600">Score: {score} / {total}</div>
        <div className="mt-4">
          <Button onClick={() => { setIdx(0); setSelected(null); setScore(0); setDone(false); }}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-sm text-slate-500">Question {idx + 1} / {total}</div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-slate-900" style={{ width: `${progress}%` }} />
      </div>
      <div className="mb-4 text-lg font-medium">{q.prompt}</div>
      <div className="grid gap-3">
        {q.choices.map((c) => (
          <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected === c.id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <input type="radio" className="mt-1" name="choice" checked={selected === c.id} onChange={() => setSelected(c.id)} />
            <div className="font-medium">{c.id}. {c.text}</div>
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm text-slate-500">Selected: {selected ?? '—'}</div>
        <Button onClick={submit} disabled={!selected}>Submit</Button>
      </div>
    </div>
  );
}
