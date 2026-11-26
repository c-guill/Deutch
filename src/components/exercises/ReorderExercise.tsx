import { useMemo, useState } from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import type { LearningItem } from '../../types/database';
import type { ExerciseResult } from './MatchingExercise';
import { evaluateTypedAnswer } from '../../lib/srsEngine';
import { speakGerman } from '../../lib/speech';

interface ReorderExerciseProps {
  item: LearningItem;
  disabled: boolean;
  onComplete: (result: ExerciseResult) => void;
}

interface WordToken {
  uid: string;
  text: string;
}

export default function ReorderExercise({ item, disabled, onComplete }: ReorderExerciseProps) {
  const initialTokens = useMemo<WordToken[]>(() => {
    const words = item.sentence_de
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((text, idx) => ({ uid: `${idx}-${text}`, text }));

    // Shuffle and guarantee it is not identical to the original order when > 1 token
    const shuffled = [...words];
    for (let attempt = 0; attempt < 6; attempt++) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const same = shuffled.every((tok, idx) => tok.text === words[idx].text);
      if (!same || words.length <= 1) break;
    }
    return shuffled;
  }, [item.sentence_de]);

  const [selectedTokens, setSelectedTokens] = useState<WordToken[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const selectedIds = useMemo(
    () => new Set(selectedTokens.map((t) => t.uid)),
    [selectedTokens]
  );

  const handleAddToken = (tok: WordToken) => {
    if (disabled || submitted || selectedIds.has(tok.uid)) return;
    setSelectedTokens((prev) => [...prev, tok]);
  };

  const handleRemoveToken = (uid: string) => {
    if (disabled || submitted) return;
    setSelectedTokens((prev) => prev.filter((t) => t.uid !== uid));
  };

  const handleReset = () => {
    if (disabled || submitted) return;
    setSelectedTokens([]);
  };

  const handleSubmit = () => {
    if (disabled || submitted || selectedTokens.length === 0) return;
    setSubmitted(true);

    const builtSentence = selectedTokens.map((t) => t.text).join(' ');
    const evaluation = evaluateTypedAnswer(builtSentence, item.sentence_de);
    speakGerman(item.sentence_de);

    onComplete({
      isCorrect: evaluation.isExact,
      isExact: evaluation.isExact,
      quality: evaluation.isExact ? 5 : 1,
      expectedAnswer: item.sentence_de,
      userAnswer: builtSentence,
    });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <h2 className="text-2xl font-black text-[#4B4B4B]">Build the German sentence</h2>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => speakGerman(item.sentence_de)}
          className="btn-3d btn-blue !h-14 !min-h-0 !w-14 shrink-0 !rounded-2xl !px-0"
          aria-label="Listen to German sentence"
        >
          <Volume2 className="h-6 w-6" />
        </button>
        <p className="card-3d flex-1 px-4 py-3 text-lg leading-snug font-black text-[#4B4B4B]">
          {item.sentence_translation}
        </p>
      </div>

      {/* Answer tray with writing lines */}
      <div className="min-h-[120px] rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] p-3">
        {selectedTokens.length === 0 ? (
          <p className="py-8 text-center text-sm font-bold text-[#AFAFAF]">
            Tap the words below in the correct order
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedTokens.map((tok) => (
              <button
                key={tok.uid}
                type="button"
                disabled={disabled || submitted}
                onClick={() => handleRemoveToken(tok.uid)}
                className="tile tile-selected !min-h-[46px] !px-3.5 !py-2 text-base"
              >
                {tok.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {initialTokens.map((tok) => {
          const used = selectedIds.has(tok.uid);
          return (
            <button
              key={tok.uid}
              type="button"
              disabled={disabled || submitted || used}
              onClick={() => handleAddToken(tok)}
              className={`tile !min-h-[48px] !px-3.5 !py-2 text-base ${used ? 'tile-used' : ''}`}
            >
              {tok.text}
            </button>
          );
        })}
      </div>

      {!submitted && (
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            disabled={selectedTokens.length === 0}
            onClick={handleReset}
            className="btn-3d btn-white !px-4 !text-[#AFAFAF]"
            aria-label="Clear answer"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={selectedTokens.length !== initialTokens.length}
            onClick={handleSubmit}
            className="btn-3d btn-green flex-1"
          >
            Check
          </button>
        </div>
      )}
    </div>
  );
}
