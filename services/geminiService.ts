import { Anime, UserAnimeReaction, UserAnimeStatus } from '../types';
import {
  chatCompletionResponseSchema,
  EmojiGameChallenge,
  emojiGameChallengeSchema,
  GameCharacter,
  gameCharacterSchema,
  gameWinResponseSchema,
  normalizedTasteAnalysisSchema,
  oracleResponseSchema,
  sessionAIConfigSchema,
  tasteAnalysisPayloadSchema,
  TasteAnalysisResult,
  SessionAIConfig,
} from '../shared/schemas/ai';

const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 12000;
const env = import.meta.env;
const DEEPSEEK_PROXY_URL = env.VITE_DEEPSEEK_PROXY_URL || '/api/deepseek/chat';
const SESSION_AI_CONFIG_KEY = 'anime-horizon-session-ai-config';
const LEGACY_SESSION_DEEPSEEK_KEY = 'anime-horizon-session-deepseek-key';

export type { SessionAIConfig, SessionAIProvider, TasteAnalysisResult } from '../shared/schemas/ai';

export const getSessionAIConfig = (): SessionAIConfig | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_AI_CONFIG_KEY);
    if (raw) {
      const parsed = sessionAIConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }

    const legacyKey = window.sessionStorage.getItem(LEGACY_SESSION_DEEPSEEK_KEY)?.trim();
    if (!legacyKey) return null;
    const parsed = sessionAIConfigSchema.safeParse({
      provider: 'DEEPSEEK',
      apiKey: legacyKey,
      endpoint: DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const setSessionAIConfig = (config: SessionAIConfig) => {
  if (typeof window === 'undefined') return;
  const normalized = sessionAIConfigSchema.parse(config);
  window.sessionStorage.setItem(SESSION_AI_CONFIG_KEY, JSON.stringify(normalized));
  window.sessionStorage.removeItem(LEGACY_SESSION_DEEPSEEK_KEY);
};

export const clearSessionAIConfig = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_AI_CONFIG_KEY);
  window.sessionStorage.removeItem(LEGACY_SESSION_DEEPSEEK_KEY);
};

export const isUsingSessionAIConfig = () => Boolean(getSessionAIConfig());

// Simple in-memory recency buckets to reduce repetition
const recentEmojiTitles: string[] = [];
export const MAX_TASTE_PROMPT_ENTRIES = 32;
const clampPromptText = (value: string, max: number) => value.slice(0, max);
const rememberRecent = (bucket: string[], value: string, max = 6) => {
  if (!value) return;
  if (bucket.includes(value)) return;
  bucket.unshift(value);
  if (bucket.length > max) bucket.pop();
};

const statusLabels: Record<UserAnimeStatus, string> = {
  PLAN: '想看',
  WATCHING: '追更',
  COMPLETED: '已看完',
};

const reactionLabels: Record<UserAnimeReaction, string> = {
  LOVE: '非常喜欢',
  LIKE: '喜欢',
  NEUTRAL: '一般',
  DISLIKE: '不太喜欢',
  HATE: '不喜欢',
};

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

const toPromptEntry = (anime: Anime) => {
  const status = statusLabels[anime.userStatus || 'PLAN'];
  const reaction = reactionLabels[anime.userReaction || 'NEUTRAL'];
  const aliases = clampPromptText(
    [anime.title.native, anime.title.romaji, anime.title.english].filter(Boolean).join(' / '),
    240
  );
  const note = anime.userNote?.trim() ? `；短评：${clampPromptText(anime.userNote.trim(), 120)}` : '';
  const genres = clampPromptText(anime.genres?.join(' / ') || '未知', 180);
  return `- ${clampPromptText(getTitle(anime), 120)}（别名：${aliases}；${anime.seasonYear || '年份未知'}；${status}；${reaction}；题材：${genres}${note}）`;
};

