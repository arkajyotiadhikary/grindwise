export interface Topic {
  id: string;
  roadmap_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  day_number: number;
  week_number: number;
  order_index: number;
  content: string;
  key_concepts: string; // JSON
  time_complexity: string;
  space_complexity: string;
}
