export type PracticePhase = 'explanation' | 'pseudo' | 'code' | 'completed';

export interface PracticeSession {
  id: string;
  user_id: string;
  topic_id: string;
  problem_id: string;
  phase: PracticePhase;
  awaiting_confirmation: number;
  explanation_text?: string;
  explanation_score?: number;
  explanation_feedback?: string;
  pseudo_text?: string;
  pseudo_score?: number;
  pseudo_feedback?: string;
  code_text?: string;
  code_score?: number;
  code_feedback?: string;
  combined_quality?: number;
  started_at: string;
  completed_at?: string;
}