export const buildTasteAnalysisPrompt = (anime: Anime[] | string[], rank: string) => {
  const entries = anime
    .slice(0, MAX_TASTE_PROMPT_ENTRIES)
    .map((item) => (typeof item === 'string' ? `- ${item}（来自快速测评，未提供状态与短评）` : toPromptEntry(item)));
  return `
    你现在不是在写文章，而是在为程序生成结构化数据。

    你的输出将被 JSON.parse 直接解析，因此：
    - 输出必须是唯一内容
    - 只能输出一个合法 JSON 对象
    - 不允许任何多余字符、说明、标题、换行前缀、表情或 Markdown
    - 如果无法满足某个分析要求，也必须返回完整 JSON，不得省略字段

    角色设定：
    你是一位资深、客观、非常懂行的老二次元动画鉴赏者（Anime Expert），具备系统性的动画审美分析能力与犀利判断。

    输入信息：
    - 用户年鉴（作品、状态、喜欢程度、短评均为用户主动留下的信息）：
      ${entries.join('\n') || '无'}
    - 用户等级：
      ${rank}

    分析要求（所有内容必须体现在返回的 JSON 中，一个都不能省略）：

    1. 成分标签（tags）
    - 必须是数组
    - 正好 6 个元素
    - 每个元素为 2~5 个汉字
    - 用于概括用户的二次元属性与审美取向
    - 可以参考以下示例生成风格相近的标签：
      京蜜, 音乐迷, 日常向, 情感派, 剧情向, 萌豚厨
    - 不要直接盲目使用示例中的标签，必须根据用户已看作品生成标签,如果用户看的作品符合上面的标签风格，可以使用类似风格的标签，但不要重复示例中的标签

    2. 深度鉴赏（analysis）
    - 输出风格必须体现“老二次元”犀利评论口吻
    - 结合至少 2~3 部用户看过的番剧或轻小说做举例对比
    - 分析用户口味核心逻辑：人物塑造、叙事结构、演出风格、情绪密度等
    - 指出用户审美中的独特偏执点（作画 / 配乐 / 题材执念等）
    - 内容要充分展开，避免一两句话带过

    3. 现实人格侧写（personality）
    - 同样用“老二次元”语气，段落化描述
    - 基于观影偏好推测性格、思维方式、处事风格
    - 结合已看作品举例说明其心理或行为倾向
    - 可推测学习/工作取向，但必须给出逻辑依据

    4. 避雷预警（avoid）
    - 必须是数组，正好 3 个对象
    - 每个对象包含：
      - title：动画标题
      - reason：原因（节奏、价值观或演出方式等）
    - 需要点名具体作品，作为反面教材

    5. 补番候选（recommendations）
    - 必须是数组
    - 正好 8 个对象，按推荐优先级排列
    - 每个对象必须包含：
      - title：动画标题
      - reason：推荐理由
    - 推荐作品必须严格避开用户年鉴中出现的所有标题与别名；不得推荐同一作品的续作、重制版、总集篇或电影版
    - 8 部作品标题不得重复，也不得是同一系列的不同条目
    - 每条推荐都必须解释“为什么该用户会吃这一套”

    6. 黄金年代判定（goldenEra）
    - 判断用户动画审美最集中的年代区间
    - 不只是给出年份，而要结合用户观看列表的番剧分析：
      - 这些作品的定位群体,剧情,制作水平等性质
      - 哪些年份的作品风格或类型与用户偏好最吻合
    - 用一句总结性判断给出结论，同时必须包含逻辑解释

    语言风格要求（仅体现在字段内容中）：
    - 中文
    - 一针见血
    - 专业但不说教
    - 可轻微犀利或幽默，但禁止玩梗与夸张表达

    返回格式要求（严格遵守）：
    - 必须严格返回合法 JSON
    - 不要包含任何 Markdown 语法
    - 不要包含任何解释性文字
    - 所有字段必须存在
    - JSON 结构必须与下方完全一致

    示例结构（仅示意结构，内容需重新生成）：
    {
      "tags": ["示例一", "示例二", "示例三", "示例四", "示例五", "示例六"],
      "analysis": "示例文本",
      "personality": "示例文本",
      "avoid": [
        { "title": "示例X", "reason": "示例原因" },
        { "title": "示例Y", "reason": "示例原因" },
        { "title": "示例Z", "reason": "示例原因" }
      ],
      "goldenEra": "示例文本",
      "recommendations": [
        { "title": "示例A", "reason": "示例文本" },
        { "title": "示例B", "reason": "示例文本" },
        { "title": "示例C", "reason": "示例文本" },
        { "title": "示例D", "reason": "示例文本" },
        { "title": "示例E", "reason": "示例文本" },
        { "title": "示例F", "reason": "示例文本" },
        { "title": "示例G", "reason": "示例文本" },
        { "title": "示例H", "reason": "示例文本" }
      ]
    }
    
    现在开始生成最终 JSON 输出。
  `;
};

