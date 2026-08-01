import { describe, expect, it } from 'vitest';
import { buildTasteAnalysisPrompt, MAX_TASTE_PROMPT_ENTRIES, normalizeTasteAnalysis } from '../services/geminiService';
import { sessionAIConfigSchema } from '../shared/schemas/ai';

describe('AI data boundary', () => {
  it('accepts secure personal endpoints and rejects public HTTP endpoints', () => {
    expect(
      sessionAIConfigSchema.parse({
        provider: 'DEEPSEEK',
        apiKey: 'session-key',
        endpoint: 'https://api.example.com/v1/chat/completions',
        model: 'example-model',
      }).endpoint
    ).toContain('https://');

    expect(() =>
      sessionAIConfigSchema.parse({
        provider: 'DEEPSEEK',
        apiKey: 'session-key',
        endpoint: 'http://api.example.com/chat',
        model: 'example-model',
      })
    ).toThrow();
  });

  it('normalizes incomplete model output into the stable UI shape', () => {
    const result = normalizeTasteAnalysis({ tags: ['标签'], analysis: '分析文本' });

    expect(result.tags).toHaveLength(6);
    expect(result.avoid).toHaveLength(3);
    expect(result.recommendations).toHaveLength(8);
    expect(result.roast).toBe('分析文本');
  });

  it('bounds archive data included in an AI prompt', () => {
    const prompt = buildTasteAnalysisPrompt(
      Array.from({ length: MAX_TASTE_PROMPT_ENTRIES + 10 }, (_, index) => `作品 ${index}`),
      '动画爱好者'
    );

    expect(prompt.match(/来自快速测评/g)).toHaveLength(MAX_TASTE_PROMPT_ENTRIES);
    expect(prompt.length).toBeLessThan(16_000);
  });
});
