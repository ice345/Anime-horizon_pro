import { Anime } from '../types';
import { buildArchivePromptData } from './archivePrompt';
import { TasteProfile } from './tasteProfile';

const fallbackCopy = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();
  if (!copied) throw new Error('Copy command was rejected');
};

export const copyBridgePrompt = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopy(text);
};

export const openChatGPT = () => {
  window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
};

export const buildPortraitImagePrompt = (scopeTitle: string, anime: Anime[], profile: TasteProfile) => {
  const archiveData = buildArchivePromptData(anime);

  return `请根据以下动画年鉴，直接生成一张竖版 3:4 的“${scopeTitle}”插画，不要先解释。画面不需要出现人物肖像或任何已有动画角色，也不要出现文字、Logo、标题、水印。

画面要求：浅蓝天空、透明水彩质感、风中羽毛、细淡的五线谱、远处的校园天台与黄铜乐器反光；情绪安静、克制、带一点青春期的距离感。以色彩、构图与象征物表现观影口味，避免拼贴海报和具体版权角色。

年鉴概况：共 ${archiveData.sourceCount} 部作品；二次元浓度 ${profile.score}；画像 ${profile.rank}；标签 ${profile.labels.join('、')}；置信度 ${profile.confidence}%。
证据说明：${archiveData.reviewCount} 部作品有短评，重点情绪证据选取 ${archiveData.highlightCount} 部；其余作品仍通过完整索引中的状态、态度、题材与年份参与整体判断。
作品资料（完整索引，包含标题、别名、年份、状态、态度和题材；请用它理解整体口味，不要把文字直接画进图像）：
${archiveData.indexText}

重点情绪证据（优先参考有明确态度或短评的作品）：
${archiveData.highlightText}

请让画面体现这份完整年鉴的共同气质，而不是只模仿某一部作品；不需要逐部复刻，也不要生成任何可识别的版权角色。

请只生成图像。`;
};
