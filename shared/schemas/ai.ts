import { z } from 'zod';

export const sessionAIProviderSchema = z.enum(['DEEPSEEK', 'OPENAI_COMPATIBLE']);

export const sessionAIConfigSchema = z.object({
  provider: sessionAIProviderSchema,
  apiKey: z.string().trim().min(1).max(512),
  endpoint: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      );
    }, '个人模型地址必须使用 HTTPS（本机开发可使用 HTTP）'),
  model: z.string().trim().min(1).max(128),
});

export type SessionAIConfig = z.infer<typeof sessionAIConfigSchema>;
export type SessionAIProvider = z.infer<typeof sessionAIProviderSchema>;

const analysisItemSchema = z
  .object({
    title: z.string().trim().max(200),
    reason: z.string().trim().max(1_200),
  })
  .passthrough();

export const tasteAnalysisPayloadSchema = z
  .object({
    tags: z.array(z.string().trim().max(40)).max(12).optional().default([]),
    roast: z.string().max(6_000).optional(),
    analysis: z.string().max(6_000).optional(),
    personality: z.string().max(6_000).optional(),
    avoid: z.union([z.array(analysisItemSchema).max(12), z.string().max(2_000)]).optional(),
    goldenEra: z.string().max(2_000).optional(),
    recommendations: z.array(analysisItemSchema).max(20).optional().default([]),
  })
  .passthrough();

export const normalizedTasteAnalysisSchema = z.object({
  tags: z.array(z.string().max(40)).length(6),
  roast: z.string().max(6_000),
  personality: z.string().max(6_000),
  avoid: z.array(analysisItemSchema).length(3),
  goldenEra: z.string().max(2_000),
  recommendations: z.array(analysisItemSchema).length(8),
});

export type TasteAnalysisResult = z.infer<typeof normalizedTasteAnalysisSchema>;

export const gameCharacterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(200),
  hint: z.string().trim().max(500),
});
export type GameCharacter = z.infer<typeof gameCharacterSchema>;

export const emojiGameChallengeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  emojis: z.string().trim().max(100),
  hint: z.string().trim().max(500),
});
export type EmojiGameChallenge = z.infer<typeof emojiGameChallengeSchema>;

export const chatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().min(1) }).passthrough(),
          })
          .passthrough()
      )
      .min(1),
  })
  .passthrough();

export const oracleResponseSchema = z.object({
  answer: z.enum(['YES', 'NO', 'UNKNOWN']).catch('UNKNOWN'),
  flavorText: z.string().trim().max(200).catch('信号稳定，但答案仍在雾中。'),
});

export const gameWinResponseSchema = z.object({ correct: z.boolean() }).passthrough();
