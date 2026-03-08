export interface Problem {
  id: string;
  topic_id: string;
  leetcode_id?: number;
  leetcode_slug?: string;
  title: string;
  description?: string;
  difficulty: string;
  solution_code?: string;
  solution_explanation?: string;
  hints?: string;
  tags?: string;
  url?: string;
}
