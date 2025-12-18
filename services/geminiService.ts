import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = 'gemini-2.5-flash';
// 默认优先使用用户配置（当前 deepseek-v3.2），回退到通义千问系列较稳的档位
const ALIYUN_MODEL = 'qwen-plus';
const ALIYUN_FALLBACK_MODELS = ['qwen-turbo','deepseek-v3.2', 'qwen-flash', 'qwen3-max', 'qwen-max'];
const ALIYUN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const TIMEOUT_MS = 20000;
const PREFER_ALIYUN = process.env.ALIYUN_ONLY === 'true' || process.env.USE_ALIYUN_FIRST === 'true';

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client && process.env.API_KEY) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

const getAliyunKey = () => process.env.ALIYUN_API_KEY;

const runWithTimeout = async <T>(promise: Promise<T>, timeoutMs = TIMEOUT_MS) => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeoutMs))
  ]);
};

const buildPrompt = (animeTitles: string[], rank: string) => `
    你现在不是在写文章，而是在为程序生成结构化数据。

    你的输出将被 JSON.parse 直接解析，因此：
    - 输出必须是唯一内容
    - 只能输出一个合法 JSON 对象
    - 不允许任何多余字符、说明、标题、换行前缀、表情或 Markdown
    - 如果无法满足某个分析要求，也必须返回完整 JSON，不得省略字段

    角色设定：
    你是一位资深、客观、非常懂行的老二次元动画鉴赏者（Anime Expert），具备系统性的动画审美分析能力与犀利判断。

    输入信息：
    - 用户已看过的动画列表（包含年份）：
      ${animeTitles.join(', ')}
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

    5. 补番处方（recommendations）
    - 必须是数组
    - 正好 3 个对象
    - 每个对象必须包含：
      - title：动画标题
      - reason：推荐理由
    - 推荐作品必须避开用户已看过的动画
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
        { "title": "示例C", "reason": "示例文本" }
      ]
    }
    
    再给你一个示例:
    {
      "tags": ["string", "string", "string", "string", "string", "string"],
      "analysis": "string",
      "personality": "string",
      "avoid": "string",
      "goldenEra": "string",
      "recommendations": [
        {
          "title": "string",
          "reason": "string"
        },
        {
          "title": "string",
          "reason": "string"
        },
        {
          "title": "string",
          "reason": "string"
        }
      ]
    }

    现在开始生成最终 JSON 输出。
  `;

const parseJsonSafe = (text?: string) => {
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

const ensureShape = (data: any) => {
  const safe = data || {};
  const fallbackText = '暂无数据';

  const tags = Array.isArray(safe.tags) ? safe.tags.slice(0, 6) : [];
  while (tags.length < 6) tags.push('待补充');

  let recs: Array<{ title: string; reason: string }> = [];
  if (Array.isArray(safe.recommendations)) {
    recs = safe.recommendations.slice(0, 3).map((r: any) => ({
      title: String(r?.title || '待补充'),
      reason: String(r?.reason || fallbackText)
    }));
  }
  while (recs.length < 3) {
    recs.push({ title: '待补充', reason: fallbackText });
  }

  let avoidList: Array<{ title: string; reason: string }> = [];
  if (Array.isArray(safe.avoid)) {
    avoidList = safe.avoid.slice(0, 3).map((a: any) => ({
      title: String(a?.title || '待补充'),
      reason: String(a?.reason || fallbackText)
    }));
  } else if (safe.avoid) {
    avoidList = [{ title: '待补充', reason: String(safe.avoid) }];
  }
  while (avoidList.length < 3) {
    avoidList.push({ title: '待补充', reason: fallbackText });
  }

  const normalized = {
    tags,
    analysis: String(safe.analysis || fallbackText),
    personality: String(safe.personality || fallbackText),
    avoid: avoidList,
    goldenEra: String(safe.goldenEra || fallbackText),
    recommendations: recs,
  };

  if (!normalized['roast'] && safe.analysis) {
    (normalized as any).roast = String(safe.analysis);
  } else if (safe.roast) {
    (normalized as any).roast = String(safe.roast);
  }

  return normalized;
};

const callGemini = async (prompt: string) => {
  const ai = getClient();
  if (!ai) {
    throw new Error("API Key missing");
  }

  const response = await runWithTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    })
  );

  return ensureShape(parseJsonSafe(response.text));
};

