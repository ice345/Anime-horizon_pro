import React, { useEffect, useRef, useState } from 'react';
import {
  askGameOracle,
  checkGameWin,
  EmojiGameChallenge,
  GameCharacter,
  startAnimeGame,
  startEmojiGame
} from '../services/geminiService';

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameMode = 'MENU' | 'ORACLE' | 'EMOJI' | 'TITLE' | 'KEYWORD';
type GameStatus = 'IDLE' | 'LOADING' | 'PLAYING' | 'WIN' | 'LOSE';

interface GameStats {
  score: number;
  streak: number;
  bestStreak: number;
  plays: number;
  wins: number;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  type: 'text' | 'system' | 'win' | 'lose';
}

const STORAGE_KEY = 'anime-horizon-game-stats-v1';

const TITLE_PUZZLES = [
  { title: '吹响！上低音号', parts: ['吹响', '！', '上低音号'], hint: '北宇治吹奏部' },
  { title: '利兹与青鸟', parts: ['利兹', '与', '青鸟'], hint: '两位少女与一首双簧管曲' },
  { title: '孤独摇滚！', parts: ['孤独', '摇滚', '！'], hint: '结束乐队' },
  { title: '葬送的芙莉莲', parts: ['葬送', '的', '芙莉莲'], hint: '旅途结束后的旅途' },
  { title: '四月是你的谎言', parts: ['四月', '是', '你的', '谎言'], hint: '钢琴、小提琴与春天' },
  { title: '比宇宙更远的地方', parts: ['比', '宇宙', '更远', '的地方'], hint: '去南极' },
  { title: '紫罗兰永恒花园', parts: ['紫罗兰', '永恒', '花园'], hint: '自动手记人偶' },
  { title: '轻音少女', parts: ['轻音', '少女'], hint: '放学后茶会' },
  { title: '冰菓', parts: ['冰', '菓'], hint: '古典部推理' },
  { title: '凉宫春日的忧郁', parts: ['凉宫', '春日', '的', '忧郁'], hint: 'SOS 团' }
];

const distractors = ['青春', '物语', '奏鸣曲', '剧场版', '少女', '终末', '日常', '幻想', '记录', '夏日'];

const KEYWORD_ROUNDS = [
  {
    title: '利兹与青鸟',
    note: '请选出最接近这部作品的三种气质',
    correct: ['双簧管', '青春留白', '关系微妙'],
    decoys: ['热血擂台', '宇宙远征', '末日战争', '魔法学院', '忍者任务']
  },
  {
    title: '吹响！上低音号',
    note: '请选出最接近这部作品的三种气质',
    correct: ['吹奏部', '合奏竞争', '舞台成长'],
    decoys: ['异世界升级', '侦探破案', '海岛求生', '妖怪退治', '机甲决战']
  },
  {
    title: '比宇宙更远的地方',
    note: '请选出最接近这部作品的三种气质',
    correct: ['南极旅行', '少女友谊', '出发的勇气'],
    decoys: ['都市恋爱', '黑帮火并', '魔王城堡', '地下迷宫', '赛车竞速']
  },
  {
    title: '冰菓',
    note: '请选出最接近这部作品的三种气质',
    correct: ['古典部', '日常推理', '青春观察'],
    decoys: ['怪兽讨伐', '偶像选拔', '战国争霸', '时间旅行', '法术对决']
  }
];

const initialStats: GameStats = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  plays: 0,
  wins: 0
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const loadStats = (): GameStats => {
  if (typeof window === 'undefined') return initialStats;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialStats, ...JSON.parse(raw) } : initialStats;
  } catch {
    return initialStats;
  }
};

