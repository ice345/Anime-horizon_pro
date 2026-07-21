import React from 'react';
import seasonalSky from '../../pics/seasonal-sky-editorial.webp';

export const DecorativeBackground: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(220,234,250,0.7),transparent_32%),radial-gradient(circle_at_100%_18%,rgba(232,174,184,0.12),transparent_24%)]" />
    <div
      className="absolute inset-x-0 top-0 h-[560px] bg-cover bg-center opacity-[0.13]"
      style={{ backgroundImage: `url(${seasonalSky})` }}
    />
    <span className="absolute right-[8%] top-[26rem] h-20 w-px rotate-[28deg] bg-gradient-to-b from-transparent via-sky-300/40 to-transparent" />
    <span className="absolute left-[5%] top-[54rem] h-16 w-px -rotate-[22deg] bg-gradient-to-b from-transparent via-rose-200/50 to-transparent" />
  </div>
);
