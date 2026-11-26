import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Loader2, Sparkles, Volume2, X, Zap } from 'lucide-react';
import type { UserProgress } from '../types/database';
import { formatGermanWithArticle, getGenderStyle } from '../lib/gender';
import { recordProgress, type SessionExercise } from '../lib/srsEngine';
import { speakGerman, stopSpeaking } from '../lib/speech';
import { addXp, completeSessionForStreak, playSound } from '../lib/gameState';
import { explainMistake } from '../lib/gemini';
import DiscoveryCard from './DiscoveryCard';
import SessionComplete from './SessionComplete';
import MatchingExercise, { type ExerciseResult } from './exercises/MatchingExercise';
import McqExercise from './exercises/McqExercise';
import ClozeExercise from './exercises/ClozeExercise';
import ReorderExercise from './exercises/ReorderExercise';
import TypingExercise from './exercises/TypingExercise';

interface SessionRunnerProps {
  title: string;
  exercises: SessionExercise[];
  progressMap: Map<string, UserProgress>;
  onProgressUpdated: (updated: UserProgress) => void;
  onExit: () => void;
}

const XP_PER_CORRECT = 10;
const CHEERS = ['Ausgezeichnet!', 'Super!', 'Perfect!'];

export default function SessionRunner({
  title,
  exercises,
  progressMap,
  onProgressUpdated,
  onExit,
}: SessionRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<ExerciseResult | null>(null);
  const [cheer, setCheer] = useState(CHEERS[0]);
  const [correctCount, setCorrectCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [finished, setFinished] = useState(false);
  const [streakInfo, setStreakInfo] = useState({ streak: 0, extendedToday: false });
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const gradedTotal = useMemo(
    () => exercises.filter((e) => e.exerciseType !== 'discovery').length,
    [exercises]
  );

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (exercises.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-base font-black text-[#4B4B4B]">No exercises available for this session yet.</p>
        <button type="button" onClick={onExit} className="btn-3d btn-blue">
          Back to path
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <SessionComplete
        title={title}
        correctCount={correctCount}
        gradedTotal={gradedTotal}
        sessionXp={sessionXp}
        streak={streakInfo.streak}
        streakExtendedToday={streakInfo.extendedToday}
        discoveredCount={discoveredCount}
        reviewCount={reviewCount}
        onExit={onExit}
      />
    );
  }

  const current = exercises[currentIndex];
  const progressPercent = Math.round(
    ((currentIndex + (feedback ? 1 : 0)) / exercises.length) * 100
  );
  const gender = getGenderStyle(current.item.article);

  const advanceStep = () => {
    stopSpeaking();
    setFeedback(null);
    setAiExplanation(null);
    setAiLoading(false);
    setAiError(null);
    if (currentIndex + 1 >= exercises.length) {
      setStreakInfo(completeSessionForStreak());
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleDiscoveryContinue = () => {
    setDiscoveredCount((c) => c + 1);
    advanceStep();
  };

  const handleExerciseComplete = async (result: ExerciseResult) => {
    setFeedback(result);
    if (result.isCorrect) {
      setCorrectCount((c) => c + 1);
      setCombo((c) => c + 1);
      setSessionXp((x) => x + XP_PER_CORRECT);
      addXp(XP_PER_CORRECT);
      setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      playSound('correct');
    } else {
      setCombo(0);
      playSound('wrong');
    }
    if (current.isReview) {
      setReviewCount((r) => r + 1);
    }

    const updated = await recordProgress(
      current.item.id,
      progressMap.get(current.item.id),
      result.quality,
      current.exerciseType
    );
    onProgressUpdated(updated);
  };

  const isTypingExercise =
    current.exerciseType === 'typing' ||
    current.exerciseType === 'typing_word' ||
    current.exerciseType === 'typing_sentence';

  const supportsAiWhyWrong =
    isTypingExercise ||
    current.exerciseType === 'cloze' ||
    current.exerciseType === 'reorder';

  const handleAskWhyWrong = async () => {
    if (!feedback || aiLoading || aiExplanation) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const explanation = await explainMistake({
        expected: feedback.expectedAnswer,
        userAnswer: feedback.userAnswer ?? '',
        sentence: current.item.sentence_de,
        sentenceTranslation: current.item.sentence_translation,
      });
      setAiExplanation(explanation);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to fetch AI explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  const showAnswer = feedback && (!feedback.isCorrect || !feedback.isExact);
  const isLast = currentIndex + 1 >= exercises.length;

  return (
    <div className={`flex flex-1 flex-col gap-5 ${feedback ? 'pb-80' : 'pb-6'}`}>
      {/* Immersive header */}
      <header className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            onExit();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#AFAFAF] transition hover:bg-[#F7F7F7] active:scale-90"
          aria-label="Exit lesson"
        >
          <X className="h-7 w-7" strokeWidth={3} />
        </button>

        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[#E5E5E5]">
          <div
            className="relative h-full rounded-full bg-[#58CC02] transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          >
            <span className="absolute top-[3px] right-2 left-2 h-[5px] rounded-full bg-white/30" />
          </div>
        </div>

        {current.isReview && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF8D6] px-2 py-0.5 text-[11px] font-black text-[#E5A500]">
            <Sparkles className="h-3 w-3" />
            Review
          </span>
        )}
      </header>

      {combo >= 2 && (
        <div key={combo} className="animate-pop -mt-2 self-center rounded-full bg-[#FFF1DC] px-3 py-1 text-sm font-black text-[#FF9600]">
          🔥 {combo} in a row
        </div>
      )}

      {/* Active step */}
      <div className="flex flex-1 flex-col">
        {current.exerciseType === 'discovery' && (
          <DiscoveryCard key={current.id} item={current.item} onContinue={handleDiscoveryContinue} />
        )}
        {current.exerciseType === 'matching' && (
          <MatchingExercise
            key={current.id}
            item={current.item}
            peers={current.peerItems ?? []}
            disabled={feedback !== null}
            onComplete={handleExerciseComplete}
          />
        )}
        {current.exerciseType === 'mcq' && (
          <McqExercise
            key={current.id}
            item={current.item}
            peers={current.peerItems ?? []}
            disabled={feedback !== null}
            onComplete={handleExerciseComplete}
          />
        )}
        {current.exerciseType === 'cloze' && (
          <ClozeExercise
            key={current.id}
            item={current.item}
            disabled={feedback !== null}
            onComplete={handleExerciseComplete}
          />
        )}
        {current.exerciseType === 'reorder' && (
          <ReorderExercise
            key={current.id}
            item={current.item}
            disabled={feedback !== null}
            onComplete={handleExerciseComplete}
          />
        )}
        {isTypingExercise && (
          <TypingExercise
            key={current.id}
            item={current.item}
            mode={
              current.typingMode ??
              (current.exerciseType === 'typing_sentence' ? 'sentence' : 'word')
            }
            disabled={feedback !== null}
            onComplete={handleExerciseComplete}
          />
        )}
      </div>

      {/* Sliding correction drawer */}
      {feedback && (
        <section
          className={`animate-slide-up fixed right-0 bottom-0 left-0 z-40 mx-auto flex max-h-[75dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-3xl p-4 pb-6 ${
            feedback.isCorrect ? 'bg-[#D7FFB8]' : 'bg-[#FFDFE0]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl ${
                  feedback.isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'
                }`}
              >
                {feedback.isCorrect ? '✓' : '✕'}
              </div>
              <div>
                <p
                  className={`text-xl leading-tight font-black ${
                    feedback.isCorrect ? 'text-[#58A700]' : 'text-[#EA2B2B]'
                  }`}
                >
                  {feedback.isCorrect ? (feedback.isExact ? cheer : 'Almost! Mind the spelling') : 'Correct answer:'}
                </p>
                {showAnswer && (
                  <p
                    className={`mt-0.5 text-base font-black ${
                      feedback.isCorrect ? 'text-[#58A700]' : 'text-[#EA2B2B]'
                    }`}
                  >
                    {feedback.expectedAnswer}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {feedback.isCorrect && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFC800] px-2.5 py-1 text-sm font-black text-white">
                  <Zap className="h-4 w-4 fill-white" />+{XP_PER_CORRECT} XP
                </span>
              )}
              <button
                type="button"
                onClick={() => speakGerman(current.item.sentence_de)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-[#1CB0F6] transition active:scale-90"
                aria-label="Listen to example sentence"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {feedback.wordDiff && !feedback.isExact && (
            <div className="rounded-2xl bg-white/70 p-3">
              <p className="mb-2 text-[11px] font-black tracking-wider text-[#AFAFAF] uppercase">
                Word-by-word comparison
              </p>
              <div className="flex flex-wrap gap-1.5">
                {feedback.wordDiff.map((part, idx) => (
                  <div
                    key={`${idx}-${part.expectedWord}`}
                    className={`rounded-xl border-2 px-2.5 py-1 text-xs font-black ${
                      part.status === 'exact'
                        ? 'border-[#58CC02] bg-[#D7FFB8] text-[#58A700]'
                        : part.status === 'typo'
                          ? 'border-[#FFC800] bg-[#FFF8D6] text-[#E5A500]'
                          : 'border-[#FF4B4B] bg-[#FFDFE0] text-[#EA2B2B]'
                    }`}
                  >
                    {part.status !== 'exact' && part.userWord && (
                      <span className="mr-1.5 line-through opacity-70">{part.userWord}</span>
                    )}
                    <span>{part.expectedWord}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-black text-[#4B4B4B]">
            {current.item.article && gender && (
              <span
                className={`rounded-lg border-2 px-2 py-0.5 text-xs font-black ${gender.badgeBg} ${gender.badgeBorder} ${gender.badgeText}`}
              >
                {current.item.article}
              </span>
            )}
            <span>{formatGermanWithArticle(current.item.german, current.item.article)}</span>
            <span className="text-[#AFAFAF]">— {current.item.translation}</span>
            {current.item.plural && (
              <span className="text-xs text-[#AFAFAF]">(Pl. {current.item.plural})</span>
            )}
          </div>

          <div className="text-xs leading-relaxed text-[#777777]">
            <p className="font-black text-[#4B4B4B]">{current.item.sentence_de}</p>
            <p className="font-bold">{current.item.sentence_translation}</p>
          </div>

          {current.item.grammar_tip && (
            <div className="flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-xs leading-relaxed font-bold text-[#6B5B00]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC800]" />
              <span>{current.item.grammar_tip}</span>
            </div>
          )}

          {!feedback.isCorrect && supportsAiWhyWrong && (
            <div className="flex flex-col gap-2">
              {!aiExplanation && (
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleAskWhyWrong}
                  className="btn-3d btn-white w-full !min-h-[44px] !rounded-xl !text-xs !text-[#EA2B2B]"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing your answer...</span>
                    </>
                  ) : (
                    <span>💡 Why is this wrong?</span>
                  )}
                </button>
              )}

              {aiExplanation && (
                <div className="animate-fade-in rounded-2xl border-2 border-[#FFB3B3] bg-white p-3 text-xs leading-relaxed font-bold text-[#4B4B4B]">
                  <p className="mb-1 text-[10px] font-black tracking-wider text-[#EA2B2B] uppercase">
                    💡 AI Grammar Explanation
                  </p>
                  <p>{aiExplanation}</p>
                </div>
              )}

              {aiError && (
                <p className="text-center text-xs font-bold text-[#EA2B2B]">{aiError}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={advanceStep}
            className={`btn-3d w-full !min-h-14 !text-base ${feedback.isCorrect ? 'btn-green' : 'btn-red'}`}
          >
            {feedback.isCorrect ? (isLast ? 'Finish' : 'Continue') : 'Got it'}
          </button>
        </section>
      )}
    </div>
  );
}
