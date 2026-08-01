import { describe, expect, it } from 'vitest';
import {
  AIRequestError,
  buildTasteAnalysisPrompt,
  describeAIError,
  MAX_TASTE_PROMPT_ENTRIES,
  normalizeTasteAnalysis,
} from '../services/geminiService';
import { buildPortraitImagePrompt } from '../services/chatgptBridge';
import { buildTasteProfile } from '../services/tasteProfile';
import { sessionAIConfigSchema } from '../shared/schemas/ai';
import { Anime } from '../types';

const anime = (index: number, overrides: Partial<Anime> = {}): Anime => ({
  id: String(index),
  title: { native: `作品 ${index}`, romaji: `Work ${index}`, english: `Work ${index}` },
  coverImage: { extraLarge: '', large: '', color: '' },
  season: 'SPRING',
  seasonYear: 2020,
  genres: ['Drama'],
  userStatus: 'COMPLETED',
  userReaction: 'LIKE',
  ...overrides,
});

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

  it('explains provider failures without exposing credentials or upstream bodies', () => {
    const message = describeAIError(
      new AIRequestError('upstream failure', { source: 'personal', status: 402 }),
      'personal'
    );

    expect(message).toContain('余额不足');
    expect(message).not.toContain('upstream failure');
  });

  it('bounds archive data included in an AI prompt', () => {
    const prompt = buildTasteAnalysisPrompt(
      Array.from({ length: MAX_TASTE_PROMPT_ENTRIES + 10 }, (_, index) => `作品 ${index}`),
      '动画爱好者'
    );

    expect(prompt.match(/来自快速测评/g)).toHaveLength(MAX_TASTE_PROMPT_ENTRIES);
    expect(prompt.length).toBeLessThan(60_000);
  });

  it('keeps the complete archive index while adding high-signal evidence', () => {
    const archive = Array.from({ length: 432 }, (_, index) => anime(index));
    archive[0] = anime(0, { userNote: '这部作品的演出和配乐让我印象很深。' });

    const prompt = buildTasteAnalysisPrompt(archive, '老二次元');

    expect(prompt).toContain('完整作品索引');
    expect(prompt).toContain('作品 0');
    expect(prompt).toContain('作品 431');
    expect(prompt).toContain('这部作品的演出和配乐让我印象很深。');
    expect(prompt.length).toBeLessThan(60_000);
  });

  it('prioritizes reviews without requiring one for every archived title', () => {
    const archive = [anime(1, { userNote: '重点短评' }), anime(2, { userNote: undefined, userReaction: 'NEUTRAL' })];
    const prompt = buildTasteAnalysisPrompt(archive, '动画爱好者');

    expect(prompt).toContain('其中 1 部写过短评');
    expect(prompt).toContain('没有短评的作品仍须依据观看状态');
    expect(prompt).toContain('重点短评');
    expect(prompt).toContain('作品 2');
  });

  it('includes the full archive context in the ChatGPT image prompt', () => {
    const archive = Array.from({ length: 80 }, (_, index) => anime(index));
    const prompt = buildPortraitImagePrompt('全站鉴赏画像', archive, buildTasteProfile(archive));

    expect(prompt).toContain('作品 0');
    expect(prompt).toContain('作品 79');
    expect(prompt).toContain('完整索引');
  });
});
