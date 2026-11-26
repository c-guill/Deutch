import { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { LearningItem } from '../../types/database';
import type { ExerciseResult } from './MatchingExercise';
import { speakGerman } from '../../lib/speech';

interface ClozeExerciseProps {
  item: LearningItem;
  disabled: boolean;
  onComplete: (result: ExerciseResult) => void;
}

function splitSentenceByTarget(sentence: string, target: string): { before: string; after: string } {
  const exactIdx = sentence.indexOf(target);
  if (exactIdx !== -1) {
    return {
      before: sentence.slice(0, exactIdx),
      after: sentence.slice(exactIdx + target.length),
    };
  }
  const ciIdx = sentence.toLowerCase().indexOf(target.toLowerCase());
  if (ciIdx !== -1) {
    return {
      before: sentence.slice(0, ciIdx),
      after: sentence.slice(ciIdx + target.length),
    };
  }
  return { before: `${sentence} `, after: '' };
}

export default function ClozeExercise({ item, disabled, onComplete }: ClozeExerciseProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const choices = useMemo(() => {
    const unique = new Set<string>([item.cloze_target]);
    for (const d of item.distractors || []) {
      if (d && unique.size < 4) unique.add(d);
    }
    const list = Array.from(unique);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [item]);

  const { before, after } = useMemo(
    () => splitSentenceByTarget(item.sentence_de, item.cloze_target),
    [item.sentence_de, item.cloze_target]
  );

  const isTargetChoice = (c: string) => c.trim().toLowerCase() === item.cloze_target.trim().toLowerCase();

  const handleSelect = (choice: string) => {
    if (disabled || selected !== null) return;
    setSelected(choice);

    const isCorrect = isTargetChoice(choice);
    speakGerman(item.sentence_de);

    onComplete({
      isCorrect,
      isExact: isCorrect,
      quality: isCorrect ? 5 : 1,
      expectedAnswer: item.cloze_target,
      userAnswer: choice,
    });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <h2 className="text-2xl font-black text-[#4B4B4B]">Fill in the blank</h2>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => speakGerman(item.sentence_de)}
          className="btn-3d btn-blue !h-14 !min-h-0 !w-14 shrink-0 !rounded-2xl !px-0"
          aria-label="Listen to German sentence"
        >
          <Volume2 className="h-6 w-6" />
        </button>
        <div className="card-3d flex-1 p-4">
          <p className="text-xl leading-loose font-black text-[#4B4B4B]">
            <span>{before}</span>
            <span
              className={`mx-1 inline-block min-w-[84px] rounded-xl border-2 border-b-4 px-3 py-0.5 text-center ${
                selected === null
                  ? 'border-[#E5E5E5] bg-[#F7F7F7] text-transparent'
                  : isTargetChoice(selected)
                    ? 'border-[#58CC02] bg-[#D7FFB8] text-[#58A700]'
                    : 'border-[#FF4B4B] bg-[#FFDFE0] text-[#EA2B2B]'
              }`}
            >
              {selected ?? '_____'}
            </span>
            <span>{after}</span>
          </p>
          <p className="mt-2 text-sm font-bold text-[#AFAFAF]">{item.sentence_translation}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {choices.map((choice) => {
          const isChosen = selected === choice;
          let style = '';
          if (selected !== null) {
            style = isTargetChoice(choice) ? 'tile-correct' : isChosen ? 'tile-wrong' : 'tile-dim';
          }
          return (
            <button
              key={choice}
              type="button"
              disabled={disabled || selected !== null}
              onClick={() => handleSelect(choice)}
              className={`tile w-full justify-center text-lg ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
