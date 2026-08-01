import { Anime } from '../types';
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
import { buildArchivePromptData, MAX_ARCHIVE_PROMPT_ENTRIES } from './archivePrompt';

export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEFAULT_DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 45_000;
const env = import.meta.env;
const DEEPSEEK_PROXY_URL = env.VITE_DEEPSEEK_PROXY_URL || '/api/deepseek/chat';
const SESSION_AI_CONFIG_KEY = 'anime-horizon-session-ai-config';
const LEGACY_SESSION_DEEPSEEK_KEY = 'anime-horizon-session-deepseek-key';

export type { SessionAIConfig, SessionAIProvider, TasteAnalysisResult } from '../shared/schemas/ai';
export { MAX_ARCHIVE_PROMPT_ENTRIES as MAX_TASTE_PROMPT_ENTRIES } from './archivePrompt';

type AIRequestSource = 'personal' | 'site';

export class AIRequestError extends Error {
  readonly source: AIRequestSource;
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options: { source: AIRequestSource; status?: number; code?: string }) {
    super(message);
    this.name = 'AIRequestError';
    this.source = options.source;
    this.status = options.status;
    this.code = options.code;
  }
}

const readErrorCode = async (res: Response) => {
  try {
    const payload = (await res.json()) as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : undefined;
  } catch {
    return undefined;
  }
};

const errorSourceLabel = (source: AIRequestSource) => (source === 'personal' ? '个人模型' : '站点默认 AI');

export const describeAIError = (error: unknown, source: AIRequestSource): string => {
  const requestError = error instanceof AIRequestError ? error : undefined;
  const status = requestError?.status;
  const code = requestError?.code;

  if (code === 'AI_NOT_CONFIGURED') return 'Render 未配置 DEEPSEEK_API_KEY，请在服务端环境变量中设置后重新部署。';
  if (code === 'CORS_FORBIDDEN') return 'Render 拒绝了当前网页来源，请检查 CORS_ORIGINS 是否填写了前端的完整 origin。';
  if (code === 'AI_UPSTREAM_AUTH' || status === 401 || status === 403)
    return `${errorSourceLabel(source)}拒绝了 API Key，请确认 Key 属于当前接口且没有被撤销。`;
  if (code === 'AI_UPSTREAM_BALANCE' || status === 402)
    return `${errorSourceLabel(source)}余额不足或账户未开通 API 计费，请检查供应商控制台。`;
  if (code === 'AI_UPSTREAM_INVALID_REQUEST' || status === 404 || status === 422)
    return `${errorSourceLabel(source)}拒绝了模型或请求参数，请检查模型名与 Chat Completions 地址。`;
  if (code === 'AI_UPSTREAM_RATE_LIMITED' || status === 429) return `${errorSourceLabel(source)}触发限流，请稍后再试。`;
  if (code === 'AI_TIMEOUT' || (error instanceof DOMException && error.name === 'AbortError'))
    return `${errorSourceLabel(source)}响应超时。年鉴较大时请稍后重试，或检查服务端的 AI_TIMEOUT_MS。`;
  if (source === 'personal' && (!requestError || requestError.status === undefined))
    return '个人模型无法连接。若 Key 和余额正常，通常是接口不允许浏览器跨域（CORS）或地址填写错误；也可以恢复站点默认服务。';
  return '站点 AI 暂时不可用，请检查 Render 部署、Key、CORS_ORIGINS 和网络后重试。';
};

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
      endpoint: DEFAULT_DEEPSEEK_ENDPOINT,
      model: DEFAULT_DEEPSEEK_MODEL,
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
const rememberRecent = (bucket: string[], value: string, max = 6) => {
  if (!value) return;
  if (bucket.includes(value)) return;
  bucket.unshift(value);
  if (bucket.length > max) bucket.pop();
};

