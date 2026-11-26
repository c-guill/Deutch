export interface Theme {
  id: number;
  order_index: number;
  title: string;
  description: string;
  grammar_focus: string;
}

export interface Module {
  id: string;
  theme_id: number;
  order_index: number;
  title: string;
  description: string;
}

export type LearningItemType =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'phrase'
  | 'number'
  | 'grammar'
  | 'other';

export interface LearningItem {
  id: string;
  theme_id: number;
  module_id?: string | null;
  item_type: LearningItemType | string;
  german: string;
  translation: string;
  article: 'der' | 'die' | 'das' | null;
  plural: string | null;
  sentence_de: string;
  sentence_translation: string;
  cloze_target: string;
  distractors: string[];
  grammar_tip: string;
}

export type ExerciseType =
  | 'discovery'
  | 'matching'
  | 'mcq'
  | 'cloze'
  | 'reorder'
  | 'typing'
  | 'typing_word'
  | 'typing_sentence';

export interface UserProgress {
  item_id: string;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  last_exercise_type: ExerciseType | null;
}
