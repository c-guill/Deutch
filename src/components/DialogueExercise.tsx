import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, MessageCircle, Trophy, Volume2, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { speakGerman, stopSpeaking } from '../lib/speech';
import {
  addXp,
  completeSessionForStreak,
  markDialogueDone,
  playSound,
} from '../lib/gameState';
import type { DialogueTurn, Theme, ThemeDialogue } from '../types/database';

interface DialogueExerciseProps {
  theme: Theme;
  onExit: () => void;
}

const DIALOGUE_XP_REWARD = 20;

function splitTurnByBlank(textDe: string, blankTarget: string | null): { before: string; after: string } {
  if (!blankTarget) return { before: textDe, after: '' };
  const exactIdx = textDe.indexOf(blankTarget);
  if (exactIdx !== -1) {
    return {
      before: textDe.slice(0, exactIdx),
      after: textDe.slice(exactIdx + blankTarget.length),
    };
  }
  const ciIdx = textDe.toLowerCase().indexOf(blankTarget.toLowerCase());
  if (ciIdx !== -1) {
    return {
      before: textDe.slice(0, ciIdx),
      after: textDe.slice(ciIdx + blankTarget.length),
    };
  }
  return { before: `${textDe} `, after: '' };
}

function shuffleChoices(target: string, distractors: string[]): string[] {
  const unique = new Set<string>([target]);
  for (const d of distractors || []) {
    if (d && unique.size < 4) unique.add(d);
  }
  const list = Array.from(unique);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export default function DialogueExercise({ theme, onExit }: DialogueExerciseProps) {
  const [dialogue, setDialogue] = useState<ThemeDialogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Number of visible turns so far (starts at 1, advances turn by turn)
  const [activeTurnIdx, setActiveTurnIdx] = useState(0);
  // Answers completed for user turns: turnIdx -> chosen word
  const [completedBlanks, setCompletedBlanks] = useState<Record<number, string>>({});
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('theme_dialogues')
        .select('*')
        .eq('theme_id', theme.id)
        .maybeSingle();

      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
      } else if (!data) {
        setError('No recap dialogue found for this unit yet.');
      } else {
        const parsed = data as ThemeDialogue;
        setDialogue(parsed);
        if (parsed.turns?.[0] && !parsed.turns[0].is_user_turn) {
          speakGerman(parsed.turns[0].text_de);
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [theme.id]);

  const currentTurn: DialogueTurn | undefined = dialogue?.turns?.[activeTurnIdx];

  const currentChoices = useMemo(() => {
    if (!currentTurn || !currentTurn.is_user_turn || !currentTurn.blank_target) return [];
    return shuffleChoices(currentTurn.blank_target, currentTurn.distractors || []);
  }, [currentTurn]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#AFAFAF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#58CC02]" />
        <p className="text-sm font-black">Loading recap dialogue...</p>
      </div>
    );
  }

  if (error || !dialogue) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-base font-black text-[#4B4B4B]">{error ?? 'Dialogue unavailable.'}</p>
        <button type="button" onClick={onExit} className="btn-3d btn-blue">
          Back to path
        </button>
      </div>
    );
  }

  const turns = dialogue.turns || [];
  const currentNeedsBlank =
    Boolean(currentTurn?.is_user_turn) &&
    Boolean(currentTurn?.blank_target) &&
    !completedBlanks[activeTurnIdx];

  const handleSelectChoice = (choice: string) => {
    if (!currentTurn || !currentTurn.blank_target) return;
    const isCorrect =
      choice.trim().toLowerCase() === currentTurn.blank_target.trim().toLowerCase();

    if (isCorrect) {
      setWrongChoice(null);
      setCompletedBlanks((prev) => ({
        ...prev,
        [activeTurnIdx]: currentTurn.blank_target!,
      }));
      playSound('correct');
      speakGerman(currentTurn.text_de);
    } else {
      setWrongChoice(choice);
      playSound('wrong');
      window.setTimeout(() => setWrongChoice(null), 550);
    }
  };

  const handleAdvanceTurn = () => {
    if (activeTurnIdx + 1 < turns.length) {
      const nextIdx = activeTurnIdx + 1;
      setActiveTurnIdx(nextIdx);
      const nextTurn = turns[nextIdx];
      if (nextTurn && !nextTurn.is_user_turn) {
        speakGerman(nextTurn.text_de);
      }
    } else if (!finished) {
      setFinished(true);
      addXp(DIALOGUE_XP_REWARD);
      markDialogueDone(theme.id);
      completeSessionForStreak();
      playSound('complete');
    }
  };

  const visibleTurns = turns.slice(0, activeTurnIdx + 1);

  return (
    <div className="animate-fade-in flex flex-1 flex-col justify-between gap-4 pb-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onExit();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#AFAFAF] transition hover:bg-[#F7F7F7] active:scale-90"
            aria-label="Back to path"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black tracking-wider text-[#E5A500] uppercase">
              Unit {String(theme.order_index).padStart(2, '0')} · Recap Dialogue
            </p>
            <h1 className="truncate text-lg font-black text-[#4B4B4B]">{dialogue.title}</h1>
          </div>
          <span className="rounded-xl bg-[#FFF8D6] px-2.5 py-1 text-xs font-black text-[#E5A500]">
            {activeTurnIdx + 1}/{turns.length}
          </span>
        </header>

        {/* Situation context card */}
        <section className="flex items-start gap-3 rounded-2xl border-2 border-b-4 border-[#FFE27A] bg-[#FFF8D6] p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFC800] text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-[#E5A500] uppercase">
              Situation
            </p>
            <p className="text-xs leading-relaxed font-bold text-[#6B5B00]">{dialogue.context}</p>
          </div>
        </section>

        {/* Mobile messenger chat bubbles */}
        <section className="flex flex-col gap-3">
          {visibleTurns.map((turn, idx) => {
            const isUser = turn.is_user_turn || turn.speaker === 'You' || turn.speaker === 'Moi';
            const filledWord = completedBlanks[idx];
            const showBlank = turn.is_user_turn && turn.blank_target;
            const { before, after } = splitTurnByBlank(turn.text_de, turn.blank_target);

            return (
              <div
                key={idx}
                className={`animate-fade-in flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="mb-1 px-1 text-[10px] font-black tracking-wider text-[#AFAFAF] uppercase">
                  {isUser ? 'You' : 'Partner'}
                </span>

                <div
                  className={`flex max-w-[90%] items-start gap-2.5 rounded-2xl border-2 border-b-4 p-3.5 ${
                    isUser
                      ? 'rounded-tr-sm border-[#84D8FF] bg-[#DDF4FF]'
                      : 'rounded-tl-sm border-[#E5E5E5] bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => speakGerman(turn.text_de)}
                    disabled={Boolean(showBlank && !filledWord)}
                    className="btn-3d btn-white !h-9 !min-h-0 !w-9 shrink-0 !rounded-xl !px-0 disabled:opacity-40"
                    aria-label="Listen to line in German"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-snug font-black text-[#4B4B4B]">
                      {showBlank ? (
                        <>
                          <span>{before}</span>
                          <span
                            className={`mx-1 inline-block min-w-[72px] rounded-xl border-2 border-b-4 px-2.5 py-0.5 text-center text-sm font-black ${
                              filledWord
                                ? 'border-[#58CC02] bg-[#D7FFB8] text-[#58A700]'
                                : 'border-[#1CB0F6] bg-white text-[#1899D6]'
                            }`}
                          >
                            {filledWord ?? '_____'}
                          </span>
                          <span>{after}</span>
                        </>
                      ) : (
                        turn.text_de
                      )}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#777777]">{turn.text_fr}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* Bottom interactive area */}
      {finished ? (
        <section className="animate-pop flex flex-col items-center gap-3 rounded-3xl border-2 border-b-4 border-[#58CC02] bg-[#D7FFB8] p-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFC800] text-white">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#58A700]">Dialogue Completed!</h2>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-black text-[#E5A500]">
              <Zap className="h-4 w-4 fill-[#FFC800]" />+{DIALOGUE_XP_REWARD} XP earned
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="btn-3d btn-green mt-1 w-full !min-h-14 !text-base"
          >
            Back to path
          </button>
        </section>
      ) : currentNeedsBlank ? (
        <section className="animate-fade-in flex flex-col gap-2.5 rounded-2xl border-2 border-b-4 border-[#E5E5E5] bg-[#F7F7F7] p-3.5">
          <p className="text-xs font-black tracking-wider text-[#1899D6] uppercase">
            Complete your reply in German:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {currentChoices.map((choice) => {
              const isWrong = wrongChoice === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleSelectChoice(choice)}
                  className={`tile justify-center text-center text-sm ${
                    isWrong ? 'tile-wrong' : ''
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={handleAdvanceTurn}
          className="btn-3d btn-green w-full !min-h-14 !text-base"
        >
          <Check className="h-5 w-5" strokeWidth={3} />
          <span>{activeTurnIdx + 1 < turns.length ? 'Next line' : 'Finish dialogue (+20 XP)'}</span>
        </button>
      )}
    </div>
  );
}
