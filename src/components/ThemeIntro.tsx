import { useState } from 'react';
import { ArrowLeft, BookMarked, Check, ChevronDown, ChevronUp, Play, Volume2 } from 'lucide-react';
import type { LearningItem, Module, Theme, UserProgress } from '../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../lib/gender';
import { speakGerman } from '../lib/speech';

interface ThemeIntroProps {
  theme: Theme;
  themeModules: Module[];
  themeItems: LearningItem[];
  progressMap: Map<string, UserProgress>;
  onBack: () => void;
  onStartLesson: (module?: Module) => void;
}

export default function ThemeIntro({
  theme,
  themeModules,
  themeItems,
  progressMap,
  onBack,
  onStartLesson,
}: ThemeIntroProps) {
  const sortedModules = [...themeModules].sort((a, b) => a.order_index - b.order_index);

  // Find the first module that isn't 100% started yet (or default to first module)
  const firstActiveModule =
    sortedModules.find((m) => {
      const mItems = themeItems.filter((it) => it.module_id === m.id);
      return mItems.some((it) => (progressMap.get(it.id)?.repetitions ?? 0) === 0);
    }) ?? sortedModules[0];

  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(
    firstActiveModule?.id ?? null
  );

  const totalStarted = themeItems.filter((it) => (progressMap.get(it.id)?.repetitions ?? 0) > 0).length;
  const themePercent =
    themeItems.length > 0 ? Math.round((totalStarted / themeItems.length) * 100) : 0;

  return (
    <div className="animate-fade-in flex flex-1 flex-col gap-5 pb-28">
      <header className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#AFAFAF] transition hover:bg-[#F7F7F7] active:scale-90"
          aria-label="Back to path"
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black tracking-wider text-[#1CB0F6] uppercase">
            Unit {String(theme.order_index).padStart(2, '0')} · {sortedModules.length} Modules ·{' '}
            {themePercent}%
          </p>
          <h1 className="truncate text-xl font-black text-[#4B4B4B]">{theme.title}</h1>
        </div>
      </header>

      <section className="rounded-2xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-black tracking-wider text-[#1899D6] uppercase">
          <BookMarked className="h-4 w-4" />
          <span>Theme Essentials · Key grammar rules</span>
        </div>
        <p className="text-sm leading-relaxed font-bold text-[#4B4B4B]">{theme.grammar_focus}</p>
        <p className="mt-3 text-xs leading-relaxed font-bold text-[#777777]">{theme.description}</p>
      </section>

      {sortedModules.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black tracking-wider text-[#AFAFAF] uppercase">
              Progressive Sub-Modules ({sortedModules.length})
            </h2>
            <span className="text-xs font-bold text-[#AFAFAF]">{themeItems.length} words total</span>
          </div>

          <div className="flex flex-col gap-3">
            {sortedModules.map((mod) => {
              const modItems = themeItems.filter((it) => it.module_id === mod.id);
              const startedCount = modItems.filter(
                (it) => (progressMap.get(it.id)?.repetitions ?? 0) > 0
              ).length;
              const masteredCount = modItems.filter(
                (it) => (progressMap.get(it.id)?.repetitions ?? 0) >= 3
              ).length;
              const modPercent =
                modItems.length > 0 ? Math.round((startedCount / modItems.length) * 100) : 0;
              const isDone = modItems.length > 0 && startedCount === modItems.length;
              const isNext = firstActiveModule?.id === mod.id && !isDone;
              const isExpanded = expandedModuleId === mod.id;

              return (
                <div
                  key={mod.id}
                  className={`rounded-2xl border-2 border-b-4 transition ${
                    isDone
                      ? 'border-[#A5E56B] bg-[#F4FFE9]'
                      : isNext
                        ? 'border-[#84D8FF] bg-white'
                        : 'border-[#E5E5E5] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-b-4 text-sm font-black text-white ${
                          isDone
                            ? 'border-[#58A700] bg-[#58CC02]'
                            : isNext
                              ? 'border-[#1899D6] bg-[#1CB0F6]'
                              : 'border-[#CFCFCF] bg-[#AFAFAF]'
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-5 w-5" strokeWidth={3} />
                        ) : (
                          String(mod.order_index).padStart(2, '0')
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-black text-[#4B4B4B]">
                            {mod.title}
                          </h3>
                          {isNext && (
                            <span className="shrink-0 rounded-full bg-[#DDF4FF] px-2 py-0.5 text-[10px] font-black tracking-wider text-[#1899D6] uppercase">
                              Next
                            </span>
                          )}
                        </div>
                        {mod.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs font-bold text-[#777777]">
                            {mod.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2.5">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5E5E5]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isDone ? 'bg-[#58CC02]' : 'bg-[#1CB0F6]'
                              }`}
                              style={{ width: `${modPercent}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-black text-[#AFAFAF]">
                            {startedCount}/{modItems.length} words
                            {masteredCount > 0 ? ` · ⭐ ${masteredCount}` : ''}
                          </span>
                        </div>
                      </div>

                      <span className="mt-1 shrink-0 text-[#AFAFAF]">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={modItems.length === 0}
                      onClick={() => onStartLesson(mod)}
                      className={`btn-3d !min-h-[44px] shrink-0 !rounded-xl !px-3.5 !text-xs ${
                        isDone ? 'btn-gold' : isNext ? 'btn-green' : 'btn-blue'
                      }`}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>{isDone ? 'Practice' : startedCount > 0 ? 'Continue' : 'Start'}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col gap-2 border-t-2 border-[#E5E5E5] bg-[#F7F7F7] p-3">
                      {modItems.map((item) => {
                        const gender = getGenderStyle(item.article);
                        const reps = progressMap.get(item.id)?.repetitions ?? 0;
                        const spoken = formatGermanWithArticle(item.german, item.article);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#E5E5E5] bg-white px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.article && gender && (
                                  <span
                                    className={`rounded-md border px-1.5 py-0.5 text-[11px] font-black ${gender.badgeBg} ${gender.badgeBorder} ${gender.badgeText}`}
                                  >
                                    {item.article}
                                  </span>
                                )}
                                <span className="text-sm font-black text-[#4B4B4B]">
                                  {item.german}
                                </span>
                                {item.plural && (
                                  <span className="text-[11px] font-bold text-[#AFAFAF]">
                                    (Pl. {item.plural})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-[#777777]">{item.translation}</p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {reps > 0 && (
                                <span className="rounded-lg bg-[#D7FFB8] px-2 py-0.5 text-[10px] font-black text-[#58A700]">
                                  {reps >= 3 ? '⭐ Mastered' : `Lv.${reps}`}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => speakGerman(spoken)}
                                className="btn-3d btn-white !h-9 !min-h-0 !w-9 !rounded-lg !px-0"
                                aria-label={`Pronounce ${spoken}`}
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black tracking-wider text-[#AFAFAF] uppercase">
              Core vocabulary ({themeItems.length})
            </h2>
            <span className="text-xs font-bold text-[#AFAFAF]">Tap speaker to listen</span>
          </div>
          <div className="flex flex-col gap-3">
            {themeItems.slice(0, 12).map((item) => {
              const gender = getGenderStyle(item.article);
              const spoken = formatGermanWithArticle(item.german, item.article);
              return (
                <div key={item.id} className="card-3d flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.article && gender && (
                        <span
                          className={`rounded-lg border-2 px-2 py-0.5 text-xs font-black ${gender.badgeBg} ${gender.badgeBorder} ${gender.badgeText}`}
                        >
                          {item.article}
                        </span>
                      )}
                      <span className="text-base font-black text-[#4B4B4B]">{item.german}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-[#777777]">{item.translation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakGerman(spoken)}
                    className="btn-3d btn-white !h-12 !min-h-0 !w-12 !rounded-xl !px-0"
                    aria-label={`Pronounce ${spoken}`}
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="fixed right-0 bottom-0 left-0 z-20 mx-auto w-full max-w-[480px] border-t-2 border-[#E5E5E5] bg-white px-5 py-4">
        <button
          type="button"
          disabled={themeItems.length === 0}
          onClick={() => onStartLesson(firstActiveModule)}
          className="btn-3d btn-green w-full !min-h-14 !text-base"
        >
          <Play className="h-5 w-5 fill-current" />
          <span>
            {firstActiveModule
              ? `Start Module ${String(firstActiveModule.order_index).padStart(2, '0')}: ${firstActiveModule.title}`
              : `Start Lesson`}
          </span>
        </button>
      </div>
    </div>
  );
}
