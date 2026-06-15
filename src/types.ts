export interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  subject?: string;
  answers: Answer[];
  type: 'single' | 'multiple';
  assigned_difficulty: number;
  advance_required_percent?: number; // Kept for backwards compatibility
  user_attempts: number;
  correct_attempts: number;
  current_attempt?: 'correct' | 'incorrect' | 'null';
  ordered?: boolean;
  explanation?: string;
}

export interface QuestionSet {
  id: string; // Internal ID for storing
  title: string;
  current_level?: number;
  advance_required_percent?: number;
  questions: Question[];
}
