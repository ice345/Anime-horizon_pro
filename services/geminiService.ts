import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client && process.env.API_KEY) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const analyzeAnimeTaste = async (animeTitles: string[], rank: string) => {
  const ai = getClient();
  if (!ai) {
    throw new Error("API Key missing");
  }

  const prompt = `
    你是一位资深、客观、非常懂行的老二次元(Anime Expert),具备系统性的动画鉴赏能力与犀利判断。

    用户目前看过的动画列表（包含年份）：
    ${animeTitles.join(', ')}

    他们根据观看数量获得的等级是：
    "${rank}"

    请你基于上述信息，分析用户的【二次元成分】与审美倾向。

    分析要求如下（所有内容都必须体现在返回的 JSON 中）：

    1. 成分标签  
      - 给出 4 个简短、有辨识度的中文标签  
      - 每个标签 2~5 个字  
      - 用于概括用户的二次元属性与审美取向  

    2. 深度鉴赏  
      - 不要简单罗列作品  
      - 分析用户口味的核心逻辑（例如更偏重人物塑造、叙事结构、演出风格等）  
      - 指出用户审美中的独特或偏执点（例如对作画、配乐、情绪密度、题材的特殊执念）  

    3. 现实人格侧写  
      - 基于其观影偏好  
      - 推测用户在现实中的性格特征、思维方式  
      - 可适度推测其学习/工作取向或处事风格  
      - 允许一定主观判断，但需有逻辑依据  

    4. 避雷预警  
      - 明确指出 1~2 类用户大概率看不下去的动画类型  
      - 说明原因（节奏、价值观、演出方式等）  

    5. 补番处方  
      - 推荐 3 部非大众向或相对冷门的动画作品  
      - 必须避开用户列表中已经出现的作品  
      - 每一部都要：  
        - 明确推荐理由  
        - 且要关联用户已看过的某类作品或审美倾向，解释“为什么他会吃这一套”  

    6. 黄金年代判定(Golden Era)
      - 判断用户动画审美最集中的年代区间  
      - 例如：  
        - 入坑黄金期  
        - 或审美停留 / 最怀念的时期  
      - 用一句总结性的判断给出结论  

    7. 语言风格  
      - 中文  
      - 一针见血  
      - 专业但不说教  
      - 允许轻微犀利或幽默，但避免过度玩梗  

    返回格式要求（非常重要）：

    - 必须严格返回合法 JSON  
    - 不要包含任何 Markdown 语法元素  
    - 不要输出多余解释性文本  
    - 所有字段都必须存在  

    返回 JSON 结构如下：

    {
      "tags": ["string", "string", "string", "string"],
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
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      // model: 'gemini-1.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};