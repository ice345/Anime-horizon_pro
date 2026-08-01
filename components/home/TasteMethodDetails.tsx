import React from 'react';
import { TasteProfile } from '../../services/tasteProfile';

interface TasteMethodDetailsProps {
  profile: TasteProfile;
}

const metricLabels: Array<[keyof TasteProfile['metrics'], string]> = [
  ['depth', '观看深度'],
  ['niche', '长尾探索'],
  ['curation', '口碑甄选'],
  ['eraBreadth', '年代跨度'],
  ['diversity', '题材多样'],
  ['engagement', '观看投入'],
  ['personalCuration', '个人评鉴'],
];

export const TasteMethodDetails: React.FC<TasteMethodDetailsProps> = ({ profile }) => (
  <details className="group border-t border-yearbook-line pt-3 text-xs text-yearbook-muted">
    <summary className="cursor-pointer list-none font-medium text-yearbook-sky marker:hidden">
      评分依据 · {profile.evidenceCount} 有效样本 · {profile.confidence}% 置信度
    </summary>
    <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {metricLabels.map(([key, label]) => (
        <div key={key} className="grid grid-cols-[64px_1fr_26px] items-center gap-2">
          <span>{label}</span>
          <span className="h-1.5 overflow-hidden bg-yearbook-blue">
            <span className="block h-full bg-yearbook-sky" style={{ width: `${profile.metrics[key]}%` }} />
          </span>
          <span className="text-right font-medium text-yearbook-ink">{profile.metrics[key]}</span>
        </div>
      ))}
    </div>
  </details>
);
