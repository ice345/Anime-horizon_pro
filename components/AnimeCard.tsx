import React from 'react';
import { Anime } from '../types';

interface AnimeCardProps {
  anime: Anime;
  selected: boolean;
  onToggle: (id: string) => void;
}

// Helper to strip HTML tags for cleaner preview
const stripHtml = (html?: string) => {
  if (!html) return "暂无简介";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

export const AnimeCard: React.FC<AnimeCardProps> = ({ anime, selected, onToggle }) => {
  const displayTitle = anime.title.native || anime.title.romaji;
  const subTitle = anime.title.romaji !== anime.title.native ? anime.title.romaji : anime.title.english;
  const coverUrl = anime.coverImage.extraLarge || anime.coverImage.large;
  const themeColor = anime.coverImage.color || '#6366f1';
  const description = stripHtml(anime.description);

  return (
    <div 
      onClick={() => onToggle(String(anime.id))}
      className={`
        relative group cursor-pointer select-none
        aspect-[2/3] rounded-xl overflow-hidden
        transition-all duration-500 ease-out
        ${selected 
          ? 'ring-4 ring-offset-2 ring-offset-[#0f172a] ring-anime-accent shadow-[0_0_30px_rgba(236,72,153,0.4)] scale-[0.98] z-10' 
          : 'hover:shadow-[0_20px_50px_rgba(0,0,0,0.9)] hover:scale-105 hover:z-50'
        }
      `}
    >
      {/* 1. Background Layer (Image) */}
      <div className="absolute inset-0 bg-gray-900">
        <img 
          src={coverUrl} 
          alt={displayTitle}
          className={`
            w-full h-full object-cover transition-transform duration-700 ease-out
            ${selected ? 'grayscale-0' : 'grayscale-[0.3] group-hover:grayscale-0'}
            group-hover:scale-110 group-hover:blur-[2px]
          `}
          loading="lazy"
        />
        {/* Dark overlay for readability on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500"></div>
        
        {/* Dynamic Color Tint */}
        <div 
           className="absolute inset-0 mix-blend-overlay opacity-0 group-hover:opacity-30 transition-opacity duration-500"
           style={{ backgroundColor: themeColor }}
        ></div>
      </div>

      {/* 2. Selection Badge (Top Right) */}
      <div className={`
        absolute top-3 right-3 z-30 transition-all duration-300 transform
        ${selected ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 -translate-y-4'}
      `}>
        <div className="bg-anime-accent text-white rounded-full p-2 shadow-lg shadow-pink-500/30 ring-2 ring-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* 3. Content Container */}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        
        {/* Always Visible Title Area */}
        <div className="relative z-20 transform group-hover:-translate-y-2 transition-transform duration-500">
          <h3 className="text-white font-bold text-base leading-tight line-clamp-2 drop-shadow-md group-hover:text-anime-highlight transition-colors duration-300">
            {displayTitle}
          </h3>
          {subTitle && (
            <p className="text-[10px] text-gray-300 font-medium mt-1 line-clamp-1 opacity-80 group-hover:opacity-100 group-hover:text-white transition-all">
              {subTitle}
            </p>
          )}
        </div>

        {/* 4. Hover Detail Area (Slide Up) */}
        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out">
          <div className="overflow-hidden">
            <div className="pt-3 space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
              
              {/* Meta Info Row */}
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-300">
                <div className="flex items-center gap-2">
                   {anime.format && <span className="bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">{anime.format}</span>}
                   <span>{anime.seasonYear}</span>
                </div>
                {anime.averageScore && (
                  <div className="flex items-center gap-1 text-anime-highlight">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    <span>{anime.averageScore}%</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-gray-200 leading-relaxed line-clamp-4 font-light">
                {description}
              </p>

              {/* Genres */}
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.slice(0, 3).map((tag) => (
                  <span 
                    key={tag} 
                    className="px-1.5 py-0.5 text-[9px] font-medium text-white bg-anime-primary/40 backdrop-blur-md border border-anime-primary/30 rounded-md shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative Border on Hover */}
      <div className="absolute inset-0 border border-white/0 group-hover:border-white/20 rounded-xl transition-all duration-300 pointer-events-none"></div>
    </div>
  );
};
