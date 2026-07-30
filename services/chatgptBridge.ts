import { Anime } from '../types';
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

const titleOf = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const buildPortraitImagePrompt = (scopeTitle: string, anime: Anime[], profile: TasteProfile) => {
  const entries = anime.slice(0, 36).map((item) => {
    const note = item.userNote?.trim() ? `；短评：${item.userNote.trim()}` : '';
    return `${titleOf(item)}（${item.seasonYear || '未知年份'}；${item.userReaction || 'NEUTRAL'}；${item.genres?.slice(0, 3).join('/ ') || '动画'}${note}）`;
  }).join('\n');

  return `请根据以下动画年鉴，直接生成一张竖版 3:4 的“${scopeTitle}”插画，不要先解释。画面不需要出现人物肖像或任何已有动画角色，也不要出现文字、Logo、标题、水印。

画面要求：浅蓝天空、透明水彩质感、风中羽毛、细淡的五线谱、远处的校园天台与黄铜乐器反光；情绪安静、克制、带一点青春期的距离感。以色彩、构图与象征物表现观影口味，避免拼贴海报和具体版权角色。

年鉴概况：二次元浓度 ${profile.score}，画像 ${profile.rank}，标签 ${profile.labels.join('、')}。
作品资料：
${entries || '暂无作品'}

请只生成图像。`;
};
