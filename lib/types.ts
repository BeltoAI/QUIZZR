import { z } from 'zod';

export const ChoiceSchema = z.object({
  id: z.enum(['A','B','C','D']),
  text: z.string().min(1),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('mcq'),
  prompt: z.string().min(1),
  choices: z.array(ChoiceSchema).length(4),
  correctChoiceId: z.enum(['A','B','C','D']),
  explanation: z.string().optional(),
});

export const QuizSchema = z.object({
  title: z.string(),
  description: z.string(),
  metadata: z.object({
    topic: z.string(),
    difficulty: z.enum(['easy','medium','hard']),
    numQuestions: z.number().int().min(1),
  }),
  questions: z.array(QuestionSchema).min(1),
});

export type Choice = z.infer<typeof ChoiceSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
