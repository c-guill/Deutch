import { useMemo, useState } from 'react';
import { Volume2, Check } from 'lucide-react';
import type { LearningItem } from '../../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../../lib/gender';
import { speakGerman } from '../../lib/speech';
import type { WordDiffPart } from '../../lib/srsEngine';

export interface ExerciseResult {
  isCorrect: boolean;
  isExact: boolean;
  quality: number;
  expectedAnswer: string;
  userAnswer?: string;
  wordDiff?: WordDiffPart[];
}

interface MatchingExerciseProps {
  item: LearningItem;
  peers: LearningItem[];
  disabled: boolean;
  onComplete: (result: ExerciseResult) => void;
}

function shuffleDeterministic<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MatchingExercise({
  item,
  peers,
  disabled,
  onComplete,
}: MatchingExerciseProps) {
  const allFive = useMemo(() => [item, ...peers.slice(0, 4)], [item, peers]);
  const leftItems = useMemo(() => shuffleDeterministic(allFive), [allFive]);
  const rightItems = useMemo(() => shuffleDeterministic(allFive), [allFive]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(() => new Set());
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const attemptMatch = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      const nextMatched = new Set(matchedIds);
      nextMatched.add(leftId);
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);

      if (nextMatched.size === allFive.length) {
        const quality = mistakes === 0 ? 5 : mistakes === 1 ? 4 : 2;
        onComplete({
          isCorrect: mistakes <= 1,
          isExact: mistakes === 0,
          quality,
          expectedAnswer: `${formatGermanWithArticle(item.german, item.article)} = ${item.translation}`,
        });
      }
    } else {
      setMistakes((m) => m + 1);
      setWrongPair({ left: leftId, right: rightId });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 550);
    }
  };

  const handleLeftClick = (candidate: LearningItem) => {
    if (disabled || matchedIds.has(candidate.id) || wrongPair) return;
    speakGerman(formatGermanWithArticle(candidate.german, candidate.article));
    if (selectedRight) {
      attemptMatch(candidate.id, selectedRight);
    } else {
      setSelectedLeft(selectedLeft === candidate.id ? null : candidate.id);
    }
  };

  const handleRightClick = (candidate: LearningItem) => {
    if (disabled || matchedIds.has(candidate.id) || wrongPair) return;
    if (selectedLeft) {
      attemptMatch(selectedLeft, candidate.id);
    } else {
      setSelectedRight(selectedRight === candidate.id ? null : candidate.id);
    }
  };

  const tileState = (isMatched: boolean, isWrong: boolean, isSelected: boolean) =>
    isMatched ? 'tile-correct opacity-70' : isWrong ? 'tile-wrong' : isSelected ? 'tile-selected' : '';

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-black text-[#4B4B4B]">Match the pairs</h2>
        <p className="mt-1 flex items-center justify-between text-sm font-bold text-[#AFAFAF]">
          <span>Tap a German word, then its English meaning.</span>
          <span className="shrink-0 text-[#58A700]">
            {matchedIds.size}/{allFive.length}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {leftItems.map((entry) => {
            const isMatched = matchedIds.has(entry.id);
            const isSelected = selectedLeft === entry.id;
            const isWrong = wrongPair?.left === entry.id;
            const gender = getGenderStyle(entry.article);

            return (
              <button
                key={`de-${entry.id}`}
                type="button"
                disabled={disabled || isMatched}
                onClick={() => handleLeftClick(entry)}
                className={`tile min-h-[60px] w-full justify-between text-sm ${tileState(isMatched, isWrong, isSelected)}`}
              >
                <span className="leading-snug">
                  {entry.article && (
                    <span className={`mr-1 font-black ${isSelected || isMatched || isWrong ? '' : gender?.articleText ?? ''}`}>
                      {entry.article}
                    </span>
                  )}
                  {entry.german}
                </span>
                {isMatched ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <Volume2 className="h-4 w-4 shrink-0 text-[#AFAFAF]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          {rightItems.map((entry) => {
            const isMatched = matchedIds.has(entry.id);
            const isSelected = selectedRight === entry.id;
            const isWrong = wrongPair?.right === entry.id;

            return (
              <button
                key={`en-${entry.id}`}
                type="button"
                disabled={disabled || isMatched}
                onClick={() => handleRightClick(entry)}
                className={`tile min-h-[60px] w-full justify-between text-sm ${tileState(isMatched, isWrong, isSelected)}`}
              >
                <span className="leading-snug">{entry.translation}</span>
                {isMatched && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
