export interface User {
  id: string;
  phone_number: string;
  name?: string;
  roadmap_id: string;
  current_day: number;
  current_week: number;
  streak: number;
  last_active?: string;
  enrolled_at: string;
  is_active: number;
}
