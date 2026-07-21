import React from 'react';
import lizSky from '../../pics/liz-sky-background.webp';

export const DecorativeBackground: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(251,250,247,0.78),rgba(251,250,247,0.9))]" />
    <div
      className="absolute inset-x-0 top-0 h-[620px] bg-cover bg-center opacity-[0.24]"
      style={{ backgroundImage: `url(${lizSky})` }}
    />
    <span className="absolute right-[8%] top-[26rem] h-20 w-px rotate-[28deg] bg-gradient-to-b from-transparent via-sky-300/40 to-transparent" />
    <span className="absolute left-[5%] top-[54rem] h-16 w-px -rotate-[22deg] bg-gradient-to-b from-transparent via-rose-200/50 to-transparent" />
  </div>
);
