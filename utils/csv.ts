import type { Quiz } from '@/lib/types';

export function quizToCsv(quiz: Quiz): string {
  const header = ['Question','A','B','C','D','Correct','Explanation'];
  const rows = quiz.questions.map(q => {
    const map = Object.fromEntries(q.choices.map(c => [c.id, c.text]));
    return [q.prompt, map['A'], map['B'], map['C'], map['D'], q.correctChoiceId, q.explanation ?? ''];
  });
  return [header, ...rows]
    .map(r => r.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
}