export const GameModal: React.FC<GameModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<GameMode>('MENU');
  const [stats, setStats] = useState<GameStats>(loadStats);

  useEffect(() => {
    if (isOpen) setMode('MENU');
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  if (!isOpen) return null;

  const recordResult = (win: boolean, points: number) => {
    setStats((prev) => {
      const streak = win ? prev.streak + 1 : 0;
      return {
        score: Math.max(0, prev.score + points),
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
        plays: prev.plays + 1,
        wins: prev.wins + (win ? 1 : 0)
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-sky-950/45 p-4 backdrop-blur-xl animate-fade-in">
      <div className="relative flex h-[720px] max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/[0.92] text-slate-800 shadow-[0_30px_100px_rgba(14,116,144,0.32)]">
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(14,116,144,0.06)_1px,transparent_1px)] bg-[size:100%_34px]" />
        <div className="hidden w-64 shrink-0 border-r border-sky-100/80 bg-sky-50/70 p-5 md:block">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-500">Club Room</p>
            <h2 className="mt-2 font-jp text-2xl font-black text-slate-900">游戏大厅</h2>
          </div>

          <div className="grid gap-3">
            <StatCard label="Score" value={stats.score} />
            <StatCard label="Streak" value={stats.streak} />
            <StatCard label="Best" value={stats.bestStreak} />
            <StatCard label="Win Rate" value={`${stats.plays ? Math.round((stats.wins / stats.plays) * 100) : 0}%`} />
          </div>
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-sky-100/80 bg-white/75 px-5 py-4 backdrop-blur">
            <button
              onClick={() => (mode === 'MENU' ? onClose() : setMode('MENU'))}
              className="rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              {mode === 'MENU' ? '关闭' : '返回大厅'}
            </button>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                {mode === 'MENU' ? 'Today Missions' : mode}
              </p>
            <h3 className="font-jp text-lg font-black text-slate-900">
                {mode === 'MENU' ? '选择今日挑战' : mode === 'ORACLE' ? '角色 Oracle' : mode === 'EMOJI' ? '绘文字暗号' : mode === 'TITLE' ? '番名拼图' : '关键词配对'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-900"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {mode === 'MENU' && <GameMenu stats={stats} onSelect={setMode} />}
            {mode === 'ORACLE' && <OracleGame onResult={recordResult} />}
            {mode === 'EMOJI' && <EmojiGame onResult={recordResult} />}
            {mode === 'TITLE' && <TitlePuzzleGame onResult={recordResult} />}
            {mode === 'KEYWORD' && <KeywordMatchGame onResult={recordResult} />}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
    <div className="mt-1 font-mono text-2xl font-black text-slate-900">{value}</div>
  </div>
);

const GameMenu: React.FC<{ stats: GameStats; onSelect: (m: GameMode) => void }> = ({ stats, onSelect }) => {
  const missions = [
    {
      mode: 'TITLE' as GameMode,
      title: '番名拼图',
      meta: '本地可玩',
      tone: 'from-sky-500 to-cyan-400',
      text: '把碎片拼回正确标题，适合热身。'
    },
    {
      mode: 'EMOJI' as GameMode,
      title: '绘文字暗号',
      meta: 'AI 出题',
      tone: 'from-rose-400 to-orange-300',
      text: '用几枚符号猜出作品名。'
    },
    {
      mode: 'ORACLE' as GameMode,
      title: '角色 Oracle',
      meta: 'AI 20 问',
      tone: 'from-indigo-400 to-sky-500',
      text: '向裁判提问，锁定角色。'
    },
    {
      mode: 'KEYWORD' as GameMode,
      title: '关键词配对',
      meta: '本地可玩',
      tone: 'from-violet-400 to-rose-400',
      text: '从作品气质里挑出三个关键词，三轮建立你的番剧雷达。'
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mb-6 grid grid-cols-2 gap-3 md:hidden">
        <StatCard label="Score" value={stats.score} />
        <StatCard label="Streak" value={stats.streak} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {missions.map((mission) => (
          <button
            key={mission.mode}
            onClick={() => onSelect(mission.mode)}
            className="group flex min-h-60 flex-col justify-between rounded-3xl border border-sky-100 bg-white/80 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_20px_60px_rgba(14,116,144,0.18)]"
          >
            <div>
              <div className={`mb-5 h-2 w-20 rounded-full bg-gradient-to-r ${mission.tone}`} />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{mission.meta}</p>
              <h4 className="mt-3 font-jp text-2xl font-black text-slate-900">{mission.title}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-500">{mission.text}</p>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 text-sm font-black text-sky-600">
              开始挑战
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-500">Current Title</p>
            <p className="mt-2 font-jp text-xl font-black text-slate-900">
              {stats.bestStreak >= 8 ? '社团传说' : stats.bestStreak >= 5 ? '练习室王牌' : stats.wins >= 3 ? '稳定发挥' : '新入部员'}
            </p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white md:w-72">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-rose-300"
              style={{ width: `${Math.min(100, (stats.score / 1200) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const OracleGame: React.FC<{ onResult: (win: boolean, points: number) => void }> = ({ onResult }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [roundsLeft, setRoundsLeft] = useState(10);
  const [guessAttemptsLeft, setGuessAttemptsLeft] = useState(3);
  const [hintUsed, setHintUsed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const secretRef = useRef<GameCharacter | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const finish = (win: boolean) => {
    setStatus(win ? 'WIN' : 'LOSE');
    if (!recorded) {
      setRecorded(true);
      onResult(win, win ? 180 + roundsLeft * 8 + guessAttemptsLeft * 12 : -25);
    }
  };

  const addMessage = (sender: 'user' | 'ai', text: string, type: ChatMessage['type'] = 'text') => {
    setMessages((prev) => [...prev, { sender, text, type }]);
  };

  const startGame = async () => {
    setStatus('LOADING');
    setMessages([]);
    setRoundsLeft(10);
    setGuessAttemptsLeft(3);
    setHintUsed(false);
    setRecorded(false);
    setInput('');

    try {
      const character = await startAnimeGame();
      secretRef.current = character;
      setStatus('PLAYING');
      addMessage('ai', '角色已选定。', 'system');
      addMessage('ai', '用问题缩小范围，或直接猜名字。', 'text');
    } catch {
      setStatus('IDLE');
      addMessage('ai', 'AI 连接失败，请检查 Key 配置。', 'system');
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || status !== 'PLAYING' || !secretRef.current) return;
    const txt = input.trim();
    const nextRounds = roundsLeft - 1;
    setInput('');
    setRoundsLeft(nextRounds);
    addMessage('user', txt);

    try {
      const res = await askGameOracle(secretRef.current, txt);
      addMessage('ai', `${res.answer === 'YES' ? '是' : res.answer === 'NO' ? '不是' : '不确定'}。${res.flavorText}`);
      if (nextRounds <= 0) {
        addMessage('ai', `答案是：${secretRef.current.source} 的 ${secretRef.current.name}`, 'lose');
        finish(false);
      }
    } catch {
      addMessage('ai', '信号受到干扰。', 'system');
    }
  };

  const handleGuess = async () => {
    if (!input.trim() || status !== 'PLAYING' || !secretRef.current || guessAttemptsLeft <= 0) return;
    const txt = input.trim();
    const nextRounds = roundsLeft - 1;
    const nextGuesses = guessAttemptsLeft - 1;
    setInput('');
    setRoundsLeft(nextRounds);
    setGuessAttemptsLeft(nextGuesses);
    addMessage('user', `我猜：${txt}`);

    try {
      const win = await checkGameWin(secretRef.current, txt);
      if (win) {
        addMessage('ai', `正确，答案是 ${secretRef.current.name}。`, 'win');
        finish(true);
      } else if (nextGuesses <= 0 || nextRounds <= 0) {
        addMessage('ai', `答案是：${secretRef.current.source} 的 ${secretRef.current.name}`, 'lose');
        finish(false);
      } else {
        addMessage('ai', `不对，还能猜 ${nextGuesses} 次。`);
      }
    } catch {
      addMessage('ai', '判定失败，再试一次。', 'system');
    }
  };

  if (status === 'IDLE') {
    return <StartPanel title="角色 Oracle" text="10 次提问，3 次猜测。适合检验角色知识和提问策略。" action="开始" onStart={startGame} />;
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white/60 to-sky-50/70">
      <GameTopBar
        left={`Rounds ${roundsLeft}`}
        right={`Guess ${guessAttemptsLeft}`}
        action={hintUsed ? 'Hint Used' : 'Hint'}
        disabled={hintUsed || status !== 'PLAYING'}
        onAction={() => {
          if (!hintUsed && secretRef.current) {
            setHintUsed(true);
            setRoundsLeft((r) => Math.max(0, r - 1));
            addMessage('ai', `提示：${secretRef.current.hint}`, 'system');
          }
        }}
      />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
        {status === 'LOADING' ? (
          <LoadingState text="正在选择角色" />
        ) : (
          <div className="flex min-h-full flex-col justify-end gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${
                    m.type === 'system'
                      ? 'mx-auto rounded-xl border border-sky-100 bg-white/80 text-xs font-bold text-slate-400'
                      : m.type === 'win'
                        ? 'bg-emerald-500 text-white'
                        : m.type === 'lose'
                          ? 'bg-rose-500 text-white'
                          : m.sender === 'user'
                            ? 'bg-sky-500 text-white'
                            : 'border border-sky-100 bg-white text-slate-700'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>
      <GameInput
        value={input}
        setValue={setInput}
        disabled={status !== 'PLAYING'}
        placeholder="是主角吗？"
        onEnter={handleAsk}
        primaryLabel="提问"
        secondaryLabel="猜名字"
        onPrimary={handleAsk}
        onSecondary={handleGuess}
      />
      {(status === 'WIN' || status === 'LOSE') && <ReplayBar onReplay={startGame} />}
    </div>
  );
};

const EmojiGame: React.FC<{ onResult: (win: boolean, points: number) => void }> = ({ onResult }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [data, setData] = useState<EmojiGameChallenge | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [hintVisible, setHintVisible] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const finish = (win: boolean) => {
    setStatus(win ? 'WIN' : 'LOSE');
    if (!recorded) {
      setRecorded(true);
      onResult(win, win ? 150 + attempts * 18 + (hintVisible ? 0 : 25) : -15);
    }
  };

  const startGame = async () => {
    setStatus('LOADING');
    setData(null);
    setInput('');
    setMessage('');
    setAttempts(3);
    setHintVisible(false);
    setRecorded(false);
    try {
      const challenge = await startEmojiGame();
      setData(challenge);
      setStatus('PLAYING');
    } catch {
      setStatus('IDLE');
      setMessage('AI 连接失败，请检查 Key 配置。');
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || !data || status !== 'PLAYING') return;
    const guess = input.trim();
    setMessage('判定中...');
    const isCorrect = await checkGameWin(data, guess);
    if (isCorrect) {
      setMessage(`正确：${data.title}`);
      finish(true);
    } else {
      const nextAttempts = attempts - 1;
      setAttempts(nextAttempts);
      if (nextAttempts <= 0) {
        setMessage(`答案：${data.title}`);
        finish(false);
      } else {
        setMessage(`不对，还剩 ${nextAttempts} 次。`);
      }
    }
  };

  if (status === 'IDLE') {
    return <StartPanel title="绘文字暗号" text={message || '3 次机会，根据符号组合猜作品名。'} action="开始" onStart={startGame} />;
  }

  return (
    <PuzzleShell
      status={status}
      loadingText="正在生成暗号"
      badge={`Attempts ${attempts}`}
      puzzle={data?.emojis || ''}
      message={message}
      input={input}
      setInput={setInput}
      placeholder="输入作品名"
      onSubmit={handleSubmit}
      onReplay={startGame}
      hint={hintVisible ? data?.hint : undefined}
      onHint={() => setHintVisible(true)}
      onGiveUp={() => {
        if (data) {
          setMessage(`答案：${data.title}`);
          finish(false);
        }
      }}
    />
  );
};

const TitlePuzzleGame: React.FC<{ onResult: (win: boolean, points: number) => void }> = ({ onResult }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [target, setTarget] = useState(TITLE_PUZZLES[0]);
  const [pool, setPool] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [round, setRound] = useState(1);
  const [recorded, setRecorded] = useState(false);

  const startGame = () => {
    const puzzle = TITLE_PUZZLES[Math.floor(Math.random() * TITLE_PUZZLES.length)];
    const extra = shuffle(distractors.filter((item) => !puzzle.parts.includes(item))).slice(0, 3);
    setTarget(puzzle);
    setPool(shuffle([...puzzle.parts, ...extra]));
    setAnswer([]);
    setMessage('');
    setRound(1);
    setRecorded(false);
    setStatus('PLAYING');
  };

  const submit = () => {
    const value = answer.join('');
    const win = value === target.title;
    if (win) {
      setMessage(`正确：${target.title}`);
      setStatus('WIN');
      if (!recorded) {
        setRecorded(true);
        onResult(true, 100 + Math.max(0, 6 - round) * 12);
      }
    } else {
      const nextRound = round + 1;
      if (nextRound > 3) {
        setMessage(`答案：${target.title}`);
        setStatus('LOSE');
        if (!recorded) {
          setRecorded(true);
          onResult(false, -10);
        }
      } else {
        setRound(nextRound);
        setMessage(`顺序不对，还能提交 ${4 - nextRound} 次。`);
      }
    }
  };

  if (status === 'IDLE') {
    return <StartPanel title="番名拼图" text="无需 API。把标题碎片按正确顺序放回去。" action="开始" onStart={startGame} />;
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white/70 to-sky-50">
      <GameTopBar left={`Try ${round}/3`} right={target.hint} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 p-6">
        <div className="rounded-3xl border border-sky-100 bg-white/80 p-5 shadow-sm">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Answer</p>
          <div className="flex min-h-16 flex-wrap gap-2 rounded-2xl bg-sky-50 p-3">
            {answer.length === 0 && <span className="self-center text-sm text-slate-400">选择下方碎片</span>}
            {answer.map((part, idx) => (
              <button
                key={`${part}-${idx}`}
                onClick={() => {
                  setAnswer((prev) => prev.filter((_, i) => i !== idx));
                  setPool((prev) => [...prev, part]);
                }}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-sm"
              >
                {part}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {pool.map((part, idx) => (
            <button
              key={`${part}-${idx}`}
              disabled={status !== 'PLAYING'}
              onClick={() => {
                setPool((prev) => prev.filter((_, i) => i !== idx));
                setAnswer((prev) => [...prev, part]);
              }}
              className="rounded-2xl border border-sky-100 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
            >
              {part}
            </button>
          ))}
        </div>

        <p className={`min-h-6 text-center text-sm font-bold ${status === 'WIN' ? 'text-emerald-600' : status === 'LOSE' ? 'text-rose-500' : 'text-slate-500'}`}>
          {message}
        </p>
      </div>

      {status === 'PLAYING' ? (
        <div className="border-t border-sky-100 bg-white/70 p-4">
          <button onClick={submit} className="w-full rounded-2xl bg-sky-500 py-3 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600">
            提交
          </button>
        </div>
      ) : (
        <ReplayBar onReplay={startGame} />
      )}
    </div>
  );
};

const KeywordMatchGame: React.FC<{ onResult: (win: boolean, points: number) => void }> = ({ onResult }) => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [round, setRound] = useState(1);
  const [target, setTarget] = useState(KEYWORD_ROUNDS[0]);
  const [pool, setPool] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [recorded, setRecorded] = useState(false);

  const startGame = () => {
    const nextTarget = KEYWORD_ROUNDS[Math.floor(Math.random() * KEYWORD_ROUNDS.length)];
    setTarget(nextTarget);
    setPool(shuffle([...nextTarget.correct, ...nextTarget.decoys]));
    setSelected([]);
    setRound(1);
    setMessage('');
    setRecorded(false);
    setStatus('PLAYING');
  };

  const finish = (win: boolean, points: number) => {
    setStatus(win ? 'WIN' : 'LOSE');
    if (!recorded) {
      setRecorded(true);
      onResult(win, points);
    }
  };

  const submit = () => {
    if (selected.length !== 3) {
      setMessage('先选择 3 个关键词。');
      return;
    }
    const correct = selected.every((item) => target.correct.includes(item)) && target.correct.every((item) => selected.includes(item));
    if (!correct) {
      setMessage('有关键词混进了别的片场，再想想。');
      return;
    }
    if (round >= 3) {
      setMessage(`雷达校准完成：${target.title}`);
      finish(true, 160 + (3 - round) * 30);
      return;
    }
    const nextTarget = KEYWORD_ROUNDS[Math.floor(Math.random() * KEYWORD_ROUNDS.length)];
    setTarget(nextTarget);
    setPool(shuffle([...nextTarget.correct, ...nextTarget.decoys]));
    setSelected([]);
    setRound((value) => value + 1);
    setMessage('判断正确，下一部作品来了。');
  };

  if (status === 'IDLE') {
    return <StartPanel title="关键词配对" text="每轮挑出 3 个最贴合作品气质的关键词，共 3 轮。无需 API。" action="开始" onStart={startGame} />;
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white/70 to-rose-50/70">
      <GameTopBar left={`Round ${round}/3`} right="选择 3 个关键词" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-rose-100 bg-white/85 p-6 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-400">Taste Radar</p>
            <h4 className="mt-3 font-jp text-3xl font-black text-slate-900">{target.title}</h4>
            <p className="mt-2 text-sm text-slate-500">{target.note}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {pool.map((keyword) => {
              const active = selected.includes(keyword);
              return (
                <button
                  key={keyword}
                  onClick={() => setSelected((prev) => active ? prev.filter((item) => item !== keyword) : prev.length < 3 ? [...prev, keyword] : prev)}
                  className={`min-h-16 rounded-2xl border px-3 py-3 text-sm font-black transition ${active ? 'border-rose-400 bg-rose-400 text-white shadow-lg shadow-rose-100' : 'border-sky-100 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-600'}`}
                >
                  {keyword}
                </button>
              );
            })}
          </div>
          <p className={`mt-5 min-h-6 text-center text-sm font-bold ${status === 'WIN' ? 'text-emerald-600' : 'text-slate-500'}`}>{message}</p>
        </div>
      </div>
      {status === 'PLAYING' ? (
        <div className="border-t border-rose-100 bg-white/70 p-4">
          <button onClick={submit} className="w-full rounded-2xl bg-rose-400 py-3 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:bg-rose-500">确认配对</button>
        </div>
      ) : (
        <ReplayBar onReplay={startGame} />
      )}
    </div>
  );
};

const StartPanel: React.FC<{ title: string; text: string; action: string; onStart: () => void }> = ({ title, text, action, onStart }) => (
  <div className="flex h-full items-center justify-center p-6">
    <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white/80 p-8 text-center shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">Mission</p>
      <h4 className="mt-3 font-jp text-3xl font-black text-slate-900">{title}</h4>
      <p className="mt-4 text-sm leading-7 text-slate-500">{text}</p>
      <button onClick={onStart} className="mt-8 rounded-2xl bg-sky-500 px-8 py-3 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600">
        {action}
      </button>
    </div>
  </div>
);

const LoadingState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 text-sky-600">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
    <p className="text-sm font-black tracking-[0.2em]">{text}</p>
  </div>
);

const GameTopBar: React.FC<{
  left: string;
  right: string;
  action?: string;
  disabled?: boolean;
  onAction?: () => void;
}> = ({ left, right, action, disabled, onAction }) => (
  <div className="flex items-center justify-between border-b border-sky-100 bg-white/65 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
    <span>{left}</span>
    <div className="flex items-center gap-3">
      <span className="max-w-52 truncate normal-case tracking-normal text-sky-600">{right}</span>
      {action && (
        <button disabled={disabled} onClick={onAction} className="rounded-full border border-sky-100 bg-white px-3 py-1 text-sky-700 transition hover:bg-sky-50 disabled:text-slate-300">
          {action}
        </button>
      )}
    </div>
  </div>
);

const GameInput: React.FC<{
  value: string;
  setValue: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  onEnter: () => void;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}> = ({ value, setValue, disabled, placeholder, onEnter, primaryLabel, secondaryLabel, onPrimary, onSecondary }) => (
  <div className="border-t border-sky-100 bg-white/75 p-4">
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50"
      />
      <button disabled={disabled} onClick={onPrimary} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600 disabled:bg-slate-200">
        {primaryLabel}
      </button>
      <button disabled={disabled} onClick={onSecondary} className="rounded-2xl border border-sky-100 bg-white px-5 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-50 disabled:text-slate-300">
        {secondaryLabel}
      </button>
    </div>
  </div>
);

const PuzzleShell: React.FC<{
  status: GameStatus;
  loadingText: string;
  badge: string;
  puzzle: string;
  message: string;
  input: string;
  setInput: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  onReplay: () => void;
  hint?: string;
  onHint: () => void;
  onGiveUp: () => void;
}> = ({ status, loadingText, badge, puzzle, message, input, setInput, placeholder, onSubmit, onReplay, hint, onHint, onGiveUp }) => {
  if (status === 'LOADING') return <LoadingState text={loadingText} />;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white/70 to-rose-50/70">
      <GameTopBar left={badge} right={hint || 'No hint'} action={hint ? undefined : 'Hint'} onAction={onHint} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 p-6 text-center">
        <div className="rounded-[2rem] border border-rose-100 bg-white/80 px-8 py-7 text-6xl shadow-sm md:text-7xl">{puzzle}</div>
        <p className={`min-h-6 text-sm font-bold ${status === 'WIN' ? 'text-emerald-600' : status === 'LOSE' ? 'text-rose-500' : 'text-slate-500'}`}>{message}</p>
        {status === 'PLAYING' && (
          <div className="w-full max-w-sm space-y-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-center text-sm text-slate-700 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
            />
            <button onClick={onSubmit} className="w-full rounded-2xl bg-rose-400 py-3 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:bg-rose-500">
              提交
            </button>
            <button onClick={onGiveUp} className="text-xs font-bold text-slate-400 transition hover:text-rose-500">
              放弃
            </button>
          </div>
        )}
        {(status === 'WIN' || status === 'LOSE') && <button onClick={onReplay} className="rounded-2xl bg-sky-500 px-8 py-3 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600">下一题</button>}
      </div>
    </div>
  );
};

const ReplayBar: React.FC<{ onReplay: () => void }> = ({ onReplay }) => (
  <div className="border-t border-sky-100 bg-white/75 p-4">
    <button onClick={onReplay} className="w-full rounded-2xl bg-sky-500 py-3 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-600">
      再挑战一次
    </button>
  </div>
);
