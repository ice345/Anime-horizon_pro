import React, { useMemo, useState } from 'react';
import { OtakuRank } from '../types';

interface TasteQuizResult {
  inputs: string[];
  rank: OtakuRank;
}

interface TasteQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (result: TasteQuizResult) => void;
}

const QUESTION_GROUPS = [
  {
    id: 'emotion',
    title: '最容易打中你的瞬间',
    options: ['青春部活的关系变化', '宏大世界观和命运感', '高密度搞笑和日常空气', '悬疑反转和设定解谜']
  },
  {
    id: 'craft',
    title: '你最在意的制作味道',
    options: ['演出和镜头语言', '音乐与声场氛围', '角色作画和表情', '剧本结构和伏笔']
  },
  {
    id: 'pace',
    title: '你的补番节奏',
    options: ['慢热也可以，只要情绪细', '开局三集必须抓住我', '偏爱单元剧和轻松观看', '喜欢一口气刷完整季']
  },
  {
    id: 'theme',
    title: '偏爱的作品气质',
    options: ['京吹 / 利兹式细腻青春', '硬核科幻或奇幻冒险', '恋爱喜剧和角色互动', '黑深残或社会派议题']
  },
  {
    id: 'rank',
    title: '自评二次元浓度',
    options: ['动画爱好者', '老二次元', '萌豚', '婆罗门']
  }
];

const rankOptions: Record<string, OtakuRank> = {
  动画爱好者: '动画爱好者',
  老二次元: '老二次元',
  萌豚: '萌豚',
  婆罗门: '婆罗门'
};

export const TasteQuizModal: React.FC<TasteQuizModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({
    emotion: QUESTION_GROUPS[0].options[0],
    craft: QUESTION_GROUPS[1].options[1],
    pace: QUESTION_GROUPS[2].options[0],
    theme: QUESTION_GROUPS[3].options[0],
    rank: QUESTION_GROUPS[4].options[1]
  });
  const [titles, setTitles] = useState('吹响！上低音号\n利兹与青鸟');

  const preview = useMemo(() => {
    return QUESTION_GROUPS.map((group) => answers[group.id]).filter(Boolean).join(' / ');
  }, [answers]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const representativeTitles = titles
      .split(/\n|,|，|、/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);

    const inputs = [
      ...representativeTitles.map((title) => `代表作: ${title}`),
      ...QUESTION_GROUPS.map((group) => `${group.title}: ${answers[group.id]}`)
    ];

    onSubmit({
      inputs,
      rank: rankOptions[answers.rank] || '老二次元'
    });
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-sky-950/45 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 text-slate-800 shadow-[0_30px_90px_rgba(52,144,190,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-rose-50 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-500">Taste Check</p>
            <h2 className="mt-1 font-jp text-2xl font-black text-slate-900">快速二次元浓度测评</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              代表作、情绪偏好、制作口味。
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(92vh-166px)] overflow-y-auto px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            {QUESTION_GROUPS.map((group) => (
              <section key={group.id} className="rounded-2xl border border-sky-100 bg-white/75 p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-black text-slate-700">{group.title}</h3>
                <div className="grid gap-2">
                  {group.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => setAnswers((prev) => ({ ...prev, [group.id]: option }))}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${
                        answers[group.id] === option
                          ? 'border-sky-300 bg-sky-100 text-sky-900 shadow-inner'
                          : 'border-slate-100 bg-white/60 text-slate-500 hover:border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border border-sky-100 bg-white/75 p-4 shadow-sm md:col-span-2">
              <h3 className="mb-3 text-sm font-black text-slate-700">少量代表作</h3>
              <textarea
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
                className="min-h-28 w-full resize-none rounded-xl border border-slate-100 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                placeholder="吹响！上低音号"
              />
              <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-700">
                当前画像：{preview}
              </p>
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-sky-100 bg-white/80 px-6 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
            先不测
          </button>
          <button onClick={handleSubmit} className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600">
            生成偏好报告
          </button>
        </div>
      </div>
    </div>
  );
};
