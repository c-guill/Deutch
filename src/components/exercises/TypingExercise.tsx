import { useMemo, useRef, useState } from 'react';
import { HelpCircle, Volume2 } from 'lucide-react';
import type { LearningItem } from '../../types/database';
import type { ExerciseResult } from './MatchingExercise';
import { formatGermanWithArticle } from '../../lib/gender';
import { evaluateTypedAnswer, type TypingMode } from '../../lib/srsEngine';
import { speakGerman } from '../../lib/speech';

interface TypingExerciseProps {
  item: LearningItem;
  mode: TypingMode;
  disabled: boolean;
  onComplete: (result: ExerciseResult) => void;
}

const GERMAN_SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

export default function TypingExercise({
  item,
  mode,
  disabled,
  onComplete,
}: TypingExerciseProps) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isSentenceMode = mode === 'sentence';
  const expected = isSentenceMode
    ? item.sentence_de.trim()
    : formatGermanWithArticle(item.german, item.article);
  const promptText = isSentenceMode ? item.sentence_translation : item.translation;
  const expectsArticle = !isSentenceMode && Boolean(item.article);

  const expectedWords = useMemo(
    () =>
      expected
        .split(/\s+/)
        .map((w) => w.replace(/^[.,!?;:"'„“()]+|[.,!?;:"'„“()]+$/g, ''))
        .filter(Boolean),
    [expected]
  );

  const insertChar = (char: string) => {
    if (disabled || submitted) return;
    const el = inputRef.current;
    if (!el) {
      setValue((prev) => prev + char);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + char + value.slice(end);
    setValue(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  };

  const handleRevealHint = () => {
    if (disabled || submitted || revealedCount >= expectedWords.length) return;
    setRevealedCount((c) => Math.min(expectedWords.length, c + 1));
  };

  const submitAnswer = () => {
    if (disabled || submitted || !value.trim()) return;
    setSubmitted(true);

    const evaluation = evaluateTypedAnswer(value, expected, mode);
    speakGerman(expected);

    // Slight quality adjustment if multiple hints were used
    const quality = !evaluation.isCorrect
      ? 1
      : evaluation.isExact && revealedCount === 0
        ? 5
        : 4;

    onComplete({
      isCorrect: evaluation.isCorrect,
      isExact: evaluation.isExact,
      quality,
      expectedAnswer: expected,
      userAnswer: value.trim(),
      wordDiff: evaluation.wordDiff,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAnswer();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in flex flex-col gap-4">
      <h2 className="text-2xl font-black text-[#4B4B4B]">
        {isSentenceMode ? 'Write this in German' : 'Translate into German'}
      </h2>

      {/* Prompt bubble */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => speakGerman(expected, isSentenceMode ? 0.85 : 0.92)}
          className="btn-3d btn-blue !h-14 !min-h-0 !w-14 shrink-0 !rounded-2xl !px-0"
          aria-label="Listen to German audio hint"
        >
          <Volume2 className="h-6 w-6" />
        </button>
        <div className="card-3d flex-1 px-4 py-3">
          <p className={`font-black text-[#4B4B4B] ${isSentenceMode ? 'text-xl leading-snug' : 'text-2xl'}`}>
            {promptText}
          </p>
          {expectsArticle && (
            <p className="mt-1.5 text-xs font-black">
              <span className="text-[#AFAFAF]">Include the article: </span>
              <span className="text-[#1899D6]">der</span>
              <span className="text-[#AFAFAF]"> / </span>
              <span className="text-[#EA2B2B]">die</span>
              <span className="text-[#AFAFAF]"> / </span>
              <span className="text-[#58A700]">das</span>
            </p>
          )}
        </div>
      </div>

      {/* Word-count placeholders & progressive first-letter hints */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black tracking-wider text-[#AFAFAF] uppercase">
          {expectedWords.length} {expectedWords.length === 1 ? 'word' : 'words'}
        </span>
        {expectedWords.map((word, idx) => {
          const isRevealed = idx < revealedCount;
          return (
            <span
              key={`${idx}-${word}`}
              className={`inline-flex min-w-[34px] items-center justify-center rounded-lg border-2 border-b-4 px-2 py-0.5 font-mono text-xs font-black ${
                isRevealed
                  ? 'border-[#FFE27A] bg-[#FFF8D6] text-[#E5A500]'
                  : 'border-[#E5E5E5] bg-white text-[#AFAFAF]'
              }`}
            >
              {isRevealed ? `${word[0]}___` : '___'}
            </span>
          );
        })}
        {!submitted && (
          <button
            type="button"
            disabled={disabled || revealedCount >= expectedWords.length}
            onClick={handleRevealHint}
            className="btn-3d btn-white ml-auto !min-h-[38px] !rounded-xl !px-3 !text-xs !text-[#E5A500]"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Hint{revealedCount > 0 ? ` ${revealedCount}/${expectedWords.length}` : ''}</span>
          </button>
        )}
      </div>

      {/* Input & German character keys */}
      <div className="flex flex-col gap-3">
        {isSentenceMode ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={3}
            value={value}
            disabled={disabled || submitted}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type in German"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            className="text-input min-h-[96px] resize-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            disabled={disabled || submitted}
            onChange={(e) => setValue(e.target.value)}
            placeholder={expectsArticle ? 'e.g. der Tisch' : 'Type in German'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="text-input min-h-[56px]"
          />
        )}

        <div
          className="grid grid-cols-7 gap-1.5 rounded-2xl bg-[#F0F0F0] p-1.5"
          role="toolbar"
          aria-label="German special characters"
        >
          {GERMAN_SPECIAL_CHARS.map((char) => (
            <button
              key={char}
              type="button"
              disabled={disabled || submitted}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertChar(char)}
              className="key-3d"
            >
              {char}
            </button>
          ))}
        </div>

        {!submitted && (
          <button type="submit" disabled={!value.trim()} className="btn-3d btn-green w-full !min-h-14">
            Check
          </button>
        )}
      </div>
    </form>
  );
}
