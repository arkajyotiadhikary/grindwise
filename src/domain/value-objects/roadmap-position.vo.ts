/**
 * Represents a specific position in the roadmap (week + day).
 */
export interface RoadmapPosition {
  weekNumber: number;
  dayNumber: number;
  orderIndex: number;
}

/**
 * A topic decorated with its position metadata in the roadmap sequence.
 */
export interface TopicNode<T> {
  topic: T;
  position: RoadmapPosition;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * A snapshot of a user's position and completion state in the curriculum.
 */
export interface CurriculumProgress {
  userId: string;
  currentPosition: RoadmapPosition;
  completedTopics: number;
  totalTopics: number;
  isComplete: boolean;
  percentageComplete: number;
}

/**
 * Returned by advanceUser() — the next position the user moved to,
 * or isComplete=true when the roadmap is finished.
 */
export interface AdvanceResult {
  newDay: number;
  newWeek: number;
  isComplete: boolean;
}
