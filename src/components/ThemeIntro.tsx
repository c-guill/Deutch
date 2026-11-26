import { ArrowLeft, BookMarked, Play, Volume2 } from 'lucide-react';
import type { LearningItem, Theme, UserProgress } from '../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../lib/gender';
import { speakGerman } from '../lib/speech';

interface ThemeIntroProps {
  theme: Theme;
  themeItems: LearningItem[];
  progressMap: Map<string, UserProgress>;
  onBack: () => void;
  onStartLesson: () => void;
}

export default function ThemeIntro({
  theme,
  themeItems,
  progressMap,
  onBack,
  onStartLesson,
}: ThemeIntroProps) {
  const previewItems = themeItems.slice(0, 12);
  const lessonCount = Math.min(10, themeItems.length);

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
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wider text-[#1CB0F6] uppercase">
            Unit {String(theme.order_index).padStart(2, '0')} · Theme Essentials
          </p>
          <h1 className="truncate text-xl font-black text-[#4B4B4B]">{theme.title}</h1>
        </div>
      </header>

      <section className="rounded-2xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-black tracking-wider text-[#1899D6] uppercase">
          <BookMarked className="h-4 w-4" />
          <span>Key grammar rules</span>
        </div>
        <p className="text-sm leading-relaxed font-bold text-[#4B4B4B]">{theme.grammar_focus}</p>
        <p className="mt-3 text-xs leading-relaxed font-bold text-[#777777]">{theme.description}</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black tracking-wider text-[#AFAFAF] uppercase">
            Core vocabulary ({themeItems.length})
          </h2>
          <span className="text-xs font-bold text-[#AFAFAF]">Tap speaker to listen</span>
        </div>

        <div className="flex flex-col gap-3">
          {previewItems.map((item) => {
            const gender = getGenderStyle(item.article);
            const reps = progressMap.get(item.id)?.repetitions ?? 0;
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
                    {item.plural && (
                      <span className="text-xs font-bold text-[#AFAFAF]">(Pl. {item.plural})</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-bold text-[#777777]">{item.translation}</p>
                  {reps > 0 && (
                    <span className="mt-1 inline-block text-[11px] font-black text-[#58A700]">
                      {reps >= 3 ? '⭐ Mastered' : `Level ${reps}`}
                    </span>
                  )}
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

        {themeItems.length > previewItems.length && (
          <p className="text-center text-xs font-bold text-[#AFAFAF]">
            +{themeItems.length - previewItems.length} more words included in lessons
          </p>
        )}
      </section>

      <div className="fixed right-0 bottom-0 left-0 z-20 mx-auto w-full max-w-[480px] border-t-2 border-[#E5E5E5] bg-white px-5 py-4">
        <button
          type="button"
          disabled={lessonCount === 0}
          onClick={onStartLesson}
          className="btn-3d btn-green w-full !min-h-14 !text-base"
        >
          <Play className="h-5 w-5 fill-current" />
          <span>Start lesson · {lessonCount} exercises</span>
        </button>
      </div>
    </div>
  );
}
