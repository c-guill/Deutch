import { Flame, PenLine, RefreshCw, Volume2, VolumeX, Zap, Sparkles } from 'lucide-react';
import type { LearningItem, Module, Theme, UserProgress } from '../types/database';
import { effectiveStreak, setSoundOn, useGameState } from '../lib/gameState';

interface ThemeMapProps {
  themes: Theme[];
  modules: Module[];
  items: LearningItem[];
  progressMap: Map<string, UserProgress>;
  dueCount: number;
  sentencePracticeCount: number;
  onSelectTheme: (theme: Theme) => void;
  onStartReview: () => void;
  onStartSentencePractice: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const FALLBACK_EMOJIS = ['👋', '🔢', '🎨', '👨‍👩‍👧', '🍎', '🏠', '🕐', '🛒', '🚌', '⛅', '💼', '🩺', '🎉', '✈️', '📅', '💬', '📚', '🏆'];

const KEYWORD_EMOJIS: Array<[RegExp, string]> = [
  [/greet|hello|introduc|meeting/i, '👋'],
  [/number|count/i, '🔢'],
  [/colou?r/i, '🎨'],
  [/family|people|friend/i, '👨‍👩‍👧'],
  [/food|eat|drink|meal|restaurant|caf/i, '🍽️'],
  [/home|house|room|flat|apartment/i, '🏠'],
  [/time|clock|hour/i, '🕐'],
  [/day|week|month|date|calendar/i, '📅'],
  [/shop|buy|market|clothes/i, '🛒'],
  [/travel|transport|train|bus|direction|city|town/i, '🚌'],
  [/weather|season/i, '⛅'],
  [/work|job|profession|office/i, '💼'],
  [/health|body|doctor/i, '🩺'],
  [/hobb|free time|sport|music/i, '🎉'],
  [/animal|pet/i, '🐶'],
];

function emojiForTheme(theme: Theme, index: number): string {
  const text = `${theme.title} ${theme.description ?? ''}`;
  for (const [re, emoji] of KEYWORD_EMOJIS) {
    if (re.test(text)) return emoji;
  }
  return FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

const ROW_HEIGHT = 128;
// Horizontal position (percent) of each node: left -> center -> right -> center
const X_POSITIONS = [26, 50, 74, 50];

function ProgressRing({ percent, complete }: { percent: number; complete: boolean }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#E5E5E5" strokeWidth="7" />
      {percent > 0 && (
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={complete ? '#FFC800' : '#58CC02'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      )}
    </svg>
  );
}

export default function ThemeMap({
  themes,
  modules,
  items,
  progressMap,
  dueCount,
  sentencePracticeCount,
  onSelectTheme,
  onStartReview,
  onStartSentencePractice,
  onRefresh,
  isRefreshing,
}: ThemeMapProps) {
  const game = useGameState();
  const streak = effectiveStreak(game);

  const totalItems = items.length;
  const practicedItems = items.filter((it) => (progressMap.get(it.id)?.repetitions ?? 0) > 0).length;
  const overallPercent = totalItems > 0 ? Math.round((practicedItems / totalItems) * 100) : 0;

  const stats = themes.map((theme) => {
    const themeItems = items.filter((it) => it.theme_id === theme.id);
    const themeModules = modules.filter((m) => m.theme_id === theme.id);
    const count = themeItems.length;
    const started = themeItems.filter((it) => (progressMap.get(it.id)?.repetitions ?? 0) > 0).length;
    const completedModules = themeModules.filter((m) => {
      const mItems = themeItems.filter((it) => it.module_id === m.id);
      return mItems.length > 0 && mItems.every((it) => (progressMap.get(it.id)?.repetitions ?? 0) > 0);
    }).length;
    const percent = count > 0 ? Math.round((started / count) * 100) : 0;
    return {
      theme,
      count,
      started,
      moduleCount: themeModules.length,
      completedModules,
      percent,
      isComplete: count > 0 && percent === 100,
    };
  });

  const activeIndex = stats.findIndex((s) => s.count > 0 && !s.isComplete);

  // Winding connector path through node centers (viewBox is in percent units)
  const centers = stats.map((_, i) => ({
    x: X_POSITIONS[i % X_POSITIONS.length],
    y: i * ROW_HEIGHT + ROW_HEIGHT / 2 - 10,
  }));
  const pathD = centers
    .map((c, i) => {
      if (i === 0) return `M ${c.x} ${c.y}`;
      const p = centers[i - 1];
      const midY = (p.y + c.y) / 2;
      return `C ${p.x} ${midY}, ${c.x} ${midY}, ${c.x} ${c.y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-1 flex-col gap-5 pb-10">
      {/* Sticky gamification top bar */}
      <header className="sticky top-0 z-30 -mx-4 -mt-4 flex items-center justify-between gap-2 border-b-2 border-[#E5E5E5] bg-white px-4 py-3">
        <div
          className="flex items-center gap-1.5 text-base font-black text-[#FF9600]"
          title="Daily streak"
        >
          <Flame className={`h-6 w-6 ${streak > 0 ? 'fill-[#FF9600]' : 'text-[#AFAFAF]'}`} />
          <span className={streak > 0 ? '' : 'text-[#AFAFAF]'}>
            {streak} {streak === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-base font-black text-[#E5A500]" title="Total XP">
          <Zap className="h-6 w-6 fill-[#FFC800] text-[#FFC800]" />
          <span>{game.xp} XP</span>
        </div>
        <div className="rounded-xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] px-2.5 py-1 text-xs font-black tracking-wide text-[#1899D6] uppercase">
          A1 Goal · {overallPercent}%
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSoundOn(!game.soundOn)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#AFAFAF] transition active:scale-90"
            aria-label={game.soundOn ? 'Mute sounds' : 'Unmute sounds'}
          >
            {game.soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#AFAFAF] transition active:scale-90 disabled:opacity-50"
            aria-label="Refresh progress"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Quick review banner */}
      {dueCount > 0 && (
        <section className="animate-fade-in flex flex-col gap-3 rounded-2xl border-2 border-b-4 border-[#E5A500] bg-[#FFC800] p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-2xl">
              ⚡
            </div>
            <div>
              <p className="text-lg leading-tight font-black">Quick Review</p>
              <p className="text-sm font-bold text-white/90">
                {dueCount} {dueCount === 1 ? 'word is' : 'words are'} ready to review
              </p>
            </div>
          </div>
          <button type="button" onClick={onStartReview} className="btn-3d btn-white w-full !text-[#E5A500]">
            Start Review
          </button>
        </section>
      )}

      {sentencePracticeCount > 0 && (
        <button
          type="button"
          onClick={onStartSentencePractice}
          className="btn-3d btn-blue w-full justify-start !px-4 text-left normal-case"
        >
          <PenLine className="h-6 w-6 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-black tracking-wide uppercase">Sentence Writing Practice</span>
            <span className="text-xs font-bold text-white/85">
              Translate full sentences ({sentencePracticeCount} ready)
            </span>
          </span>
        </button>
      )}

      {/* Winding path */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-black tracking-wider text-[#AFAFAF] uppercase">
            Your Path · {themes.length} Units
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-black">
            <span className="text-[#1899D6]">der</span>
            <span className="text-[#EA2B2B]">die</span>
            <span className="text-[#58A700]">das</span>
          </div>
        </div>

        <div className="relative" style={{ height: stats.length * ROW_HEIGHT }}>
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 100 ${stats.length * ROW_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={pathD}
              fill="none"
              stroke="#E5E5E5"
              strokeWidth="8"
              strokeDasharray="2 14"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {stats.map(({ theme, count, started, moduleCount, completedModules, percent, isComplete }, i) => {
            const isActive = i === activeIndex;
            const x = X_POSITIONS[i % X_POSITIONS.length];
            const bubbleColor = isComplete
              ? 'border-[#E5A500] bg-[#FFC800]'
              : isActive
                ? 'border-[#58A700] bg-[#58CC02]'
                : count > 0
                  ? 'border-[#1899D6] bg-[#1CB0F6]'
                  : 'border-[#CFCFCF] bg-[#E5E5E5]';

            return (
              <div
                key={theme.id}
                className="absolute flex w-36 -translate-x-1/2 flex-col items-center"
                style={{ left: `${x}%`, top: i * ROW_HEIGHT }}
              >
                {isActive && (
                  <div className="animate-bob absolute -top-9 z-10 rounded-xl border-2 border-b-4 border-[#E5E5E5] bg-white px-3 py-1 text-xs font-black tracking-wider text-[#58A700] uppercase">
                    {started === 0 ? 'Start' : 'Continue'}
                    <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-[#E5E5E5] bg-white" />
                  </div>
                )}

                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => onSelectTheme(theme)}
                  className="relative h-[88px] w-[88px] transition active:scale-95 disabled:opacity-60"
                  aria-label={`${theme.title} — ${percent}% started`}
                >
                  <ProgressRing percent={percent} complete={isComplete} />
                  <span
                    className={`absolute inset-[9px] flex items-center justify-center rounded-full border-b-[6px] text-3xl ${bubbleColor} ${isActive ? 'animate-pop' : ''}`}
                  >
                    {emojiForTheme(theme, i)}
                  </span>
                  {isComplete && (
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#58CC02] text-xs text-white">
                      ✓
                    </span>
                  )}
                </button>

                <p className="mt-1.5 line-clamp-2 text-center text-xs leading-tight font-black text-[#4B4B4B]">
                  {theme.title}
                </p>
                <p className="flex items-center gap-1 text-[10px] font-bold text-[#AFAFAF]">
                  {moduleCount > 0 ? `${completedModules}/${moduleCount} modules · ` : ''}
                  {count} words
                  {count > 0 && started > 0 && started < count && <Sparkles className="h-3 w-3 text-[#FFC800]" />}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
