import { Flame, PenLine, RefreshCw, Volume2, VolumeX, Zap, BookOpen } from 'lucide-react';
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
  onStartModule: (theme: Theme, module: Module, previousModuleIds: string[]) => void;
  onStartReview: () => void;
  onStartSentencePractice: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const FALLBACK_EMOJIS = ['👋', '🔢', '🎨', '👨‍👩‍👧', '🍎', '🏠', '🕐', '🛒', '🚌', '⛅', '💼', '🩺', '🎉', '✈️', '📅', '💬', '📚', '🏆'];

const KEYWORD_EMOJIS: Array<[RegExp, string]> = [
  [/greet|hello|introduc|meeting/i, '👋'],
  [/pronoun|grammar|function word/i, '🧩'],
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

const ROW_HEIGHT = 124;
// Horizontal position (percent) of each module node: left -> center -> right -> center
const X_POSITIONS = [26, 50, 74, 50];

function ProgressRing({ percent, complete }: { percent: number; complete: boolean }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#E5E5E5" strokeWidth="8" />
      {percent > 0 && (
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={complete ? '#FFC800' : '#58CC02'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      )}
    </svg>
  );
}

const isStarted = (progressMap: Map<string, UserProgress>, id: string) =>
  (progressMap.get(id)?.repetitions ?? 0) >= 1;

export default function ThemeMap({
  themes,
  modules,
  items,
  progressMap,
  dueCount,
  sentencePracticeCount,
  onSelectTheme,
  onStartModule,
  onStartReview,
  onStartSentencePractice,
  onRefresh,
  isRefreshing,
}: ThemeMapProps) {
  const game = useGameState();
  const streak = effectiveStreak(game);

  const totalItems = items.length;
  const practicedItems = items.filter((it) => isStarted(progressMap, it.id)).length;
  const overallPercent = totalItems > 0 ? Math.round((practicedItems / totalItems) * 100) : 0;

  // Pre-compute per-theme / per-module stats
  const themeSections = themes.map((theme, themeIdx) => {
    const themeItems = items.filter((it) => it.theme_id === theme.id);
    const themeModules = modules
      .filter((m) => m.theme_id === theme.id)
      .sort((a, b) => a.order_index - b.order_index);
    const acquired = themeItems.filter((it) => isStarted(progressMap, it.id)).length;

    const moduleStats = themeModules.map((mod) => {
      const modItems = themeItems.filter((it) => it.module_id === mod.id);
      const started = modItems.filter((it) => isStarted(progressMap, it.id)).length;
      return {
        mod,
        total: modItems.length,
        started,
        percent: modItems.length > 0 ? Math.round((started / modItems.length) * 100) : 0,
        isComplete: modItems.length > 0 && started === modItems.length,
      };
    });

    return { theme, themeIdx, themeItems, acquired, moduleStats };
  });

  // First module (across the whole path) that is not completed yet -> gets the START tooltip
  let activeModuleId: string | null = null;
  for (const section of themeSections) {
    const next = section.moduleStats.find((m) => m.total > 0 && !m.isComplete);
    if (next) {
      activeModuleId = next.mod.id;
      break;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 pb-10">
      {/* Sticky gamification top bar */}
      <header className="sticky top-0 z-30 -mx-4 -mt-4 flex items-center justify-between gap-2 border-b-2 border-[#E5E5E5] bg-white px-4 py-3">
        <div className="flex items-center gap-1.5 text-base font-black text-[#FF9600]" title="Daily streak">
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

      {/* Themes: chapter banner + winding module path */}
      {themeSections.map(({ theme, themeIdx, themeItems, acquired, moduleStats }) => {
        const themePercent = themeItems.length > 0 ? Math.round((acquired / themeItems.length) * 100) : 0;
        const themeComplete = themeItems.length > 0 && acquired === themeItems.length;
        const completedModules = moduleStats.filter((m) => m.isComplete).length;

        const centers = moduleStats.map((_, i) => ({
          x: X_POSITIONS[i % X_POSITIONS.length],
          y: i * ROW_HEIGHT + 44,
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
          <section key={theme.id} className="flex flex-col gap-3">
            {/* Chapter banner */}
            <button
              type="button"
              onClick={() => onSelectTheme(theme)}
              disabled={themeItems.length === 0}
              className={`btn-3d !h-auto w-full flex-col !items-stretch !gap-2 !rounded-2xl !p-4 text-left normal-case ${
                themeComplete ? 'btn-gold' : 'btn-green'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[11px] font-black tracking-widest text-white/80 uppercase">
                    Unit {String(theme.order_index).padStart(2, '0')}
                    {moduleStats.length > 0 ? ` · ${completedModules}/${moduleStats.length} modules` : ''}
                  </span>
                  <span className="mt-0.5 block text-lg leading-tight font-black tracking-normal">
                    {theme.title}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs font-bold tracking-normal text-white/90">
                    {theme.description}
                  </span>
                </span>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-2xl">
                  {emojiForTheme(theme, themeIdx)}
                </span>
              </span>

              <span className="flex flex-col gap-1.5">
                <span className="relative block h-3 overflow-hidden rounded-full bg-black/15">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-500"
                    style={{ width: `${themePercent}%` }}
                  />
                </span>
                <span className="flex items-center justify-between text-xs font-black tracking-normal">
                  <span>
                    {acquired} / {themeItems.length} words acquired
                  </span>
                  <span className="inline-flex items-center gap-1 text-white/90">
                    <BookOpen className="h-3.5 w-3.5" />
                    Essentials
                  </span>
                </span>
              </span>
            </button>

            {/* Module winding path */}
            {moduleStats.length > 0 && (
              <div className="relative" style={{ height: moduleStats.length * ROW_HEIGHT }}>
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox={`0 0 100 ${moduleStats.length * ROW_HEIGHT}`}
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

                {moduleStats.map(({ mod, total, started, percent, isComplete }, i) => {
                  const isActive = mod.id === activeModuleId;
                  const x = X_POSITIONS[i % X_POSITIONS.length];
                  const previousModuleIds = moduleStats.slice(0, i).map((m) => m.mod.id);
                  const bubbleColor = isComplete
                    ? 'border-[#E5A500] bg-[#FFC800]'
                    : isActive
                      ? 'border-[#58A700] bg-[#58CC02]'
                      : started > 0
                        ? 'border-[#1899D6] bg-[#1CB0F6]'
                        : 'border-[#CFCFCF] bg-[#E5E5E5]';

                  return (
                    <div
                      key={mod.id}
                      className="absolute flex w-40 -translate-x-1/2 flex-col items-center"
                      style={{ left: `${x}%`, top: i * ROW_HEIGHT }}
                    >
                      {isActive && (
                        <div className="animate-bob absolute -top-8 z-10 rounded-xl border-2 border-b-4 border-[#E5E5E5] bg-white px-3 py-1 text-xs font-black tracking-wider text-[#58A700] uppercase">
                          {started === 0 ? 'Start' : 'Continue'}
                          <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-[#E5E5E5] bg-white" />
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={total === 0}
                        onClick={() => onStartModule(theme, mod, previousModuleIds)}
                        className="relative h-[76px] w-[76px] transition active:scale-95 disabled:opacity-60"
                        aria-label={`${mod.order_index}. ${mod.title} (${total} words) — ${percent}% started`}
                      >
                        <ProgressRing percent={percent} complete={isComplete} />
                        <span
                          className={`absolute inset-[8px] flex items-center justify-center rounded-full border-b-[5px] text-xl font-black text-white ${bubbleColor} ${
                            isActive ? 'animate-pop' : ''
                          }`}
                        >
                          {isComplete ? '✓' : mod.order_index}
                        </span>
                      </button>

                      <p className="mt-1 line-clamp-2 text-center text-xs leading-tight font-black text-[#4B4B4B]">
                        {mod.order_index}. {mod.title}
                      </p>
                      <p className="text-[10px] font-bold text-[#AFAFAF]">
                        {total} words{started > 0 && !isComplete ? ` · ${started}/${total}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex items-center justify-center gap-3 pt-2 text-[11px] font-black">
        <span className="text-[#1899D6]">der</span>
        <span className="text-[#EA2B2B]">die</span>
        <span className="text-[#58A700]">das</span>
      </div>
    </div>
  );
}
