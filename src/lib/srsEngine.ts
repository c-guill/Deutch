import { supabase } from './supabase';
import type { ExerciseType, LearningItem, UserProgress } from '../types/database';

export type TypingMode = 'word' | 'sentence';

export interface WordDiffPart {
  expectedWord: string;
  userWord: string | null;
  status: 'exact' | 'typo' | 'wrong' | 'missing';
}

export interface SessionExercise {
  id: string;
  item: LearningItem;
  exerciseType: ExerciseType;
  typingMode?: TypingMode;
  isReview: boolean;
  /** Extra items used for 5-pair matching or 4-choice MCQ exercises */
  peerItems?: LearningItem[];
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  isExact: boolean;
  distance: number;
  expected: string;
  wordDiff?: WordDiffPart[];
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.trim();
  const t = b.trim();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const prev = new Array<number>(t.length + 1);
  const curr = new Array<number>(t.length + 1);

  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

function normalizeForComparison(str: string): string {
  return str
    .normalize('NFC')
    .trim()
    .replace(/[.,!?;:]+/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function tokenizeWords(str: string): string[] {
  return str
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[.,!?;:"'„“()]+|[.,!?;:"'„“()]+$/g, ''))
    .filter(Boolean);
}

/**
 * Produces a word-by-word comparison between the user's input and expected German text.
 */
export function diffSentenceWords(userInput: string, expected: string): WordDiffPart[] {
  const expectedWords = tokenizeWords(expected);
  const userWords = tokenizeWords(userInput);

  return expectedWords.map((expWord, idx) => {
    const usrWord = userWords[idx] ?? null;
    if (!usrWord) {
      return { expectedWord: expWord, userWord: null, status: 'missing' };
    }
    const dist = levenshteinDistance(usrWord.toLowerCase(), expWord.toLowerCase());
    if (dist === 0) {
      return { expectedWord: expWord, userWord: usrWord, status: 'exact' };
    }
    if (dist === 1 && expWord.length >= 3) {
      return { expectedWord: expWord, userWord: usrWord, status: 'typo' };
    }
    return { expectedWord: expWord, userWord: usrWord, status: 'wrong' };
  });
}

/**
 * Smart tolerant validation:
 * - Ignores case and punctuation differences (., !, ?, ,).
 * - Proportional Levenshtein tolerance: <= 1 for a single word/noun, <= 2 for a full sentence.
 * - Returns word-by-word diff for rich error feedback.
 */
export function evaluateTypedAnswer(
  input: string,
  expected: string,
  mode: TypingMode = 'word'
): AnswerEvaluation {
  const normInput = normalizeForComparison(input);
  const normExpected = normalizeForComparison(expected);
  const wordDiff = diffSentenceWords(input, expected);

  if (!normInput) {
    return {
      isCorrect: false,
      isExact: false,
      distance: normExpected.length,
      expected,
      wordDiff,
    };
  }

  const distance = levenshteinDistance(normInput, normExpected);
  const isExact = distance === 0;

  let tolerance = 0;
  if (mode === 'sentence') {
    tolerance = normExpected.length >= 12 ? 2 : normExpected.length >= 4 ? 1 : 0;
  } else {
    tolerance = normExpected.length >= 3 ? 1 : 0;
  }

  const isCorrect = distance <= tolerance;

  return { isCorrect, isExact, distance, expected, wordDiff };
}

/**
 * Classic SM-2 spaced repetition calculation.
 * quality: 0-5 (incorrect=1, correct with typo=4, exact correct=5)
 */
export function calculateNextSM2(
  current: UserProgress | undefined,
  quality: number,
  exerciseType: ExerciseType
): UserProgress {
  const prevReps = current?.repetitions ?? 0;
  const prevInterval = current?.interval_days ?? 0;
  const prevEase = current?.ease_factor ?? 2.5;

  let repetitions: number;
  let intervalDays: number;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 0.5;
  } else {
    repetitions = prevReps + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevInterval * prevEase * 10) / 10;
    }
  }

  const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const easeFactor = Math.max(1.3, Math.round((prevEase + easeDelta) * 100) / 100);
  const nextReview = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    item_id: current?.item_id ?? '',
    repetitions,
    interval_days: intervalDays,
    ease_factor: easeFactor,
    next_review_at: nextReview,
    last_exercise_type: exerciseType,
  };
}

/**
 * Saves updated SM-2 progress to Supabase Cloud (`user_progress`).
 */
