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
    你是一位资深的,客观的并且很懂行的老二次元(Anime Expert)。
    
    用户目前看过的动画列表（包含年份）: 
    ${animeTitles.join(', ')}。
    
    他们根据数量获得的等级是: "${rank}"。
    
    请根据这些列表分析用户的【二次元成分】。
    
    要求：
      1.  **🏷️ 成分标签**：用 4 个简短的词概括用户的属性（如：设定控、作画厨、扭曲怪、京阿尼信徒、硬核科幻迷、胃痛爱好者、废萌难民等）。
      2.  **🧐 深度鉴赏**：
          * 不要只报菜名。分析用户口味的**核心逻辑**（例如：比起热血战斗，更看重人物内心的细腻成长）。
          * 指出用户审美中的**独特品味**（例如：对配乐的高要求，或对京都动画式演出的执着）。
      3.  **🧬 现实人格侧写**：
          * 基于观影喜好，大胆推测用户在现实生活中的性格特征、思维模式，甚至职业倾向。
      4.  **📉 避雷预警**：
          * 推测用户**绝对看不下去**的一类作品是什么。
      5.  **📺 补番处方**：
          * 推荐 3 部**非大众**的佳作（避开列表已有的）。
          * **必须说明理由**：连接用户列表中的某部作品，解释为什么这部也适合他。
      6.⏳ 黄金年代判定 (Golden Era):
          *判断用户最怀念哪个时期的动画。* 比如:指出用户的'入坑黄金期'或审美停留在哪个年代(例如:'2010-2015 黄金时代遗老').”

      # Tone
      语言风格要**一针见血**，既有专业度，又带有一点幽默感或犀利的洞察力。
    
    请严格返回标准 JSON 格式(不要Markdown):
    {
      "roast": "string (中文评价)",
      "personality": "string (中文性格侧写)",
      "recommendations": [
        { "title": "string (作品名)", "reason": "string (推荐理由)" }
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