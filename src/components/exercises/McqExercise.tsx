import { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { LearningItem } from '../../types/database';
import type { ExerciseResult } from './MatchingExercise';
import { formatGermanWithArticle, getGenderStyle } from '../../lib/gender';
import { speakGerman } from '../../lib/speech';

interface McqExerciseProps {
  item: LearningItem;
  peers: LearningItem[];
  disabled: boolean;
  onComplete: (result: ExerciseResult) => void;
}

export default function McqExercise({ item, peers, disabled, onComplete }: McqExerciseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const gender = getGenderStyle(item.article);
  const fullWord = formatGermanWithArticle(item.german, item.article);

  const choices = useMemo(() => {
    const unique = new Set<string>([item.translation]);
    for (const p of peers) {
      if (p.translation && unique.size < 4) unique.add(p.translation);
    }
    const list = Array.from(unique);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [item, peers]);

  const handleSelect = (choice: string) => {
    if (disabled || selected !== null) return;
    setSelected(choice);

    const isCorrect = choice === item.translation;
    speakGerman(fullWord);

    onComplete({
      isCorrect,
      isExact: isCorrect,
      quality: isCorrect ? 5 : 1,
      expectedAnswer: `${fullWord} = ${item.translation}`,
      userAnswer: choice,
    });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <h2 className="text-2xl font-black text-[#4B4B4B]">What does this mean?</h2>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => speakGerman(fullWord)}
          className="btn-3d btn-blue !h-14 !min-h-0 !w-14 shrink-0 !rounded-2xl !px-0"
          aria-label={`Listen to ${fullWord}`}
        >
          <Volume2 className="h-6 w-6" />
        </button>
        <p className="card-3d flex-1 px-4 py-3 text-2xl font-black text-[#4B4B4B]">
          {item.article && gender && (
            <span className={`mr-1.5 ${gender.articleText}`}>{item.article}</span>
          )}
          {item.german}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {choices.map((choice, idx) => {
          const isTarget = choice === item.translation;
          const isChosen = selected === choice;

          let style = '';
          if (selected !== null) {
            style = isTarget ? 'tile-correct' : isChosen ? 'tile-wrong' : 'tile-dim';
          }

          return (
            <button
              key={choice}
              type="button"
              disabled={disabled || selected !== null}
              onClick={() => handleSelect(choice)}
              className={`tile w-full text-base ${style}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-xs font-black opacity-70">
                {idx + 1}
              </span>
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
