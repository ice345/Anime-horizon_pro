import React, { useState, useEffect, useRef } from 'react';
import { startAnimeGame, askGameOracle, checkGameWin, startEmojiGame, GameCharacter, EmojiGameChallenge } from '../services/geminiService';

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameMode = 'MENU' | 'ORACLE' | 'EMOJI';
type GameStatus = 'IDLE' | 'LOADING' | 'PLAYING' | 'WIN' | 'LOSE';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  type: 'text' | 'system' | 'win' | 'lose';
}

export const GameModal: React.FC<GameModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<GameMode>('MENU');

  useEffect(() => {
    if (isOpen) {
      setMode('MENU');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121212] w-full max-w-lg h-[600px] max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Background FX */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <div>
               <h2 className="text-lg font-bold text-white font-jp">
                 {mode === 'MENU' ? '游戏大厅' : mode === 'ORACLE' ? '二次元 Oracle' : '绘文字暗号'}
               </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        {/* <div className="flex-grow flex flex-col relative z-10 overflow-hidden"> */}
        <div className="flex-grow min-h-0 flex flex-col relative z-10 overflow-hidden">
          {mode === 'MENU' && <GameMenu onSelect={setMode} />}
          {mode === 'ORACLE' && <OracleGame onBack={() => setMode('MENU')} />}
          {mode === 'EMOJI' && <EmojiGame onBack={() => setMode('MENU')} />}
        </div>

      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const GameMenu: React.FC<{ onSelect: (m: GameMode) => void }> = ({ onSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 space-y-6 animate-fade-in">
       <div className="text-center mb-4">
         <h3 className="text-2xl font-black text-white mb-2">CHOOSE YOUR GAME</h3>
         <p className="text-sm text-gray-400">测试你的二次元浓度</p>
       </div>

       <button 
         onClick={() => onSelect('ORACLE')}
         className="w-full bg-gradient-to-r from-purple-900/50 to-blue-900/50 hover:from-purple-800 hover:to-blue-800 border border-white/10 p-6 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
       >
         <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
           🔮
         </div>
         <div className="text-left">
           <h4 className="font-bold text-lg text-white">Anime Oracle</h4>
           <p className="text-xs text-gray-400">我心中想了一个角色，你来猜。<br/>(经典 20 Questions 玩法)</p>
         </div>
       </button>

       <button 
         onClick={() => onSelect('EMOJI')}
         className="w-full bg-gradient-to-r from-orange-900/50 to-red-900/50 hover:from-orange-800 hover:to-red-800 border border-white/10 p-6 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
       >
         <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
           🧩
         </div>
         <div className="text-left">
           <h4 className="font-bold text-lg text-white">Emoji Cipher</h4>
           <p className="text-xs text-gray-400">看 Emoji 表情，猜番剧名字。<br/>(考验联想能力)</p>
         </div>
       </button>
    </div>
  );
};

const OracleGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [roundsLeft, setRoundsLeft] = useState(10);
  const [guessAttemptsLeft, setGuessAttemptsLeft] = useState(3);
  const [hintUsed, setHintUsed] = useState(false);

  const secretRef = useRef<GameCharacter | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const addMessage = (
    sender: 'user' | 'ai',
    text: string,
    type: 'text' | 'system' | 'win' | 'lose' = 'text'
  ) => {
    setMessages(prev => [...prev, { sender, text, type }]);
  };

  const startGame = async () => {
    setStatus('LOADING');
    setMessages([]);
    setRoundsLeft(10);
    setGuessAttemptsLeft(3);
    setHintUsed(false);
    setInput('');

    try {
      const character = await startAnimeGame();
      secretRef.current = character;
      setStatus('PLAYING');
      addMessage('ai', '我已经选好了一个角色。', 'system');
      addMessage('ai', '请提问或猜名字。', 'text');
    } catch {
      setStatus('IDLE');
      addMessage('ai', '连接失败，请重试。', 'system');
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || status !== 'PLAYING' || !secretRef.current) return;

    const txt = input.trim();
    setInput('');
    addMessage('user', txt);

    const nextRounds = roundsLeft - 1;
    setRoundsLeft(nextRounds);

    try {
      const res = await askGameOracle(secretRef.current, txt);
      const icon = res.answer === 'YES' ? '✅' : res.answer === 'NO' ? '❌' : '🤔';

      addMessage(
        'ai',
        `${icon} ${res.answer === 'YES' ? '是的' : res.answer === 'NO' ? '不是' : ''}。${res.flavorText}`
      );

      if (nextRounds <= 0) {
        setStatus('LOSE');
        addMessage(
          'ai',
          `回合结束！正确答案是：${secretRef.current.source} 的【${secretRef.current.name}】`,
          'lose'
        );
      }
    } catch {
      addMessage('ai', '...', 'system');
    }
  };

  const handleGuess = async () => {
    if (
      !input.trim() ||
      status !== 'PLAYING' ||
      !secretRef.current ||
      guessAttemptsLeft <= 0
    )
      return;

    const txt = input.trim();
    setInput('');
    addMessage('user', `我猜是：${txt}`);

    const nextRounds = roundsLeft - 1;
    const nextGuesses = guessAttemptsLeft - 1;
    setRoundsLeft(nextRounds);
    setGuessAttemptsLeft(nextGuesses);

    try {
      const win = await checkGameWin(secretRef.current, txt);

      if (win) {
        setStatus('WIN');
        addMessage('ai', `🎉 恭喜！答案正是 ${secretRef.current.name}。`, 'win');
      } else if (nextGuesses <= 0 || nextRounds <= 0) {
        setStatus('LOSE');
        addMessage(
          'ai',
          `❌ 游戏结束。正确答案是：${secretRef.current.name}。`,
          'lose'
        );
      } else {
        addMessage('ai', `❌ 不对哦（剩余猜测 ${nextGuesses}）`);
      }
    } catch {
      addMessage('ai', 'Error checking win.', 'system');
    }
  };

  const handleSurrender = () => {
    if (status !== 'PLAYING' || !secretRef.current) return;
    setStatus('LOSE');
    addMessage('user', '🏳️ 我认输了', 'system');
    addMessage(
      'ai',
      `你放弃了挑战。正确答案是：${secretRef.current.source} 的【${secretRef.current.name}】`,
      'lose'
    );
  };

  /* ================== 渲染 ================== */

if (status === 'IDLE') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-purple-600/30 border border-purple-500/50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(147,51,234,0.3)]">
          🔮
        </div>
        <p className="text-gray-300 mb-8 max-w-xs leading-relaxed">
          我心中已經選好了一個角色。<br />
          你有 <span className="text-purple-400 font-bold">10</span> 次提問機會和 <span className="text-blue-400 font-bold">3</span> 次猜測機會。
        </p>
        <div className="flex gap-4">
          <button onClick={onBack} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-gray-400 transition-colors">
            返回
          </button>
          <button onClick={startGame} className="px-8 py-2 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform active:scale-95">
            開始通靈
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-[#0c0c12] via-[#0f0f18] to-[#0b0b10] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(111,66,193,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(236,72,153,0.08),transparent_30%)]" />

      <div className="shrink-0 px-4 py-3 bg-black/65 backdrop-blur-xl flex justify-between items-center text-[11px] font-mono border-b border-white/5 z-20 shadow-[0_12px_40px_rgba(0,0,0,0.35)] relative">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${roundsLeft < 3 ? 'bg-red-500/20 text-red-300 border border-red-400/30' : 'bg-blue-500/15 text-blue-200 border border-blue-400/30'}`}>
            <span className="text-[10px] tracking-widest">ROUNDS</span>
            <span className="font-bold text-sm">{roundsLeft}</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-400/30 flex items-center gap-1">
            <span className="text-[10px] tracking-widest">GUESS</span>
            <span className="font-bold text-sm">{guessAttemptsLeft}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={hintUsed || status !== 'PLAYING'}
            onClick={() => {
              if (!hintUsed && secretRef.current) {
                setHintUsed(true);
                setRoundsLeft(r => r - 1);
                addMessage('ai', `💡 提示：${secretRef.current.hint}`, 'system');
              }
            }}
            className={`px-3 py-1 rounded-full border text-[11px] transition-all ${
              hintUsed
                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                : 'border-yellow-400/40 text-yellow-300 hover:border-yellow-300 hover:text-yellow-200'
            }`}
          >
            {hintUsed ? 'HINT USED' : 'GET HINT (-1R)'}
          </button>
          {status === 'PLAYING' && (
            <button onClick={handleSurrender} className="px-3 py-1 rounded-full border border-red-400/40 text-red-300 hover:border-red-300 hover:text-red-200 text-[11px] font-bold transition-all">
              GIVE UP
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 relative z-10">
        <div className="flex flex-col justify-end min-h-full space-y-4">
          {status === 'LOADING' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/40 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-blue-400/50 animate-spin" />
              </div>
              <p className="text-gray-400 text-sm font-jp tracking-wide">正在召唤 Oracle...</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}>
              <div className={`
                max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-md
                ${m.type === 'win' ? 'bg-gradient-to-br from-green-500 to-emerald-700 text-white border border-green-400/30 shadow-[0_10px_30px_rgba(16,185,129,0.35)]' : ''}
                ${m.type === 'lose' ? 'bg-gradient-to-br from-red-500 to-red-800 text-white border border-red-400/30 shadow-[0_10px_30px_rgba(239,68,68,0.35)]' : ''}
                ${m.type === 'system' ? 'bg-white/5 text-gray-400 text-[11px] font-mono italic mx-auto text-center !rounded-md border border-white/10 tracking-wide' : ''}
                ${m.type === 'text' && m.sender === 'user' ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white ml-8 shadow-[0_10px_30px_rgba(99,102,241,0.35)]' : ''}
                ${m.type === 'text' && m.sender === 'ai' ? 'bg-[#16161c]/90 text-gray-200 mr-8 border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.35)]' : ''}
              `}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="shrink-0 p-4 bg-black/55 backdrop-blur-xl border-t border-white/5 relative z-20 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
        {(status === 'WIN' || status === 'LOSE') ? (
          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-white/10 text-white text-sm hover:bg-white/5 transition-colors">
              返回主菜單
            </button>
            <button onClick={startGame} className="flex-[2] py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
              再挑戰一次
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder="輸入你的問題（如：是女性嗎？）"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors shadow-inner shadow-black/30"
              />
              <button
                onClick={handleAsk}
                className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl transition-all active:scale-95 shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex justify-between items-center px-1 text-[11px]">
              <span className="text-gray-500 uppercase tracking-widest font-mono">Oracle link stable</span>
              <button
                onClick={handleGuess}
                disabled={guessAttemptsLeft <= 0}
                className={`px-4 py-1.5 rounded-full border transition-all ${
                  guessAttemptsLeft > 0
                    ? 'border-blue-400/50 text-blue-200 hover:bg-blue-500/10'
                    : 'border-gray-800 text-gray-700 cursor-not-allowed'
                }`}
              >
                直接猜名字 ({guessAttemptsLeft})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EmojiGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [data, setData] = useState<EmojiGameChallenge | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [hintVisible, setHintVisible] = useState(false);

  const startGame = async () => {
    setStatus('LOADING');
    setData(null);
    setInput('');
    setMessage('');
    setHintVisible(false);
    try {
      const challenge = await startEmojiGame();
      setData(challenge);
      setStatus('PLAYING');
    } catch {
      setStatus('IDLE');
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || !data) return;
    const guess = input.trim();
    
    // Optimistic UI for visual feedback
    setMessage('Checking...');
    
    const isCorrect = await checkGameWin(data, guess);
    if (isCorrect) {
      setStatus('WIN');
      setMessage(`🎉 正确！是《${data.title}》`);
    } else {
      setMessage('❌ 不对哦，再试一次');
      setTimeout(() => setMessage(''), 1500);
    }
  };

  const handleGiveUp = () => {
    if (!data) return;
    setStatus('LOSE');
    setMessage(`答案是：《${data.title}》`);
  };

  if (status === 'IDLE') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-orange-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-lg shadow-orange-600/30">🧩</div>
        <p className="text-gray-300 mb-8 max-w-xs">我会给你一组 Emoji，你来猜它是哪部动漫。<br/>例如：🏴‍☠️👒🍖 → 海贼王</p>
        <div className="flex gap-4">
          <button onClick={onBack} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/10 text-white text-sm">返回</button>
          <button onClick={startGame} className="px-8 py-2 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform">开始</button>
        </div>
      </div>
    );
  }

  if (status === 'LOADING') {
    return <div className="flex items-center justify-center h-full text-anime-highlight animate-pulse">正在生成谜题...</div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
       {/* Puzzle Area */}
       <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-8">
          
          <div className="space-y-4">
             <div className="text-gray-400 text-xs uppercase tracking-widest">GUESS THE ANIME</div>
             <div className="text-6xl md:text-7xl animate-float p-4 bg-white/5 rounded-2xl border border-white/5 select-none">
               {data?.emojis}
             </div>
          </div>

          <div className={`text-sm font-bold h-6 transition-all ${status === 'WIN' ? 'text-green-400' : status === 'LOSE' ? 'text-red-400' : 'text-gray-400'}`}>
            {message}
          </div>

          {(status === 'WIN' || status === 'LOSE') ? (
             <div className="flex gap-4">
                <button onClick={onBack} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/10 text-white">返回</button>
                <button onClick={startGame} className="px-8 py-2 bg-white text-black font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]">下一题</button>
             </div>
          ) : (
            <div className="w-full max-w-xs space-y-4">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="输入动漫名字..."
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-center text-white focus:border-orange-500 focus:outline-none transition-colors"
                autoFocus
              />
              <button 
                onClick={handleSubmit}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-600/20"
              >
                提交答案
              </button>
              
              <div className="flex justify-between px-2 pt-4">
                <button 
                  onClick={() => setHintVisible(true)} 
                  disabled={hintVisible}
                  className={`text-xs ${hintVisible ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}
                >
                  {hintVisible ? data?.hint : '💡 看提示'}
                </button>
                <button onClick={handleGiveUp} className="text-xs text-red-900/50 hover:text-red-500 transition-colors">
                  🏳️ 放弃
                </button>
              </div>
            </div>
          )}
       </div>
    </div>
  );
};