export async function recordProgress(
  itemId: string,
  current: UserProgress | undefined,
  quality: number,
  exerciseType: ExerciseType
): Promise<UserProgress> {
  const next = calculateNextSM2(
    current
      ? { ...current, item_id: itemId }
      : {
          item_id: itemId,
          repetitions: 0,
          interval_days: 0,
          ease_factor: 2.5,
          next_review_at: new Date().toISOString(),
          last_exercise_type: null,
        },
    quality,
    exerciseType
  );
  next.item_id = itemId;

  if (supabase) {
    const { error } = await supabase
      .from('user_progress')
      .upsert(next, { onConflict: 'item_id' });
    if (error) {
      console.error('Failed to sync user_progress:', error.message);
    }
  }

  return next;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function canReorder(item: LearningItem): boolean {
  const words = item.sentence_de.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 && words.length <= 10;
}

function pickPeers(item: LearningItem, allItems: LearningItem[], count: number): LearningItem[] {
  const pool = allItems.filter(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.german.toLowerCase() !== item.german.toLowerCase() &&
      candidate.translation.toLowerCase() !== item.translation.toLowerCase()
  );
  const sameTheme = pool.filter((c) => c.theme_id === item.theme_id);
  const source = sameTheme.length >= count ? sameTheme : pool;
  return shuffle(source).slice(0, count);
}

/**
 * Strict SM-2 tier exercise selection:
 * - repetitions === 0 (after DiscoveryCard) -> Matching (5 pairs) or simple MCQ
 * - repetitions === 1 -> Cloze or Reorder
 * - repetitions === 2 -> Typing (mode="word")
 * - repetitions >= 3 -> Typing (mode="sentence")
 */
function buildGradedStep(params: {
  item: LearningItem;
  progress: UserProgress | undefined;
  isReview: boolean;
  allItems: LearningItem[];
  index: number;
  matchingCounter: { count: number };
}): SessionExercise {
  const { item, progress, isReview, allItems, index, matchingCounter } = params;
  const storedReps = progress?.repetitions ?? 0;
  // Words revisited from earlier modules (already introduced, e.g. after a lapse) go straight to
  // consolidation (Cloze / Reorder) instead of a new discovery card.
  const reps = storedReps === 0 && isReview && progress ? 1 : storedReps;

  if (reps === 0) {
    const peers4 = pickPeers(item, allItems, 4);
    const useMatching = peers4.length >= 4 && matchingCounter.count < 2 && index % 3 === 0;
    if (useMatching) {
      matchingCounter.count++;
      return {
        id: `${item.id}-matching-${index}`,
        item,
        exerciseType: 'matching',
        isReview,
        peerItems: peers4,
      };
    }
    return {
      id: `${item.id}-mcq-${index}`,
      item,
      exerciseType: 'mcq',
      isReview,
      peerItems: pickPeers(item, allItems, 3),
    };
  }

  if (reps === 1) {
    const preferReorder =
      canReorder(item) &&
      (progress?.last_exercise_type === 'cloze' || index % 2 === 1);
    return {
      id: `${item.id}-${preferReorder ? 'reorder' : 'cloze'}-${index}`,
      item,
      exerciseType: preferReorder ? 'reorder' : 'cloze',
      isReview,
    };
  }

  if (reps === 2) {
    return {
      id: `${item.id}-typing-word-${index}`,
      item,
      exerciseType: 'typing_word',
      typingMode: 'word',
      isReview,
    };
  }

  return {
    id: `${item.id}-typing-sentence-${index}`,
    item,
    exerciseType: 'typing_sentence',
    typingMode: 'sentence',
    isReview,
  };
}

/**
 * Interleaves DiscoveryCards for unseen items (`repetitions === 0`) so each new item is
 * introduced FIRST, then tested in recognition 2–3 steps later in the same session.
 */
function scheduleWithDiscovery(
  entries: Array<{ item: LearningItem; isReview: boolean }>,
  allItems: LearningItem[],
  progressMap: Map<string, UserProgress>
): SessionExercise[] {
  const matchingCounter = { count: 0 };

  const newEntries: Array<{ discovery: SessionExercise; test: SessionExercise }> = [];
  const practicedSteps: SessionExercise[] = [];

  entries.forEach((entry, idx) => {
    const progress = progressMap.get(entry.item.id);
    const reps = progress?.repetitions ?? 0;
    const needsDiscovery = reps === 0 && !(entry.isReview && progress);
    const graded = buildGradedStep({
      item: entry.item,
      progress,
      isReview: entry.isReview,
      allItems,
      index: idx,
      matchingCounter,
    });

    if (needsDiscovery) {
      newEntries.push({
        discovery: {
          id: `${entry.item.id}-discovery-${idx}`,
          item: entry.item,
          exerciseType: 'discovery',
          isReview: false,
        },
        test: graded,
      });
    } else {
      practicedSteps.push(graded);
    }
  });

  // Build ordered timeline:
  // Emit discovery cards and schedule each corresponding recognition test 2–3 steps later.
  const timeline: SessionExercise[] = [];
  const pendingTests: Array<{ readyAt: number; step: SessionExercise }> = [];
  let newIdx = 0;
  let practicedIdx = 0;

  while (
    newIdx < newEntries.length ||
    practicedIdx < practicedSteps.length ||
    pendingTests.length > 0
  ) {
    // 1. If a scheduled recognition test has reached its target offset (2–3 steps after discovery), emit it
    const dueTestIdx = pendingTests.findIndex((p) => p.readyAt <= timeline.length);
    if (dueTestIdx !== -1) {
      const [due] = pendingTests.splice(dueTestIdx, 1);
      timeline.push(due.step);
      continue;
    }

    // 2. Alternate introducing a new discovery card and placing a practiced review item
    const shouldIntroduceNew =
      newIdx < newEntries.length &&
      (practicedIdx >= practicedSteps.length || pendingTests.length < 2 || timeline.length % 2 === 0);

    if (shouldIntroduceNew) {
      const pair = newEntries[newIdx++];
      timeline.push(pair.discovery);
      // Schedule recognition exercise 2 or 3 steps after this discovery card
      const gap = 2 + (newIdx % 2); // alternates 2 and 3
      pendingTests.push({ readyAt: timeline.length + gap, step: pair.test });
      continue;
    }

    if (practicedIdx < practicedSteps.length) {
      timeline.push(practicedSteps[practicedIdx++]);
      continue;
    }

    // 3. Flush remaining scheduled tests in order
    if (pendingTests.length > 0) {
      const next = pendingTests.shift()!;
      timeline.push(next.step);
    }
  }

  return timeline;
}

/**
 * Builds a session:
 * - 'theme': ~70% active theme items + ~30% due reviews from previous themes (with DiscoveryCards for reps === 0).
 * - 'review': up to 10 due items across all themes.
 * - 'sentence_practice': up to 10 full-sentence German writing exercises from started themes.
 */
export function buildSessionExercises(params: {
  mode: 'theme' | 'review' | 'sentence_practice';
  themeId?: number;
  moduleId?: string;
  /** Module ids (same theme) that precede `moduleId`, used for progressive re-mixing */
  previousModuleIds?: string[];
  allItems: LearningItem[];
  progressMap: Map<string, UserProgress>;
  sessionSize?: number;
}): SessionExercise[] {
  const {
    mode,
    themeId,
    moduleId,
    previousModuleIds = [],
    allItems,
    progressMap,
    sessionSize = 10,
  } = params;
  const now = Date.now();

  const isDue = (item: LearningItem): boolean => {
    const p = progressMap.get(item.id);
    if (!p) return false;
    return new Date(p.next_review_at).getTime() <= now;
  };

  if (mode === 'sentence_practice') {
    const startedThemeIds = new Set<number>();
    for (const item of allItems) {
      if (progressMap.has(item.id)) {
        startedThemeIds.add(item.theme_id);
      }
    }

    const sentenceEligible = allItems.filter(
      (it) =>
        startedThemeIds.has(it.theme_id) &&
        it.sentence_de?.trim().length > 0 &&
        it.sentence_translation?.trim().length > 0
    );

    // Prioritize practiced items first, then other items from started themes
    const practicedFirst = shuffle(sentenceEligible.filter((it) => progressMap.has(it.id)));
    const otherInStarted = shuffle(sentenceEligible.filter((it) => !progressMap.has(it.id)));
    const chosen = [...practicedFirst, ...otherInStarted].slice(0, sessionSize);

    return chosen.map((item, idx) => ({
      id: `${item.id}-sentence-practice-${idx}`,
      item,
      exerciseType: 'typing_sentence',
      typingMode: 'sentence',
      isReview: progressMap.has(item.id),
    }));
  }

  let selected: Array<{ item: LearningItem; isReview: boolean }> = [];

  if (mode === 'review') {
    const dueItems = allItems
      .filter(isDue)
      .sort((a, b) => {
        const ta = new Date(progressMap.get(a.id)!.next_review_at).getTime();
        const tb = new Date(progressMap.get(b.id)!.next_review_at).getTime();
        return ta - tb;
      })
      .slice(0, sessionSize);

    selected = dueItems.map((item) => ({ item, isReview: true }));
  } else if (moduleId) {
    // Module-scoped session (sub-modules of a theme)
    const moduleItems = allItems.filter((it) => it.module_id === moduleId);
    const previousSet = new Set(previousModuleIds);
    const previousItems = allItems.filter((it) => it.module_id && previousSet.has(it.module_id));

    const unseenOwn = shuffle(moduleItems.filter((it) => !progressMap.has(it.id)));
    const dueOwn = shuffle(moduleItems.filter((it) => isDue(it)));
    const restOwn = shuffle(moduleItems.filter((it) => progressMap.has(it.id) && !isDue(it)));
    const ownPool = [...unseenOwn, ...dueOwn, ...restOwn];

    if (previousItems.length === 0) {
      // Module 1 of a theme: session is entirely about this module's words
      selected = ownPool.slice(0, sessionSize).map((item) => ({ item, isReview: false }));
    } else {
      // Module N >= 2: ~65-70% current module, ~30-35% earlier modules of the same theme
      const reviewTarget = Math.max(1, Math.round(sessionSize * 0.32));
      const ownTarget = sessionSize - reviewTarget;

      // Prefer words already seen (never test unseen words blindly), due first, then lowest repetitions
      const seenPrevious = previousItems
        .filter((it) => progressMap.has(it.id))
        .sort((a, b) => {
          const dueDiff = Number(isDue(b)) - Number(isDue(a));
          if (dueDiff !== 0) return dueDiff;
          const repDiff =
            (progressMap.get(a.id)?.repetitions ?? 0) - (progressMap.get(b.id)?.repetitions ?? 0);
          if (repDiff !== 0) return repDiff;
          return Math.random() - 0.5;
        });
      const unseenPrevious = shuffle(previousItems.filter((it) => !progressMap.has(it.id)));

      const chosenOwn = ownPool.slice(0, ownTarget);
      const reviewPool = [...seenPrevious, ...unseenPrevious];
      const chosenPrevious = reviewPool.slice(0, reviewTarget);

      // If one pool is short, top up from the other so the session stays at sessionSize
      const missing = sessionSize - chosenOwn.length - chosenPrevious.length;
      let extra: LearningItem[] = [];
      if (missing > 0) {
        const usedIds = new Set([...chosenOwn, ...chosenPrevious].map((it) => it.id));
        extra = [...ownPool.slice(ownTarget), ...reviewPool.slice(reviewTarget)]
          .filter((it) => !usedIds.has(it.id))
          .slice(0, missing);
      }

      const ownIds = new Set(moduleItems.map((it) => it.id));
      selected = [
        ...chosenOwn.map((item) => ({ item, isReview: false })),
        ...chosenPrevious.map((item) => ({ item, isReview: true })),
        ...extra.map((item) => ({ item, isReview: !ownIds.has(item.id) })),
      ];
    }
  } else {
    const themeItems = moduleId
      ? allItems.filter((it) => it.module_id === moduleId)
      : allItems.filter((it) => it.theme_id === themeId);
    const otherDueItems = allItems.filter(
      (it) => (moduleId ? it.module_id !== moduleId : it.theme_id !== themeId) && isDue(it)
    );

    // Target ~30% due reviews (up to 3 out of 10) from previous themes
    const reviewTarget = Math.min(Math.round(sessionSize * 0.3), otherDueItems.length);
    const chosenReviews = shuffle(otherDueItems)
      .slice(0, reviewTarget)
      .map((item) => ({ item, isReview: true }));

    const remainingSlots = sessionSize - chosenReviews.length;

    const unseenTheme = shuffle(themeItems.filter((it) => !progressMap.has(it.id)));
    const dueTheme = shuffle(themeItems.filter((it) => isDue(it)));
    const otherTheme = shuffle(
      themeItems.filter((it) => progressMap.has(it.id) && !isDue(it))
    );

    const orderedThemePool = [...unseenTheme, ...dueTheme, ...otherTheme];
    const chosenTheme = orderedThemePool
      .slice(0, remainingSlots)
      .map((item) => ({ item, isReview: false }));

    selected = [...chosenTheme, ...chosenReviews];
  }

  return scheduleWithDiscovery(selected, allItems, progressMap);
}