const callAliyunOnce = async (prompt: string, model: string) => {
  const apiKey = getAliyunKey();
  if (!apiKey) {
    throw new Error('ALIYUN_API_KEY missing');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const res = await fetch(ALIYUN_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    }),
    signal: controller.signal
  });

  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Aliyun API Error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Aliyun response empty');
  }
  return ensureShape(parseJsonSafe(content));
};

// Aliyun raw JSON helper (no shape normalization) for game endpoints
const callAliyunRaw = async (prompt: string) => {
  const apiKey = getAliyunKey();
  if (!apiKey) {
    throw new Error('ALIYUN_API_KEY missing');
  }

  const uniqueModels = [ALIYUN_MODEL, ...ALIYUN_FALLBACK_MODELS].filter((m, idx, arr) => m && arr.indexOf(m) === idx);
  let lastError: unknown;

  for (const model of uniqueModels) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(ALIYUN_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Aliyun API Error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Aliyun response empty');
      }
      return parseJsonSafe(content);
    } catch (err) {
      lastError = err;
      console.warn(`Aliyun (raw) model failed:`, err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Aliyun raw call failed');
};

const callAliyun = async (prompt: string) => {
  const apiKey = getAliyunKey();
  if (!apiKey) {
    throw new Error('ALIYUN_API_KEY missing');
  }

  const uniqueModels = [ALIYUN_MODEL, ...ALIYUN_FALLBACK_MODELS].filter(
    (m, idx, arr) => m && arr.indexOf(m) === idx
  );

  let lastError: unknown;
  for (const model of uniqueModels) {
    try {
      return await callAliyunOnce(prompt, model);
    } catch (err) {
      lastError = err;
      console.warn(`Aliyun model ${model} failed:`, err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Aliyun call failed');
};

const normalizeResult = (data: any) => {
  if (!data) return data;
  if (!data.roast && data.analysis) {
    data.roast = data.analysis;
  }
  return data;
};

export const analyzeAnimeTaste = async (animeTitles: string[], rank: string) => {
  const prompt = buildPrompt(animeTitles, rank);

  const tryGemini = async () => normalizeResult(await callGemini(prompt));
  const tryAliyun = async () => normalizeResult(await callAliyun(prompt));

  if (PREFER_ALIYUN) {
    try {
      return await tryAliyun();
    } catch (e) {
      console.warn('Aliyun preferred path failed, trying Gemini:', e);
      return await tryGemini();
    }
  }

  try {
    return await tryGemini();
  } catch (error) {
    console.warn('Gemini failed, falling back to Aliyun:', error);
    return await tryAliyun();
  }
};

// --- GAME SERVICE ---

export interface GameCharacter {
  name: string;
  source: string;
  hint: string;
}

export interface EmojiGameChallenge {
  title: string;
  emojis: string;
  hint: string;
}

export const startAnimeGame = async (): Promise<GameCharacter> => {
  const seed = Date.now() + Math.random();

  const prompt = `
    任务：随机选择一个来自日本动画（2000年-2024年）的角色。
    要求：
    1) 不要总是热门主角，要覆盖不同题材（日常/战斗/悬疑/运动/偶像）。
    2) 角色需有一定知名度，但不必是顶流。
    3) 随机种子：${seed}。

    返回 JSON：{
      "name": "角色全名 (中文)",
      "source": "作品名 (中文)",
      "hint": "一句决定性提示，不要直接包含名字"
    }
  `;

  const tryGemini = async () => {
    const ai = getClient();
    if (!ai) throw new Error("API Key missing");
    const response = await runWithTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      })
    );
    return parseJsonSafe(response.text);
  };

  if (PREFER_ALIYUN || !process.env.API_KEY) {
    try {
      return await callAliyunRaw(prompt);
    } catch (e) {
      console.warn('Aliyun game start failed, trying Gemini:', e);
      return await tryGemini();
    }
  }

  try {
    return await tryGemini();
  } catch (e) {
    console.warn('Gemini game start failed, trying Aliyun:', e);
    return await callAliyunRaw(prompt);
  }
};

export const startEmojiGame = async (): Promise<EmojiGameChallenge> => {
  const seed = Date.now() + Math.random();

  const prompt = `
    任务：随机选择一部日本动画（2000-2024）。
    返回标题，并用 3~5 个 Emoji 抽象描述核心元素。
    Emoji 需有辨识度但不要过于直白。
    随机种子：${seed}。

    返回 JSON：{
      "title": "动画标题 (中文)",
      "emojis": "Emoji 组合，如 🏴‍☠️👒🍖",
      "hint": "一句话提示 (中文)"
    }
  `;

  const tryGemini = async () => {
    const ai = getClient();
    if (!ai) throw new Error("API Key missing");
    const response = await runWithTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      })
    );
    return parseJsonSafe(response.text);
  };

  if (PREFER_ALIYUN || !process.env.API_KEY) {
    try {
      return await callAliyunRaw(prompt);
    } catch (e) {
      console.warn('Aliyun emoji game failed, trying Gemini:', e);
      return await tryGemini();
    }
  }

  try {
    return await tryGemini();
  } catch (e) {
    console.warn('Gemini emoji game failed, trying Aliyun:', e);
    return await callAliyunRaw(prompt);
  }
};