const parseJsonSafe = (text?: string): unknown => {
  if (!text) throw new Error('Empty response');
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw e;
  }
};

export const normalizeTasteAnalysis = (source: unknown): TasteAnalysisResult => {
  const data = typeof source === 'string' ? parseJsonSafe(source) : source;
  const safe = tasteAnalysisPayloadSchema.parse(data || {});
  const fallbackText = '暂无数据';

  const tags = safe.tags.slice(0, 6).map((tag) => tag || '待补充');
  while (tags.length < 6) tags.push('待补充');

  const recs = safe.recommendations.slice(0, 8).map((recommendation) => ({
    title: recommendation.title || '待补充',
    reason: recommendation.reason || fallbackText,
  }));
  while (recs.length < 8) {
    recs.push({ title: '待补充', reason: fallbackText });
  }

  const avoidList = Array.isArray(safe.avoid)
    ? safe.avoid.slice(0, 3).map((avoid) => ({
        title: avoid.title || '待补充',
        reason: avoid.reason || fallbackText,
      }))
    : safe.avoid
      ? [{ title: '待补充', reason: safe.avoid }]
      : [];
  while (avoidList.length < 3) {
    avoidList.push({ title: '待补充', reason: fallbackText });
  }

  return normalizedTasteAnalysisSchema.parse({
    tags,
    roast: safe.roast || safe.analysis || fallbackText,
    personality: safe.personality || fallbackText,
    avoid: avoidList,
    goldenEra: safe.goldenEra || fallbackText,
    recommendations: recs,
  });
};

const callSessionAI = async (prompt: string, config: SessionAIConfig) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        ...(config.provider === 'DEEPSEEK' ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      await res.arrayBuffer();
      throw new Error(`Personal AI API Error ${res.status}`);
    }

    const data = chatCompletionResponseSchema.parse(await res.json());
    return parseJsonSafe(data.choices[0].message.content);
  } finally {
    clearTimeout(timer);
  }
};

const callDeepSeekRaw = async (prompt: string) => {
  const sessionConfig = getSessionAIConfig();
  if (sessionConfig) {
    // A personal session provider must never fall back to the site account after it is enabled.
    return callSessionAI(prompt, sessionConfig);
  }

  const callServerProxy = async () => {
    const res = await fetch(DEEPSEEK_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      await res.arrayBuffer();
      throw new Error(`DeepSeek proxy error ${res.status}`);
    }

    const data = chatCompletionResponseSchema.parse(await res.json());
    return parseJsonSafe(data.choices[0].message.content);
  };

  return callServerProxy();
};

const callDeepSeek = async (prompt: string) => normalizeTasteAnalysis(await callDeepSeekRaw(prompt));

export const analyzeAnimeTaste = async (anime: Anime[] | string[], rank: string) => {
  const prompt = buildTasteAnalysisPrompt(anime, rank);
  return callDeepSeek(prompt);
};

// --- GAME SERVICE ---

export type { EmojiGameChallenge, GameCharacter } from '../shared/schemas/ai';

const cleanGameText = (value: unknown, blockedWords: string[] = []) => {
  let text = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  blockedWords.filter(Boolean).forEach((word) => {
    text = text.split(word).join('这个角色');
  });
  return text.replace(/出自[^，。；;]{0,24}/g, '这部作品').slice(0, 32);
};

const normalizeCharacter = (value: unknown): GameCharacter => {
  const parsed = gameCharacterSchema.safeParse(value);
  if (!parsed.success) return { name: '未知角色', source: '未知作品', hint: '先从角色的行为和关系入手。' };
  return {
    ...parsed.data,
    hint: cleanGameText(parsed.data.hint, [parsed.data.name, parsed.data.source]),
  };
};