export const buildTasteAnalysisPrompt = (anime: Anime[] | string[], rank: string) => {
  const isArchive = anime.every((item): item is Anime => typeof item !== 'string');
  const archiveData = isArchive ? buildArchivePromptData(anime) : null;
  const quickEntries = isArchive
    ? []
    : anime.slice(0, MAX_ARCHIVE_PROMPT_ENTRIES).map((item) => `- ${item}（来自快速测评，未提供状态与短评）`);
  const indexText = archiveData?.indexText || quickEntries.join('\n') || '无';
  const highlightText =
    archiveData?.highlightText || '与上方快速测评输入相同；未提供可用于作品举例的状态、态度或短评。';
  const archiveCount = archiveData?.sourceCount ?? quickEntries.length;
  const includedCount = archiveData?.includedCount ?? quickEntries.length;
  const statusSummary = archiveData
    ? `已看完 ${archiveData.statusCounts.COMPLETED} 部；追更 ${archiveData.statusCounts.WATCHING} 部；想看 ${archiveData.statusCounts.PLAN} 部`
    : '快速测评输入未提供观看状态';
  const evidenceSummary = archiveData
    ? `其中 ${archiveData.reviewCount} 部写过短评，本次选取 ${archiveData.highlightCount} 部作为重点证据`
    : '快速测评输入未提供短评';
  const evidenceInstruction =
    archiveData && archiveData.statusCounts.COMPLETED + archiveData.statusCounts.WATCHING >= 2
      ? '深度鉴赏至少引用 2~3 部索引中状态为追更/已看完的作品。'
      : '当前追更/已看完证据不足，不要假装用户看过作品；请明确说明样本不足，并只基于索引、题材和用户明确输入做克制推断。';

  return `
    你是资深、客观且懂制作与叙事的动画鉴赏者。请根据用户主动建立的年鉴，生成可靠、有证据的结构化鉴赏结果。

    这是一次 JSON 输出任务。最终回复只能是一个合法 JSON 对象，不能有 Markdown、解释、前后缀或额外字段。即使证据不足，也必须保留全部字段并用“暂无数据”说明，不能编造用户没有看过或评价过的细节。

    用户画像等级：${rank}
    年鉴记录：${archiveCount} 部；本次完整索引纳入：${includedCount} 部。
    观看状态统计：${statusSummary}
    评价证据统计：${evidenceSummary}

    【完整作品索引】
    下面的索引用于覆盖全部作品、识别别名、排除重复推荐。每行包含作品名、别名、年份、用户状态、用户态度和题材：
    ${indexText}

    【重点证据】
    以下记录优先包含已看完/追更、明确喜欢或不喜欢、以及写过短评的作品。深度鉴赏和人格侧写应优先从这里举例，但不要把重点样本误当成全部年鉴：
    ${highlightText}

    证据边界：
    - “想看”只能说明愿望，不能当作用户已经看过或喜欢。
    - “追更/已看完”才可用于观看经历；“非常喜欢/喜欢/不太喜欢/不喜欢”和短评才可用于强烈价值判断。
    - 短评是重点证据而不是必填项；没有短评的作品仍须依据观看状态、明确态度、题材、年份和索引位置参与整体归纳，不要因为没有逐部点评就忽略它们。
    - 只引用索引中确实存在的作品名，不要虚构用户短评、剧情细节、台词或观看经历。
    - 作品名的别名也视为已出现作品；推荐时避开完整索引中的标题、别名、续作、重制版、总集篇和同系列条目。
    - 如果只能根据 AniList 的年份和题材做推断，请明确使用“可能/倾向于”等措辞。

    输出字段要求：
    - tags：正好 6 个 2~5 个汉字的审美标签，必须从年鉴证据归纳，不要照抄示例。
    - analysis：分段、具体的深度点评，${evidenceInstruction} 比较人物、叙事、演出、配乐或情绪密度，并指出审美偏执点。
    - personality：基于真实观看与评价信号的克制侧写，至少引用 1~2 部重点证据；不要把娱乐偏好当成确定的人格诊断或现实履历。
    - avoid：正好 3 个 {"title":"动画标题","reason":"具体避雷理由"}，理由要与用户已表现出的偏好冲突相关。
    - goldenEra：结合年份、题材和作品定位给出审美集中年代，并说明依据。
    - recommendations：正好 8 个不重复的 {"title":"动画标题","reason":"为什么与该用户的具体口味匹配"}，严格排除完整索引及其别名和同系列作品。

    JSON 结构必须严格如下：
    {
      "tags": ["标签1", "标签2", "标签3", "标签4", "标签5", "标签6"],
      "analysis": "深度点评",
      "personality": "克制侧写",
      "avoid": [
        { "title": "作品A", "reason": "原因" },
        { "title": "作品B", "reason": "原因" },
        { "title": "作品C", "reason": "原因" }
      ],
      "goldenEra": "年代判断及依据",
      "recommendations": [
        { "title": "作品D", "reason": "推荐理由" },
        { "title": "作品E", "reason": "推荐理由" },
        { "title": "作品F", "reason": "推荐理由" },
        { "title": "作品G", "reason": "推荐理由" },
        { "title": "作品H", "reason": "推荐理由" },
        { "title": "作品I", "reason": "推荐理由" },
        { "title": "作品J", "reason": "推荐理由" },
        { "title": "作品K", "reason": "推荐理由" }
      ]
    }

    现在只输出最终 JSON。
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
      const code = await readErrorCode(res);
      throw new AIRequestError(`Personal AI API Error ${res.status}`, {
        source: 'personal',
        status: res.status,
        code,
      });
    }

    const data = chatCompletionResponseSchema.parse(await res.json());
    return parseJsonSafe(data.choices[0].message.content);
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIRequestError('Personal AI request timed out', { source: 'personal', code: 'AI_TIMEOUT' });
    }
    throw new AIRequestError('Personal AI request could not reach the endpoint', { source: 'personal' });
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
      const code = await readErrorCode(res);
      throw new AIRequestError(`DeepSeek proxy error ${res.status}`, {
        source: 'site',
        status: res.status,
        code,
      });
    }

    const data = chatCompletionResponseSchema.parse(await res.json());
    return parseJsonSafe(data.choices[0].message.content);
  };

  try {
    return await callServerProxy();
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIRequestError('Site AI request timed out', { source: 'site', code: 'AI_TIMEOUT' });
    }
    throw new AIRequestError('Site AI request could not reach the proxy', { source: 'site' });
  }
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