export const askGameOracle = async (secret: GameCharacter, question: string): Promise<{ answer: 'YES' | 'NO' | 'UNKNOWN', flavorText: string }> => {
  const prompt = `
    20 问游戏裁判。秘密角色：${secret.name}（出自：${secret.source}）。用户问：“${question}”。
    规则：
    - 不要泄漏未被询问的属性。
    - answer: YES/NO/UNKNOWN。
    - flavorText：中文，≤20 字，冷静或略神秘，不剧透。
    JSON: { "answer": "YES"|"NO"|"UNKNOWN", "flavorText": "string" }
  `;

  const tryGemini = async () => {
    const ai = getClient();
    if (!ai) throw new Error("API Key missing");
    const response = await runWithTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      })
    );
    return parseJsonSafe(response.text);
  };

  if (PREFER_ALIYUN || !process.env.API_KEY) {
    try {
      return await callAliyunRaw(prompt);
    } catch (e) {
      console.warn('Aliyun oracle failed, trying Gemini:', e);
      try {
        return await tryGemini();
      } catch {
        return { answer: 'UNKNOWN', flavorText: '(杂音) ...信号受到干扰...' };
      }
    }
  }

  try {
    return await tryGemini();
  } catch (error) {
    console.warn('Gemini oracle failed, trying Aliyun:', error);
    try {
      return await callAliyunRaw(prompt);
    } catch {
      return { answer: 'UNKNOWN', flavorText: '(杂音) ...信号受到干扰...' };
    }
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

  const tryGemini = async () => {
    const ai = getClient();
    if (!ai) throw new Error("API Key missing");
    const response = await runWithTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      })
    );
    const res = parseJsonSafe(response.text);
    return res.correct === true;
  };

  if (PREFER_ALIYUN || !process.env.API_KEY) {
    try {
      const res = await callAliyunRaw(prompt);
      return res.correct === true;
    } catch (e) {
      console.warn('Aliyun checkWin failed, trying Gemini:', e);
      try {
        return await tryGemini();
      } catch {
        return false;
      }
    }
  }

  try {
    return await tryGemini();
  } catch (error) {
    console.warn('Gemini checkWin failed, trying Aliyun:', error);
    try {
      const res = await callAliyunRaw(prompt);
      return res.correct === true;
    } catch {
      return false;
    }
  }
};