export const startAnimeGame = async (): Promise<GameCharacter> => {
  const seed = Date.now() + Math.random();

  const prompt = `
    任务：随机选择一个来自日本动画（2000年-2024年）的角色。
    要求：
    1) 不要总是热门主角，要覆盖不同题材（日常/战斗/悬疑/运动/偶像）。
    2) 角色需有一定知名度，但不必是顶流。
    3) 随机种子：${seed}。
    4) hint 是给玩家的线索，只能描述角色的性格、行为、关系或身份特征。
    5) hint 严禁出现角色姓名、作品名、作者名、声优名、角色专属名词或“出自某作品”等来源信息。

    返回 JSON：{
      "name": "角色全名 (中文)",
      "source": "作品名 (中文)",
      "hint": "一句不含答案和作品来源的决定性提示"
    }
  `;

  return normalizeCharacter(await callDeepSeekRaw(prompt));
};

export const startEmojiGame = async (): Promise<EmojiGameChallenge> => {
  const makeSeed = () => Date.now() + Math.random();
  let seed = makeSeed();

  const buildPrompt = (currentSeed: number) => `
    任务：随机选择一部日本动画（2000-2024）。
    返回标题，并用 3~5 个 Emoji 抽象描述核心元素。
    Emoji 需有辨识度但不要过于直白。
    避免重复这些最近出现的题目：${recentEmojiTitles.join(', ') || '无'}。
    随机种子：${currentSeed}。

    返回 JSON：{
      "title": "动画标题 (中文)",
      "emojis": "Emoji 组合，如 🏴‍☠️👒🍖",
      "hint": "一句话提示 (中文)"
    }
  `;

  const runOnce = async (currentSeed: number) => callDeepSeekRaw(buildPrompt(currentSeed));

  // Avoid repeated hot titles by rerolling if recently served
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await runOnce(seed);
    const parsed = emojiGameChallengeSchema.safeParse(result);
    const title = parsed.success ? parsed.data.title : '';
    if (!title || !recentEmojiTitles.includes(title) || attempt === 2) {
      rememberRecent(recentEmojiTitles, title);
      if (parsed.success) return parsed.data;
      return { title: '未知作品', emojis: '🎬❓', hint: '先从作品的气质和题材入手。' };
    }
    seed = makeSeed();
  }

  // Fallback: single fetch
  const res = await runOnce(seed);
  const parsed = emojiGameChallengeSchema.safeParse(res);
  rememberRecent(recentEmojiTitles, parsed.success ? parsed.data.title : '');
  return parsed.success ? parsed.data : { title: '未知作品', emojis: '🎬❓', hint: '先从作品的气质和题材入手。' };
};

export const askGameOracle = async (
  secret: GameCharacter,
  question: string
): Promise<{ answer: 'YES' | 'NO' | 'UNKNOWN'; flavorText: string }> => {
  const prompt = `
    20 问游戏裁判。内部秘密角色：${secret.name}，内部作品：${secret.source}。用户问：“${question}”。
    规则：
    - 角色名和作品名只是内部判定资料，绝对不能出现在回答中。
    - 不要泄漏用户没有询问的属性，不要补充角色名、作品名、作者、声优或作品来源。
    - 不要引用原作台词、专有名词或任何可以直接反查答案的短语。
    - answer: YES/NO/UNKNOWN。
    - flavorText：中文，≤20 字，只对用户问题做克制回应，不能出现任何人名、作品名或“出自……”等来源信息。
    JSON: { "answer": "YES"|"NO"|"UNKNOWN", "flavorText": "string" }
  `;

  const normalizeOracle = (value: unknown) => {
    const parsed = oracleResponseSchema.parse(value);
    return {
      answer: parsed.answer,
      flavorText: cleanGameText(parsed.flavorText, [secret.name, secret.source]),
    };
  };

  try {
    return normalizeOracle(await callDeepSeekRaw(prompt));
  } catch {
    return { answer: 'UNKNOWN', flavorText: '(杂音) ...信号受到干扰...' };
  }
};

export const checkGameWin = async (secret: GameCharacter | EmojiGameChallenge, userGuess: string): Promise<boolean> => {
  const targetName = 'name' in secret ? secret.name : secret.title;
  const targetSource = 'source' in secret ? secret.source : '';

  const prompt = `
    答案：${targetName} ${targetSource ? `(出自: ${targetSource})` : ''}
    用户猜测：“${userGuess}”。
    严格判断是否猜对名称/标题，允许常见外号或轻微错别字。
    JSON: { "correct": boolean }
  `;

  try {
    const res = await callDeepSeekRaw(prompt);
    return gameWinResponseSchema.safeParse(res).success && gameWinResponseSchema.parse(res).correct;
  } catch {
    return false;
  }
};
