export interface UserProgress {
  id: string;
  user_id: string;
  topic_id: string;
  status: 'pending' | 'sent' | 'understood' | 'needs_review';
  sent_at?: string;
  understood_at?: string;
  review_count: number;
  last_reviewed?: string;
  user_rating?: number;
}

export interface SpacedRepetition {
  id: string;
  user_id: string;
  topic_id: string;
  next_review_date: string;
  interval_days: number;
  ease_factor: number;
  repetition_count: number;
  last_quality?: number;
}

export interface TestQuestion {
  id: string;
  topic_id: string;
  question: string;
  type: string;
  options?: string;
  correct_answer: string;
  explanation?: string;
  difficulty: string;
}

export interface WeeklyTest {
  id: string;
  user_id: string;
  week_number: number;
  questions: string;
  answers?: string;
  score?: number;
  max_score?: number;
  percentage?: number;
  status: 'pending' | 'sent' | 'completed';
  sent_at?: string;
  completed_at?: string;
}
